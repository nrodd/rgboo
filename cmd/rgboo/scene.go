package main

// The animated terminal scene: a witch bobbing along on her broom while the
// moon hangs overhead and trees drift past below. The witch is tinted with
// whatever color last came off the LEDs; everything else is fixed night-time
// palette. Render composites one frame into lines of text; the caller owns the
// screen and drives Frame forward on a timer.

import (
	"fmt"
	"math"
	"strings"
)

const (
	reset = "\x1b[0m"
	bold  = "\x1b[1m"
	dim   = "\x1b[2m"
)

// RGB is one LED color, 0-255 per channel.
type RGB struct {
	R, G, B int
}

// Halloween orange until a real color arrives, so the witch is never invisible.
var defaultColor = RGB{R: 255, G: 138, B: 0}

const (
	canvasW = 52 // canvas width
	skyH    = 10 // rows of sky above the ground line
	groundY = skyH - 1
)

func fg(c RGB) string {
	return fmt.Sprintf("\x1b[38;2;%d;%d;%dm", c.R, c.G, c.B)
}

func bg(c RGB) string {
	return fmt.Sprintf("\x1b[48;2;%d;%d;%dm", c.R, c.G, c.B)
}

var (
	moonColor     = fg(RGB{245, 232, 150})
	starColor     = fg(RGB{200, 200, 220})
	treeNearColor = fg(RGB{40, 90, 55})
	treeFarColor  = fg(RGB{30, 55, 45})
	groundColor   = fg(RGB{35, 30, 45})
)

// --- sprites -----------------------------------------------------------------
// Space is transparent; every other glyph paints itself in the given color.
// All sprite art is ASCII, which is what lets place index rows by byte.

var moonArt = []string{
	" ___ ",
	`/   \`,
	`\   /`,
	` \_/ `,
}

// Witch facing right (direction of travel), broom trailing off to the left.
var witchArt = []string{
	"   __/|__",
	"   //'>",
	`,,_//\____`,
	"-' ) >",
	"   ''",
}

var treeNearArt = []string{
	` /\ `,
	`/__\`,
	" || ",
}

var treeFarArt = []string{
	`/\`,
	"||",
}

// Fixed star field. Positions are hand-placed so nothing collides with the
// moon; the phase staggers the twinkle so they don't blink in unison.
var stars = []struct{ x, y, phase int }{
	{3, 1, 0}, {9, 3, 2}, {14, 0, 1}, {19, 4, 3}, {24, 2, 0},
	{30, 1, 2}, {8, 6, 1}, {17, 7, 3}, {2, 5, 2}, {12, 2, 0},
	{26, 5, 1}, {21, 1, 3},
}

// --- canvas ------------------------------------------------------------------

type canvas struct {
	chars  [skyH][canvasW]rune
	colors [skyH][canvasW]string
}

func newCanvas() *canvas {
	var c canvas
	for y := range c.chars {
		for x := range c.chars[y] {
			c.chars[y][x] = ' '
		}
	}
	return &c
}

func (c *canvas) place(sprite []string, x0, y0 int, color string) {
	for j, row := range sprite {
		y := y0 + j
		if y < 0 || y >= skyH {
			continue
		}
		for i := 0; i < len(row); i++ {
			ch := row[i]
			if ch == ' ' {
				continue // transparent
			}
			x := x0 + i
			if x < 0 || x >= canvasW {
				continue
			}
			c.chars[y][x] = rune(ch)
			c.colors[y][x] = color
		}
	}
}

// A row of trees scrolling right-to-left. speed in columns/frame gives the
// parallax: near trees move faster than far ones.
func (c *canvas) treeLayer(art []string, color string, spacing int, speed float64, frame, offset int) {
	period := canvasW + spacing
	shift := int(math.Floor(float64(frame) * speed))
	for base := -spacing; base < canvasW+spacing; base += spacing {
		x := (((base-shift+offset)%period)+period)%period - spacing
		c.place(art, x, groundY-len(art)+1, color)
	}
}

// Serialize the grid into ANSI lines, coalescing runs of the same color so we
// emit one escape per run rather than per cell.
func (c *canvas) lines() []string {
	out := make([]string, 0, skyH)
	var b strings.Builder
	for y := 0; y < skyH; y++ {
		b.Reset()
		cur := ""
		for x := 0; x < canvasW; x++ {
			col := c.colors[y][x]
			if col != cur {
				if cur != "" {
					b.WriteString(reset)
				}
				b.WriteString(col)
				cur = col
			}
			b.WriteRune(c.chars[y][x])
		}
		if cur != "" {
			b.WriteString(reset)
		}
		out = append(out, b.String())
	}
	return out
}

// --- frame -------------------------------------------------------------------

// Render builds one frame from the current state.
func Render(s Snapshot) []string {
	color := defaultColor
	if s.Color != nil {
		color = *s.Color
	}
	c := newCanvas()

	// Stars (twinkle: skip a beat on their phase).
	for _, st := range stars {
		if (s.Frame+st.phase)%7 == 0 {
			continue
		}
		glyph := "."
		if (s.Frame+st.phase)%3 == 0 {
			glyph = "+"
		}
		c.place([]string{glyph}, st.x, st.y, starColor)
	}

	// Moon, parked top-right.
	c.place(moonArt, canvasW-8, 0, moonColor)

	// The ground line the trees stand on.
	c.place([]string{strings.Repeat("_", canvasW)}, 0, groundY, groundColor)

	// Two tree layers for depth: far/slow/dim behind, near/fast in front.
	c.treeLayer(treeFarArt, treeFarColor, 11, 0.5, s.Frame, 5)
	c.treeLayer(treeNearArt, treeNearColor, 17, 1, s.Frame, 0)

	// Witch bobs gently as she flies, skimming the treetops. Drawn last so she
	// sits in front of the trees where their tops overlap her legs.
	bobs := [8]int{0, 0, -1, -1, 0, 0, 1, 1}
	c.place(witchArt, 6, 2+bobs[s.Frame%8], fg(color))

	lines := c.lines()

	// --- text below the scene --------------------------------------------------
	lines = append(lines, "")

	swatch := bg(color) + "  " + reset
	rgb := fmt.Sprintf("rgb(%d, %d, %d)", color.R, color.G, color.B)
	switch {
	case s.Username != "":
		lines = append(lines, swatch+" "+bold+"@"+s.Username+reset+" "+dim+rgb+reset)
	case s.Color != nil:
		lines = append(lines, swatch+" "+dim+rgb+reset)
	default:
		lines = append(lines, swatch+" "+dim+"waiting for a color..."+reset)
	}
	lines = append(lines, "")

	// Only ever the current track and the one before it.
	now := s.Current
	if now == "" {
		now = "(nothing playing yet)"
	}
	prev := s.Previous
	if prev == "" {
		prev = "(none yet)"
	}
	lines = append(lines, fg(color)+"♪"+reset+" "+bold+now+reset)
	lines = append(lines, dim+"·  "+prev+reset)
	lines = append(lines, "")

	// The stream's own troubles go here rather than to stdout, which the scene
	// owns -- a stray Println would smear across the frame.
	footer := "Ctrl-C to stop"
	if s.Status != "" {
		footer = s.Status + "  ·  " + footer
	}
	lines = append(lines, dim+footer+reset)

	return lines
}
