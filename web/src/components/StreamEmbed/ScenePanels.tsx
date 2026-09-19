import { useEffect, useRef, useState, type RefObject } from "react";
import { HexColorPicker } from "react-colorful";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../ui/sheet";
import { Slider } from "../ui/slider";
import { Switch } from "../ui/switch";
import { colorFormSchema } from "../ColorForm/colorForm.schema";
import { cooldownRemaining, createColorSender, type SubmissionResult } from "../../api/colorSubmission";
import type { YouTubeHandle, YouTubeState } from "../../media/youtubePlayer";
import type { ScenePreferences } from "../../scene/preferences";

interface Props {
  panel: number | null; onClose(): void; returnFocus: RefObject<HTMLElement | null>;
  player: RefObject<YouTubeHandle | null>; playback: YouTubeState; videoId: string;
  preferences: ScenePreferences; onPreferences(value: ScenePreferences): void; onRetry(): void;
}
const titles = ["Send a color", "Links", "Settings"];
const descriptions = ["Submit a name and color to the stream.", "Project links and information.", "Playback and accessibility controls."];
const swatches = ["#8fa77b", "#d5854c", "#946172", "#697fa8", "#d2b575", "#722cc7"];

export function ScenePanels({ panel, onClose, returnFocus, player, playback, videoId, preferences, onPreferences, onRetry }: Props) {
  const [username, setUsername] = useState("");
  const [color, setColor] = useState("#8fa77b");
  const [hexInput, setHexInput] = useState(color);
  const [result, setResult] = useState<SubmissionResult | null>(null);
  const [remaining, setRemaining] = useState(cooldownRemaining);
  const sender = useRef<ReturnType<typeof createColorSender> | null>(null);
  const lastPanel = useRef(0);
  if (panel !== null) lastPanel.current = panel;
  const selected = panel ?? lastPanel.current;
  useEffect(() => {
    sender.current = createColorSender((next) => { setResult(next); setRemaining(cooldownRemaining()); });
    const timer = window.setInterval(() => setRemaining(cooldownRemaining()), 1000);
    return () => { sender.current?.destroy(); window.clearInterval(timer); };
  }, []);
  const pickColor = (hex: string) => { setColor(hex); setHexInput(hex); };
  const playing = playback.status === "playing" || playback.status === "buffering";
  const togglePreference = (key: keyof ScenePreferences, value: boolean) => onPreferences({ ...preferences, [key]: value });
  return <Sheet open={panel !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
    <SheetContent side="right" className="scene-sheet" data-side="right"
      data-reduced-motion={preferences.reduceMotion} data-high-contrast={preferences.highContrast}
      onCloseAutoFocus={(event) => { event.preventDefault(); returnFocus.current?.focus({ preventScroll: true }); }}>
      <SheetHeader className="panel-header">
        <SheetTitle className="panel-title">{titles[selected]}</SheetTitle>
        <SheetDescription className="sr-only">{descriptions[selected]}</SheetDescription>
      </SheetHeader>
      {selected === 0 && <form className="panel-stack" onSubmit={async (event) => {
        event.preventDefault();
        if (!/^#[\da-f]{6}$/i.test(hexInput)) { setResult({ kind: "error", message: "Enter a six-digit hex color, such as #8fa77b." }); return; }
        const value = { username: username.trim(), color: { r: parseInt(color.slice(1, 3), 16), g: parseInt(color.slice(3, 5), 16), b: parseInt(color.slice(5, 7), 16) } };
        try { await colorFormSchema.validate(value); }
        catch (error) { setResult({ kind: "error", message: error instanceof Error ? error.message : "Please check your name and color." }); return; }
        await sender.current?.send(value);
      }}>
        <div className="panel-field"><Label htmlFor="broadcast-name">Your name</Label>
          <Input id="broadcast-name" placeholder="Your name on the stream" autoComplete="nickname" minLength={4} maxLength={25} required value={username} onChange={(event) => setUsername(event.target.value)} aria-describedby="name-hint" />
          <p id="name-hint" className="panel-hint">4–25 letters, numbers, spaces or underscores.</p>
        </div>
        <div className="panel-field"><Label htmlFor="broadcast-color">Your color</Label>
          <HexColorPicker color={color} onChange={pickColor} />
          <div className="color-swatches" aria-label="Color presets">{swatches.map((hex) => <Button key={hex} type="button" className="color-swatch" style={{ backgroundColor: hex }} aria-label={`Choose ${hex}`} aria-pressed={color === hex} onClick={() => pickColor(hex)} />)}</div>
          <div className="color-value"><span style={{ backgroundColor: color }} aria-hidden="true" /><Input id="broadcast-color" aria-label="Hex color" value={hexInput} maxLength={7} spellCheck={false} onChange={(event) => { const value = event.target.value; setHexInput(value); if (/^#[\da-f]{6}$/i.test(value)) setColor(value); }} /></div>
        </div>
        <Button className="panel-button panel-primary" type="submit" disabled={result?.kind === "sending" || remaining > 0}>
          {result?.kind === "sending" ? "Sending…" : remaining > 0 ? `Send again in ${remaining}s` : "Send to the stream"}
        </Button>
        <p role="status" className="panel-feedback" data-error={result?.kind === "error"}>{result?.message}</p>
      </form>}
      {selected === 1 && <div className="panel-stack">
        <nav className="panel-links" aria-label="Project links">
          <a href={`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`} target="_blank" rel="noreferrer"><span>YouTube</span><span aria-hidden="true">↗</span></a>
          <a href="https://twitch.tv/roddzillaaa" target="_blank" rel="noreferrer"><span>Twitch</span><span aria-hidden="true">↗</span></a>
          <a href="https://github.com/nrodd/rgboo" target="_blank" rel="noreferrer"><span>GitHub</span><span aria-hidden="true">↗</span></a>
        </nav>
        <section className="panel-note"><h3>About</h3><p>Send a color to control the physical LEDs. Watch the stream to see it light up the pumpkin when it's your turn.</p></section>
      </div>}
      {selected === 2 && <div className="panel-stack">
        <section className="panel-field"><h3>Sound & playback</h3>
          <div className="playback-buttons"><Button className="panel-button" disabled={!playback.ready} onClick={() => player.current?.togglePlayback()}>{playing ? "Pause stream" : "Play stream"}</Button>
            <Button className="panel-button" disabled={!playback.ready} onClick={() => player.current?.toggleSound()}>{playback.muted ? "Unmute stream" : "Mute stream"}</Button></div>
          <div className="setting-heading"><Label htmlFor="stream-volume">Volume</Label><span>{playback.muted ? "Muted" : `${playback.volume}%`}</span></div>
          <Slider id="stream-volume" className="panel-slider" aria-label="Stream volume" value={[playback.volume]} max={100} step={1} disabled={!playback.ready} onValueChange={([value]) => player.current?.setVolume(value)} />
          <p role="status" className="panel-hint">{playback.status === "blocked" ? "Press Play stream to start watching." : playback.status === "error" ? "The stream couldn't connect." : playback.status === "unconfigured" ? "No stream is configured." : playback.status === "loading" ? "Connecting to the stream…" : `Stream ${playback.status}.`}</p>
          {playback.status === "error" && <Button className="panel-button" onClick={onRetry}>Reconnect stream</Button>}
        </section>
        <section className="panel-field"><h3>Accessibility</h3>
          <div className="setting-row"><div><Label htmlFor="reduce-motion">Reduce motion</Label></div><Switch id="reduce-motion" className="panel-switch" checked={preferences.reduceMotion} onCheckedChange={(v) => togglePreference("reduceMotion", v)} /></div>
          <div className="setting-row"><div><Label htmlFor="high-contrast">Higher UI contrast</Label></div><Switch id="high-contrast" className="panel-switch" checked={preferences.highContrast} onCheckedChange={(v) => togglePreference("highContrast", v)} /></div>
          <div className="setting-row"><div><Label htmlFor="show-labels">Show tape labels</Label></div><Switch id="show-labels" className="panel-switch" checked={preferences.showLabels} onCheckedChange={(v) => togglePreference("showLabels", v)} /></div>
        </section>
        <section className="panel-shortcuts" aria-label="Scene keyboard shortcuts"><span><kbd>Space</kbd> Play / pause</span><span><kbd>M</kbd> Sound</span><span><kbd>F</kbd> Frog</span><span><kbd>L</kbd> Candles</span></section>
      </div>}
    </SheetContent>
  </Sheet>;
}
