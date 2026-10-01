export interface VideoSourceConfig {
  url: string;
  type: "auto" | "hls" | "file";
  loop: boolean;
}

export function getVideoSource(): VideoSourceConfig {
  // The bundled preview is development-only and never a production fallback.
  if (import.meta.env.DEV && import.meta.env.VITE_DEV_EMBED === "true") {
    return { url: "/dev-assets/dev-embed.mp4", type: "file", loop: true };
  }
  const type = import.meta.env.VITE_STREAM_TYPE;
  return {
    url: import.meta.env.VITE_STREAM_URL?.trim() ?? "",
    type: type === "hls" || type === "file" ? type : "auto",
    loop: false,
  };
}
