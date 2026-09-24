// Command rgboo streams the RGBoo live broadcast to your speakers and draws a
// small animated scene in the terminal while it plays: a witch flying her broom
// under the moon, tinted with the latest LED color, over the username who
// requested it and the current + previous track.
//
// Playback is mpv, which pulls the YouTube stream through yt-dlp. Both are
// system dependencies; `brew install mpv yt-dlp` covers it.
package main

import (
	"context"
	"flag"
	"fmt"
	"io"
	"os"
	"os/exec"
	"os/signal"
	"runtime"
	"strings"
	"sync"
	"syscall"
	"time"
)

// Use the same live broadcast as the web stream embed.
const broadcastURL = "https://www.youtube.com/live/KbZBcBE0Nw4"

const fps = 8

// Set by GoReleaser via -ldflags.
var version = "dev"

const (
	altScreenOn  = "\x1b[?1049h"
	altScreenOff = "\x1b[?1049l"
	cursorHide   = "\x1b[?25l"
	cursorShow   = "\x1b[?25h"
	home         = "\x1b[H"
	clearLine    = "\x1b[K"
	clearBelow   = "\x1b[J"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "rgboo: "+err.Error())
		os.Exit(1)
	}
}

func run() error {
	staging := flag.Bool("staging", false, "listen to the staging now-playing stream")
	flag.Bool("prod", false, "listen to the production now-playing stream (the default)")
	showVersion := flag.Bool("version", false, "print the version and exit")
	flag.Parse()

	if *showVersion {
		fmt.Println("rgboo " + version)
		return nil
	}

	mpvPath, err := findPlayer()
	if err != nil {
		return err
	}

	state := &State{}
	client := &Client{
		URL:     ResolveStreamURL(os.Getenv("RGBOO_STREAM_URL"), *staging),
		Headers: accessHeaders(os.Getenv("CF_ACCESS_CLIENT_ID"), os.Getenv("CF_ACCESS_CLIENT_SECRET")),
		State:   state,
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	go client.Run(ctx)

	// mpv is told --no-terminal so it never writes to the screen the scene owns;
	// its stderr is held back and only shown if it dies.
	stderr := &tailBuffer{limit: 4096}
	mpv := exec.CommandContext(ctx, mpvPath, "--no-video", "--no-terminal", broadcastURL)
	mpv.Stderr = stderr
	mpv.WaitDelay = 2 * time.Second
	if err := mpv.Start(); err != nil {
		return fmt.Errorf("starting mpv: %w", err)
	}

	mpvDone := make(chan error, 1)
	go func() { mpvDone <- mpv.Wait() }()

	if isTerminal(os.Stdout) {
		animate(ctx, os.Stdout, state, mpvDone)
	} else {
		// Piped or redirected: escape codes would be noise, so just log changes.
		logChanges(ctx, os.Stdout, state, mpvDone)
	}

	// A non-zero mpv exit after we asked it to stop is just the kill landing.
	if err := <-mpvDone; err != nil && ctx.Err() == nil {
		if out := strings.TrimSpace(stderr.String()); out != "" {
			return fmt.Errorf("mpv exited: %w\n%s", err, out)
		}
		return fmt.Errorf("mpv exited: %w", err)
	}
	return nil
}

// animate drives the scene on its own timer, independent of when events arrive.
func animate(ctx context.Context, out io.Writer, state *State, mpvDone <-chan error) {
	io.WriteString(out, altScreenOn+cursorHide)
	defer io.WriteString(out, cursorShow+altScreenOff)

	ticker := time.NewTicker(time.Second / fps)
	defer ticker.Stop()

	draw(out, state.Snapshot()) // show the first frame right away
	for {
		select {
		case <-ctx.Done():
			return
		case <-mpvDone:
			return
		case <-ticker.C:
			draw(out, state.Tick())
		}
	}
}

// draw repaints in place: home, clear each line as we overwrite it, then wipe
// anything below, so the frame updates without the flicker of a full clear.
func draw(out io.Writer, s Snapshot) {
	var b strings.Builder
	b.WriteString(home)
	for i, line := range Render(s) {
		if i > 0 {
			b.WriteByte('\n')
		}
		b.WriteString(line)
		b.WriteString(clearLine)
	}
	b.WriteString(clearBelow)
	io.WriteString(out, b.String())
}

// logChanges is the non-TTY fallback: one line per track change, no animation.
func logChanges(ctx context.Context, out io.Writer, state *State, mpvDone <-chan error) {
	fmt.Fprintln(out, "rgboo: now playing. Ctrl-C to stop.")

	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()

	last, lastStatus := "", ""
	for {
		select {
		case <-ctx.Done():
			return
		case <-mpvDone:
			return
		case <-ticker.C:
			snap := state.Snapshot()
			// With no scene to put it in, a stream problem has to be said out
			// loud or it looks like nothing is happening.
			if snap.Status != lastStatus {
				lastStatus = snap.Status
				if snap.Status != "" {
					fmt.Fprintln(out, snap.Status)
				}
			}
			if snap.Current != "" && snap.Current != last {
				last = snap.Current
				fmt.Fprintln(out, "♪ "+snap.Current)
			}
		}
	}
}

// findPlayer resolves mpv and confirms yt-dlp is around, since mpv's ytdl_hook
// needs it to turn the YouTube URL into a playable stream.
func findPlayer() (string, error) {
	mpvPath, err := exec.LookPath("mpv")
	if err != nil {
		return "", fmt.Errorf("mpv not found on PATH. %s", installHint())
	}
	if _, err := exec.LookPath("yt-dlp"); err != nil {
		return "", fmt.Errorf("yt-dlp not found on PATH; mpv needs it to play a YouTube stream. %s", installHint())
	}
	return mpvPath, nil
}

func installHint() string {
	switch runtime.GOOS {
	case "darwin":
		return "Install both with `brew install mpv yt-dlp`."
	case "windows":
		return "Install both with `winget install mpv yt-dlp` or `scoop install mpv yt-dlp`."
	default:
		return "Install both with your package manager, e.g. `sudo apt install mpv yt-dlp`."
	}
}

func isTerminal(f *os.File) bool {
	info, err := f.Stat()
	return err == nil && info.Mode()&os.ModeCharDevice != 0
}

// tailBuffer keeps only the last `limit` bytes written to it, so a long-running
// mpv can't quietly grow a log we only ever read on failure.
type tailBuffer struct {
	mu    sync.Mutex
	buf   []byte
	limit int
}

func (t *tailBuffer) Write(p []byte) (int, error) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.buf = append(t.buf, p...)
	if overflow := len(t.buf) - t.limit; overflow > 0 {
		t.buf = t.buf[overflow:]
	}
	return len(p), nil
}

func (t *tailBuffer) String() string {
	t.mu.Lock()
	defer t.mu.Unlock()
	return string(t.buf)
}
