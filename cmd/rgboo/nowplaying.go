package main

// Subscribe to the rgboo now-playing SSE stream and keep the scene's state in
// sync: the latest LED color, who requested it, and the current + previous
// track. The bridge pushes updates to the Cloudflare Worker; we just listen.
// Best-effort: if the stream is unreachable, playback carries on regardless.
//
// Equivalent one-liner without this app: `curl -N https://rgboo.com/api/stream`

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
)

const (
	prodHost    = "https://rgboo.com"
	stagingHost = "https://staging.rgboo.com"
	streamPath  = "/api/stream"

	retryDelay = 5 * time.Second
)

// Snapshot is everything Render needs: a consistent copy of the state taken
// under the lock, so the SSE goroutine can keep writing while a frame draws.
type Snapshot struct {
	Color    *RGB
	Username string
	Current  string
	Previous string
	Status   string
	Frame    int
}

// State is the live version of the above, shared between the SSE reader and
// the animation ticker.
type State struct {
	mu   sync.Mutex
	snap Snapshot
}

func (s *State) Snapshot() Snapshot {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.snap
}

// Tick advances the animation one frame and returns the state to draw.
func (s *State) Tick() Snapshot {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.snap.Frame++
	return s.snap
}

func (s *State) setColor(c RGB, username string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.snap.Color = &c
	s.snap.Username = username
}

func (s *State) setTrack(track string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	// The worker replays the current track on connect; don't push a duplicate
	// into "previous" when nothing actually changed.
	if track == s.snap.Current {
		return
	}
	s.snap.Previous = s.snap.Current
	s.snap.Current = track
}

func (s *State) setStatus(status string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.snap.Status = status
}

// ResolveStreamURL works out which stream to hit. An explicit RGBOO_STREAM_URL
// wins (full URL); otherwise --staging picks the host, defaulting to prod.
func ResolveStreamURL(envURL string, staging bool) string {
	if envURL != "" {
		return envURL
	}
	if staging {
		return stagingHost + streamPath
	}
	return prodHost + streamPath
}

// accessHeaders exists because staging.rgboo.com sits behind Cloudflare Access,
// so a bare request gets the login page, not SSE. A service token (both env
// vars set) gets us through.
func accessHeaders(id, secret string) map[string]string {
	if id == "" || secret == "" {
		return nil
	}
	return map[string]string{
		"CF-Access-Client-Id":     id,
		"CF-Access-Client-Secret": secret,
	}
}

// Client streams now-playing events into a State.
type Client struct {
	URL     string
	Headers map[string]string
	State   *State
}

// Run listens forever, reconnecting with a slow backoff, until ctx is done.
func (c *Client) Run(ctx context.Context) {
	for {
		err := c.listen(ctx)
		if ctx.Err() != nil {
			return
		}
		if err != nil {
			c.State.setStatus(shortErr(err))
		} else {
			c.State.setStatus("stream ended, reconnecting")
		}

		select {
		case <-ctx.Done():
			return
		case <-time.After(retryDelay):
		}
	}
}

func (c *Client) listen(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.URL, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "text/event-stream")
	for k, v := range c.Headers {
		req.Header.Set(k, v)
	}

	// No client timeout: an SSE connection is meant to stay open indefinitely.
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		return fmt.Errorf("stream: HTTP %d", res.StatusCode)
	}
	// An HTML body means Cloudflare Access bounced us to its login page instead
	// of the stream; set CF_ACCESS_CLIENT_ID/SECRET for staging.
	if strings.Contains(res.Header.Get("Content-Type"), "text/html") {
		return errors.New("stream: got HTML, not SSE (Cloudflare Access login?)")
	}

	c.State.setStatus("")
	return parseEvents(res.Body, c.handle)
}

func (c *Client) handle(event, data string) {
	// The song is the default (unnamed) event; color rides a named `color`
	// event on the same stream. Route by name so one isn't shown as the other.
	if event == "color" {
		if color, username, ok := parseColor(data); ok {
			c.State.setColor(color, username)
		}
		return
	}
	c.State.setTrack(label(data))
}

// parseEvents reads an SSE body and calls handle once per complete event.
func parseEvents(r io.Reader, handle func(event, data string)) error {
	sc := bufio.NewScanner(r)
	sc.Buffer(make([]byte, 0, 64*1024), 1024*1024)

	var name string
	var data []string

	for sc.Scan() {
		line := strings.TrimSuffix(sc.Text(), "\r")

		if line == "" { // blank line terminates an event
			if len(data) > 0 {
				event := name
				if event == "" {
					event = "message"
				}
				handle(event, strings.Join(data, "\n"))
			}
			name, data = "", nil
			continue
		}

		switch {
		case strings.HasPrefix(line, ":"): // comment / keepalive
		case strings.HasPrefix(line, "event:"):
			name = strings.TrimSpace(strings.TrimPrefix(line, "event:"))
		case strings.HasPrefix(line, "data:"):
			// Per the SSE spec, exactly one leading space is stripped.
			data = append(data, strings.TrimPrefix(strings.TrimPrefix(line, "data:"), " "))
		}
	}
	return sc.Err()
}

// label formats whatever the bridge posted: JSON {artist,title}, or plain text.
func label(data string) string {
	var track struct {
		Artist string `json:"artist"`
		Title  string `json:"title"`
	}
	if err := json.Unmarshal([]byte(data), &track); err == nil && track.Title != "" {
		if track.Artist != "" {
			return track.Artist + " - " + track.Title
		}
		return track.Title
	}
	return data
}

// parseColor pulls {username, r, g, b} out of a color event. Pointers so a
// missing channel is distinguishable from a zero one.
func parseColor(data string) (RGB, string, bool) {
	var payload struct {
		Username string   `json:"username"`
		R        *float64 `json:"r"`
		G        *float64 `json:"g"`
		B        *float64 `json:"b"`
	}
	if err := json.Unmarshal([]byte(data), &payload); err != nil {
		return RGB{}, "", false
	}
	if payload.R == nil || payload.G == nil || payload.B == nil {
		return RGB{}, "", false
	}
	return RGB{R: int(*payload.R), G: int(*payload.G), B: int(*payload.B)}, payload.Username, true
}

// shortErr keeps the status line to one tidy phrase; the full URL and Go's
// wrapped dial errors are far too wide for the footer.
func shortErr(err error) string {
	msg := err.Error()
	if !strings.HasPrefix(msg, "stream: ") {
		// A transport error arrives as a stack of wrapped context, e.g.
		// `Get "https://...": dial tcp ...: connection refused`. Only the last
		// clause says anything a listener can act on.
		if i := strings.LastIndex(msg, ": "); i != -1 {
			msg = msg[i+2:]
		}
		msg = "stream: " + msg
	}
	return msg + ", retrying"
}
