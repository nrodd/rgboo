export type PlaybackStatus = "unconfigured" | "loading" | "playing" | "buffering" | "paused" | "blocked" | "ended" | "error";

export const playbackLabels: Record<PlaybackStatus, string> = {
  unconfigured: "Stream offline",
  loading: "Connecting to stream…",
  playing: "Playing",
  buffering: "Buffering…",
  paused: "Paused — click TV to resume",
  blocked: "Click TV to watch",
  ended: "Stream ended — click TV to reconnect",
  error: "Stream unavailable — click TV to reconnect",
};
