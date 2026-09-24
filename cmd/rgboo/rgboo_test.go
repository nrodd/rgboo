package main

import (
	"errors"
	"strings"
	"testing"
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
