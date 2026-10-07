import { createTwitchPlayer as createActualPlayer } from "../../media/twitchPlayer";
export * from "../../media/twitchPlayer";

// Keep production playback/state handling, but replace connected media with a local fixture.
export const createTwitchPlayer: typeof createActualPlayer = (host, source, onChange) => {
  const detached = document.createElement("div");
  const transfer = () => {
    const iframe = detached.querySelector("iframe");
    if (iframe && host.isConnected) {
      iframe.dataset.source = source;
      iframe.src = "about:blank";
      iframe.srcdoc = '<!doctype html><html><body style="margin:0;background:#192638;color:#fff;display:grid;place-items:center;height:100vh;font:16px monospace">RGBOO test stream</body></html>';
    }
    host.append(...Array.from(detached.childNodes));
  };
  const handle = createActualPlayer(detached, source, (state) => { transfer(); onChange(state); });
  transfer();
  return { ...handle, retry: () => { handle.retry(); transfer(); } };
};
