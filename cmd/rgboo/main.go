// Command rgboo streams the RGBoo live broadcast to your speakers and draws a
// small animated scene in the terminal while it plays: a witch flying her broom
// under the moon, tinted with the latest LED color, over the username who
// requested it and the current + previous track.
//
// Playback is mpv, which pulls the Twitch stream through yt-dlp. Both are
// system dependencies; `brew install mpv yt-dlp` covers it.
package main

import (
	"bytes"
	"context"
	"errors"
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

// Whatever the channel is broadcasting right now, rather than a pinned video,
// so starting a new stream doesn't need a new release.
const broadcastURL = "https://www.twitch.tv/na10_dev"

// Nothing is playing, which is an ordinary state rather than a failure.
var errNotLive = errors.New("the stream isn't live right now, check back later")

const fps = 8

// Long enough for yt-dlp to negotiate with Twitch, short enough that a
// wedged resolve doesn't look like a hang.
const resolveTimeout = 45 * time.Second

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
		// Not being live isn't an error to report like one.
		if errors.Is(err, errNotLive) {
			fmt.Println(err)
			return
		}
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

	mpvPath, ytdlpPath, err := findPlayer()
	if err != nil {
		return err
	}

	state := &State{}
	client := &Client{
		URL:     ResolveStreamURL(os.Getenv("RGBOO_STREAM_URL"), *staging),
		Headers: accessHeaders(os.Getenv("CF_ACCESS_CLIENT_ID"), os.Getenv("CF_ACCESS_CLIENT_SECRET")),
		State:   state,
		Delay:   nowPlayingDelay,
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// Resolve before anything else starts. mpv would do this itself, but with
	// --no-terminal it exits 2 without a word, so asking yt-dlp directly is
	// the only way to tell "not live" apart from a real problem.
	watchURL, err := resolveBroadcast(ctx, ytdlpPath, resolveBroadcastURL(os.Getenv("RGBOO_BROADCAST_URL")))
	if err != nil {
		return err
	}

	go client.Run(ctx)

	// mpv is told --no-terminal so it never writes to the screen the scene owns;
	// its stderr is held back and only shown if it dies.
	stderr := &tailBuffer{limit: 4096}
	mpv := exec.CommandContext(ctx, mpvPath, "--no-video", "--no-terminal", watchURL)
	mpv.Stderr = stderr
	mpv.WaitDelay = 2 * time.Second
	if err := mpv.Start(); err != nil {
		return fmt.Errorf("starting mpv: %w", err)
	}

	// Closed rather than sent to: both the UI loop and the check below need to
	// see mpv exit, and a single buffered value only ever reaches one of them.
	var mpvErr error
	mpvDone := make(chan struct{})
	go func() { mpvErr = mpv.Wait(); close(mpvDone) }()

	if isTerminal(os.Stdout) {
		animate(ctx, os.Stdout, state, mpvDone)
	} else {
		// Piped or redirected: escape codes would be noise, so just log changes.
		logChanges(ctx, os.Stdout, state, mpvDone)
	}

	<-mpvDone // on Ctrl-C the UI loop returns first; let the process finish going

	// A non-zero mpv exit after we asked it to stop is just the kill landing.
	if mpvErr != nil && ctx.Err() == nil {
		if out := strings.TrimSpace(stderr.String()); out != "" {
			return fmt.Errorf("mpv exited: %w\n%s", mpvErr, out)
		}
		return fmt.Errorf("mpv exited: %w", mpvErr)
	}
	return nil
}

// animate drives the scene on its own timer, independent of when events arrive.
func animate(ctx context.Context, out io.Writer, state *State, mpvDone <-chan struct{}) {
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
func logChanges(ctx context.Context, out io.Writer, state *State, mpvDone <-chan struct{}) {
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

// findPlayer resolves both tools up front: we call yt-dlp ourselves to find
// the live stream, and mpv's ytdl_hook calls it again to play one.
func findPlayer() (mpvPath, ytdlpPath string, err error) {
	if mpvPath, err = exec.LookPath("mpv"); err != nil {
		return "", "", fmt.Errorf("mpv not found on PATH. %s", installHint())
	}
	if ytdlpPath, err = exec.LookPath("yt-dlp"); err != nil {
		return "", "", fmt.Errorf("yt-dlp not found on PATH; it's what turns the channel into a playable stream. %s", installHint())
	}
	return mpvPath, ytdlpPath, nil
}

// resolveBroadcastURL picks which broadcast to play. RGBOO_BROADCAST_URL wins,
// for pinning one stream or pointing at something else entirely.
func resolveBroadcastURL(envURL string) string {
	if envURL != "" {
		return envURL
	}
	return broadcastURL
}

// resolveBroadcast asks yt-dlp what is streaming now and hands back its page
// URL, so mpv plays the same stream we just checked was live.
func resolveBroadcast(ctx context.Context, ytdlpPath, url string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, resolveTimeout)
	defer cancel()

	cmd := exec.CommandContext(ctx, ytdlpPath, "--no-warnings", "--simulate",
		"--print", "%(live_status)s|%(webpage_url)s", url)
	var stdout, stderr bytes.Buffer
	cmd.Stdout, cmd.Stderr = &stdout, &stderr

	// Run first: arguments are evaluated before the call, so reading the
	// buffers inline would read them empty.
	runErr := cmd.Run()
	return broadcastPage(stdout.String(), stderr.String(), runErr)
}

// broadcastPage reads yt-dlp's answer. Kept apart from the exec so every failure
// mode is testable without a network or a binary.
func broadcastPage(stdout, stderr string, runErr error) (string, error) {
	line, _, _ := strings.Cut(strings.TrimSpace(stdout), "\n")
	status, page, _ := strings.Cut(line, "|")

	if runErr == nil && page != "" {
		// A scheduled stream resolves fine but has nothing to play yet.
		if status == "is_upcoming" {
			return "", errNotLive
		}
		return page, nil
	}

	reason := ytdlpError(stderr)
	switch {
	case strings.Contains(reason, "not currently live"),
		strings.Contains(reason, "recording is not available"):
		return "", errNotLive
	case reason != "":
		return "", fmt.Errorf("finding the live stream: %s", reason)
	case runErr != nil:
		return "", fmt.Errorf("finding the live stream: %w", runErr)
	}
	return "", errors.New("finding the live stream: yt-dlp printed nothing")
}

// ytdlpError pulls the last `ERROR: [extractor] ...` line out of yt-dlp's
// output and drops the extractor tag, which means nothing to a listener.
func ytdlpError(stderr string) string {
	msg := ""
	for _, line := range strings.Split(stderr, "\n") {
		if rest, ok := strings.CutPrefix(strings.TrimSpace(line), "ERROR:"); ok {
			msg = strings.TrimSpace(rest)
		}
	}
	if strings.HasPrefix(msg, "[") {
		if i := strings.Index(msg, "] "); i != -1 {
			msg = msg[i+2:]
		}
	}
	return msg
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
