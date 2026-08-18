import { useEffect, useRef } from "react";
import { useDevEmbed } from "../../libs/useDevEmbed";

const devVideoUrl = "./dev-embed.mp4";

interface TwitchEmbedProps {
  channel?: string;
  className?: string;
}

export const TwitchEmbed = ({
  channel = "roddzillaaa",
  className = "",
}: TwitchEmbedProps) => {
  const embedRef = useRef<HTMLDivElement | null>(null);
  const devEmbed = useDevEmbed();

  useEffect(() => {
    if (devEmbed) return;

    if (!window.Twitch) {
      const script = document.createElement("script");
      script.src = "https://embed.twitch.tv/embed/v1.js";
      script.async = true;
      script.onload = () => initializeEmbed();
      script.onerror = (error) => {
        console.error("Failed to load Twitch embed script:", error);
      };
      document.body.appendChild(script);
    } else {
      initializeEmbed();
    }

    function initializeEmbed() {
      try {
        if (embedRef.current && window.Twitch) {
          embedRef.current.innerHTML = "";

          // @ts-ignore - Twitch typings not included
          new window.Twitch.Embed(embedRef.current, {
            width: "100%",
            height: "100%",
            channel: channel,
            layout: "video",
            autoplay: true,
            parent: [window.location.hostname],
            allowfullscreen: true,
          });
        }
      } catch (error) {
        console.error("Failed to initialize Twitch embed:", error);
      }
    }

    return () => {
      if (embedRef.current) {
        embedRef.current.innerHTML = "";
      }
    };
  }, [channel]);

  return (
    <div
      data-testid="twitch-embed-container"
      className={`twitch-embed-container w-full ${className}`}
    >
      <div className="aspect-video w-full overflow-hidden rounded-lg">
        {devEmbed ? (
          <video
            src={devVideoUrl}
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-full object-cover"
            style={{ minHeight: "200px" }}
          />
        ) : (
          <div
            ref={embedRef}
            className="w-full h-full"
            style={{
              minHeight: "200px",
              visibility: "visible",
              display: "block",
            }}
          />
        )}
      </div>
    </div>
  );
};

export default TwitchEmbed;
