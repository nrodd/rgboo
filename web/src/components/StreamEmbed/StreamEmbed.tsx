import { useDevEmbed } from "../../libs/useDevEmbed";

const devVideoUrl = "/dev-assets/dev-embed.mp4";
const youtubeStreamId = "ITBtNXd5WJs";

interface StreamEmbedProps {
  className?: string;
}

export const StreamEmbed = ({ className = "" }: StreamEmbedProps) => {
  const devEmbed = useDevEmbed();

  return (
    <div
      data-testid="stream-embed-container"
      className={`stream-embed-container w-full ${className}`}
    >
      <div className="lg:absolute lg:h-screen h-64 w-screen">
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
          <iframe
            src={`https://www.youtube.com/embed/${youtubeStreamId}?autoplay=1&mute=1&controls=0&showinfo=0&modestbranding=1&rel=0&playsinline=1&fs=1&disablekb=1`}
            title="YouTube stream"
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="w-full h-full"
            style={{
              minHeight: "200px",
              border: 0,
              visibility: "visible",
              display: "block",
            }}
          />
        )}
      </div>
    </div>
  );
};

export default StreamEmbed;
