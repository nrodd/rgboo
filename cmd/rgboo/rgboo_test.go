package main

import (
	"context"
	"errors"
	"io"
	"math"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestResolveStreamURL(t *testing.T) {
	tests := []struct {
		name    string
		envURL  string
		staging bool
		want    string
	}{
		{"defaults to prod", "", false, "https://rgboo.com/api/stream"},
		{"staging flag", "", true, "https://staging.rgboo.com/api/stream"},
		{"env wins over flag", "http://localhost:8787/api/stream", true, "http://localhost:8787/api/stream"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := ResolveStreamURL(tt.envURL, tt.staging); got != tt.want {
				t.Errorf("got %q, want %q", got, tt.want)
			}
		})
	}
}

func TestAccessHeaders(t *testing.T) {
	if got := accessHeaders("id", ""); got != nil {
		t.Errorf("half a token should yield no headers, got %v", got)
	}
	got := accessHeaders("id", "secret")
	if got["CF-Access-Client-Id"] != "id" || got["CF-Access-Client-Secret"] != "secret" {
		t.Errorf("unexpected headers: %v", got)
	}
}

func TestLabel(t *testing.T) {
	tests := []struct{ data, want string }{
		{`{"artist":"Boards of Canada","title":"Roygbiv"}`, "Boards of Canada - Roygbiv"},
		{`{"title":"Roygbiv"}`, "Roygbiv"},
		{`{"artist":"Nobody"}`, `{"artist":"Nobody"}`}, // no title: fall back to raw
		{"just a string", "just a string"},
	}
	for _, tt := range tests {
		if got := label(tt.data); got != tt.want {
			t.Errorf("label(%q) = %q, want %q", tt.data, got, tt.want)
		}
	}
}

func TestParseColor(t *testing.T) {
	color, user, ok := parseColor(`{"username":"ghoul","r":255,"g":0,"b":128}`)
	if !ok || color != (RGB{255, 0, 128}) || user != "ghoul" {
		t.Fatalf("got %v %q %v", color, user, ok)
	}

	// A zero channel is a real color, not a missing one.
	if color, _, ok := parseColor(`{"r":0,"g":0,"b":0}`); !ok || color != (RGB{0, 0, 0}) {
		t.Errorf("all-zero rgb should parse, got %v %v", color, ok)
	}

	for _, bad := range []string{`{"r":1,"g":2}`, `{"r":"1","g":2,"b":3}`, "not json", ""} {
		if _, _, ok := parseColor(bad); ok {
			t.Errorf("parseColor(%q) should have failed", bad)
		}
	}
}

func TestParseEvents(t *testing.T) {
	body := ":keepalive\n\n" +
		"data: {\"title\":\"Roygbiv\"}\n\n" +
		"event: color\ndata: {\"r\":1,\"g\":2,\"b\":3}\n\n" +
		"data: line one\ndata: line two\n\n"

	type ev struct{ name, data string }
	var got []ev
	if err := parseEvents(strings.NewReader(body), func(name, data string) {
		got = append(got, ev{name, data})
	}); err != nil {
		t.Fatal(err)
	}

	want := []ev{
		{"message", `{"title":"Roygbiv"}`},
		{"color", `{"r":1,"g":2,"b":3}`},
		{"message", "line one\nline two"},
	}
	if len(got) != len(want) {
		t.Fatalf("got %d events, want %d: %v", len(got), len(want), got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("event %d: got %v, want %v", i, got[i], want[i])
		}
	}
}

func TestParseEventsCRLF(t *testing.T) {
	var got string
	parseEvents(strings.NewReader("event: color\r\ndata: {}\r\n\r\n"), func(name, data string) {
		got = name + "|" + data
	})
	if got != "color|{}" {
		t.Errorf("got %q", got)
	}
}

func TestStateTrackHistory(t *testing.T) {
	s := &State{}
	s.setTrack("first")
	s.setTrack("first") // the worker replays on connect; must not shift history
	if snap := s.Snapshot(); snap.Current != "first" || snap.Previous != "" {
		t.Fatalf("replay shifted history: %+v", snap)
	}
	s.setTrack("second")
	if snap := s.Snapshot(); snap.Current != "second" || snap.Previous != "first" {
		t.Fatalf("got %+v", snap)
	}
}

func TestClientHandleAppliesImmediatelyWithoutDelay(t *testing.T) {
	state := &State{}
	c := &Client{State: state}
	c.handle("message", `{"title":"Roygbiv"}`)
	if got := state.Snapshot().Current; got != "Roygbiv" {
		t.Fatalf("got %q, want immediate update", got)
	}
}

func TestClientHandleHoldsBackForDelay(t *testing.T) {
	state := &State{}
	c := &Client{State: state, Delay: 30 * time.Millisecond}
	c.handle("message", `{"title":"Roygbiv"}`)
	if got := state.Snapshot().Current; got != "" {
		t.Fatalf("got %q before the delay elapsed", got)
	}
	time.Sleep(60 * time.Millisecond)
	if got := state.Snapshot().Current; got != "Roygbiv" {
		t.Fatalf("got %q, want the update applied after the delay", got)
	}
}

func TestRenderShape(t *testing.T) {
	lines := Render(Snapshot{})
	if len(lines) != skyH+7 {
		t.Fatalf("got %d lines, want %d", len(lines), skyH+7)
	}
	if !strings.Contains(lines[len(lines)-1], "Ctrl-C to stop") {
		t.Errorf("missing footer: %q", lines[len(lines)-1])
	}
	if !strings.Contains(strings.Join(lines, "\n"), "waiting for a color...") {
		t.Error("expected the no-color placeholder")
	}
}

func TestRenderNeverExceedsCanvasWidth(t *testing.T) {
	// Sprites are clipped, not wrapped: a scrolling tree must never push the
	// visible row past the canvas or the scene tears at the right edge.
	for frame := 0; frame < 200; frame++ {
		for _, line := range Render(Snapshot{Frame: frame})[:skyH] {
			if n := len(stripANSI(line)); n != canvasW {
				t.Fatalf("frame %d: row is %d cols, want %d", frame, n, canvasW)
			}
		}
	}
}

func TestRenderUsesLatestColor(t *testing.T) {
	color := RGB{10, 20, 30}
	out := strings.Join(Render(Snapshot{Color: &color, Username: "ghoul"}), "\n")
	if !strings.Contains(out, "\x1b[38;2;10;20;30m") {
		t.Error("witch is not tinted with the LED color")
	}
	if !strings.Contains(out, "@ghoul") || !strings.Contains(out, "rgb(10, 20, 30)") {
		t.Error("missing requester or rgb readout")
	}
}

func TestRenderStatusInFooter(t *testing.T) {
	footer := Render(Snapshot{Status: "stream: offline, retrying"})[skyH+6]
	if !strings.Contains(footer, "stream: offline, retrying") {
		t.Errorf("status missing from footer: %q", footer)
	}
}

// stripANSI removes SGR escapes so tests can measure visible width.
func stripANSI(s string) string {
	var b strings.Builder
	for i := 0; i < len(s); i++ {
		if s[i] == '\x1b' {
			for i < len(s) && s[i] != 'm' {
				i++
			}
			continue
		}
		b.WriteByte(s[i])
	}
	return b.String()
}

func TestShortErr(t *testing.T) {
	tests := []struct {
		err  error
		want string
	}{
		{errors.New("stream: HTTP 404"), "stream: HTTP 404, retrying"},
		{errors.New(`Get "https://rgboo.com/api/stream": dial tcp 1.2.3.4:443: connect: connection refused`),
			"stream: connection refused, retrying"},
		{errors.New("boom"), "stream: boom, retrying"},
	}
	for _, tt := range tests {
		if got := shortErr(tt.err); got != tt.want {
			t.Errorf("shortErr(%v) = %q, want %q", tt.err, got, tt.want)
		}
	}
}

func TestUILoopsLeaveMpvExitReadable(t *testing.T) {
	// Regression: these used to receive the one value off a buffered channel,
	// so run's own receive blocked forever and Ctrl-C did nothing.
	loops := map[string]func(context.Context, io.Writer, *State, <-chan struct{}){
		"animate":    animate,
		"logChanges": logChanges,
	}
	for name, loop := range loops {
		t.Run(name, func(t *testing.T) {
			mpvDone := make(chan struct{})
			close(mpvDone)
			loop(context.Background(), io.Discard, &State{}, mpvDone)
			select {
			case <-mpvDone:
			case <-time.After(time.Second):
				t.Fatal("mpv exit signal was swallowed; run would hang here")
			}
		})
	}
}

func TestTreeLayersKeepEvenSpacing(t *testing.T) {
	// A seam in the tree line is the tell that positions wrapped individually.
	for _, tt := range []struct {
		spacing int
		speed   float64
		offset  int
	}{{11, 0.5, 5}, {17, 1, 0}} {
		for frame := 0; frame < 200; frame++ {
			shift := int(math.Floor(float64(frame)*tt.speed)) - tt.offset
			first := -tt.spacing - ((shift%tt.spacing)+tt.spacing)%tt.spacing
			if first > -tt.spacing || first <= -2*tt.spacing {
				t.Fatalf("spacing %d frame %d: first tree at %d is outside the left gutter",
					tt.spacing, frame, first)
			}
			if last := first + ((canvasW-first-1)/tt.spacing)*tt.spacing; last < canvasW-tt.spacing {
				t.Fatalf("spacing %d frame %d: last tree at %d leaves a gap at the right edge",
					tt.spacing, frame, last)
			}
		}
	}
}

func TestStreamClientRefusesCrossHostRedirect(t *testing.T) {
	// net/http forwards custom headers across hosts, so following one would
	// hand the CF Access token to the redirect target.
	mustURL := func(raw string) *url.URL {
		u, err := url.Parse(raw)
		if err != nil {
			t.Fatal(err)
		}
		return u
	}
	via := []*http.Request{{URL: mustURL("https://staging.rgboo.com/api/stream")}}

	if err := streamClient.CheckRedirect(&http.Request{URL: mustURL("https://evil.example/x")}, via); err == nil {
		t.Error("cross-host redirect should be refused")
	}
	if err := streamClient.CheckRedirect(&http.Request{URL: mustURL("https://staging.rgboo.com/v2")}, via); err != nil {
		t.Errorf("same-host redirect should be allowed: %v", err)
	}
}

func TestParseColorClampsChannels(t *testing.T) {
	color, _, ok := parseColor(`{"r":1e30,"g":-5,"b":300}`)
	if !ok || color != (RGB{255, 0, 255}) {
		t.Fatalf("got %v %v, want {255 0 255}", color, ok)
	}
	if got := fg(color); strings.ContainsAny(got, "-") {
		t.Errorf("negative channel reached the escape sequence: %q", got)
	}
	if color, _, _ := parseColor(`{"r":1,"g":2,"b":3}`); color != (RGB{1, 2, 3}) {
		t.Errorf("clamping mangled an ordinary color: %v", color)
	}
}

func TestParseEventsDropsOversizedEvent(t *testing.T) {
	// The scanner caps a single line; this is the other half, an event built
	// from many lines that never reaches its terminating blank one.
	flood := strings.Repeat("data: "+strings.Repeat("x", 1000)+"\n", 2*maxEventBytes/1000)

	var got []string
	if err := parseEvents(strings.NewReader(flood+"\n"+"data: still here\n\n"), func(_, data string) {
		got = append(got, data)
	}); err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0] != "still here" {
		t.Errorf("want only the small event through, got %d events", len(got))
	}
}

func TestIdleReaderTracksDelivery(t *testing.T) {
	const window = 400 * time.Millisecond

	var fired atomic.Bool
	watchdog := time.AfterFunc(window, func() { fired.Store(true) })
	defer watchdog.Stop()

	pr, pw := io.Pipe()
	go func() {
		for i := 0; i < 6; i++ {
			time.Sleep(window / 4)
			pw.Write([]byte("x"))
		}
		pw.Close()
	}()
	// Well past the window in total, but never silent for a whole one.
	io.Copy(io.Discard, &idleReader{r: pr, watchdog: watchdog, every: window})
	if fired.Load() {
		t.Error("watchdog fired while bytes were still arriving")
	}

	watchdog.Reset(window / 8)
	time.Sleep(window / 2)
	if !fired.Load() {
		t.Error("watchdog never fired once the stream went silent")
	}
}

func TestResolveBroadcastURL(t *testing.T) {
	if got := resolveBroadcastURL(""); got != broadcastURL {
		t.Errorf("default should be the channel live URL, got %q", got)
	}
	if !strings.HasSuffix(broadcastURL, "/live") {
		t.Errorf("default must resolve whatever is live now, got %q", broadcastURL)
	}
	if got := resolveBroadcastURL("https://youtu.be/abc"); got != "https://youtu.be/abc" {
		t.Errorf("env should win, got %q", got)
	}
}

func TestBroadcastID(t *testing.T) {
	// stderr samples are real yt-dlp output, captured from the live tool.
	notLive := "ERROR: [youtube:tab] UC2GJYmn0WCqW8k1NFp1W7KQ: The channel is not currently live\n"
	gone := "ERROR: [youtube] KbZBcBE0Nw4: This live stream recording is not available.\n"

	tests := []struct {
		name           string
		stdout, stderr string
		runErr         error
		wantID         string
		wantNotLive    bool
	}{
		{"live now", "nI725iVsyoQ|is_live\n", "", nil, "nI725iVsyoQ", false},
		{"channel offline", "", notLive, errors.New("exit status 1"), "", true},
		{"pinned video gone", "", gone, errors.New("exit status 1"), "", true},
		{"scheduled but not started", "abc123|is_upcoming\n", "", nil, "", true},
		{"override plays a normal video", "xyz789|not_live\n", "", nil, "xyz789", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			id, err := broadcastID(tt.stdout, tt.stderr, tt.runErr)
			if tt.wantNotLive {
				if !errors.Is(err, errNotLive) {
					t.Fatalf("want errNotLive, got id=%q err=%v", id, err)
				}
				return
			}
			if err != nil || id != tt.wantID {
				t.Fatalf("got id=%q err=%v, want %q", id, err, tt.wantID)
			}
		})
	}
}

func TestBroadcastIDSurfacesRealFailures(t *testing.T) {
	// A genuine problem must not be mistaken for "not live", or the user gets
	// told to check back later forever.
	stderr := "ERROR: [youtube:tab] @x: Unable to download API page: HTTP Error 404: Not Found\n"
	_, err := broadcastID("", stderr, errors.New("exit status 1"))
	if errors.Is(err, errNotLive) {
		t.Fatal("a 404 was reported as merely not live")
	}
	if !strings.Contains(err.Error(), "HTTP Error 404") {
		t.Errorf("lost the reason: %v", err)
	}
	if strings.Contains(err.Error(), "youtube:tab") {
		t.Errorf("extractor tag leaked into the message: %v", err)
	}

	if _, err := broadcastID("", "", errors.New("exec: not started")); err == nil {
		t.Error("a bare exec failure should still be an error")
	}
	if _, err := broadcastID("", "", nil); err == nil {
		t.Error("empty output with no error should still be an error")
	}
}

func TestResolveBroadcastWaitsForTheTool(t *testing.T) {
	// Every broadcastID test above passes whether or not resolveBroadcast
	// actually waits for yt-dlp before reading its output. It once didn't:
	// the buffers were read as call arguments, so they were always empty.
	if runtime.GOOS == "windows" {
		t.Skip("stub is a shell script")
	}
	stub := func(name, body string) string {
		path := filepath.Join(t.TempDir(), name)
		if err := os.WriteFile(path, []byte("#!/bin/sh\n"+body+"\n"), 0o755); err != nil {
			t.Fatal(err)
		}
		return path
	}

	live := stub("live", `printf 'nI725iVsyoQ|is_live\n'`)
	got, err := resolveBroadcast(context.Background(), live, "https://example.invalid/live")
	if err != nil || got != "https://www.youtube.com/watch?v=nI725iVsyoQ" {
		t.Fatalf("got %q, %v", got, err)
	}

	offline := stub("offline",
		`echo 'ERROR: [youtube:tab] UC2GJYmn0WCqW8k1NFp1W7KQ: The channel is not currently live' >&2; exit 1`)
	if _, err := resolveBroadcast(context.Background(), offline, "https://example.invalid/live"); !errors.Is(err, errNotLive) {
		t.Fatalf("want errNotLive, got %v", err)
	}
}
