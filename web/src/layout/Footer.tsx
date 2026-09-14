import GhLogo from "../assets/github-mark-white.svg?react";
import TwitchLogo from "../assets/twitch-icon.svg?url";
import { useScreenSize } from "../libs/useScreenSize";

const SM = "28";
const LG = "40";

export const Footer = () => {
  const { isMobile } = useScreenSize();

  return (
    <nav id="footer" data-testid="footer" className="footer" aria-label="RGBOO links">
      <a
        href="https://twitch.tv/roddzillaaa"
        target="_blank"
        rel="noopener noreferrer"
        className="content-center text-bone pointer-events-auto"
        aria-label="Watch RGBOO on Twitch"
      >
        <img
          src={TwitchLogo}
          alt=""
          className="footer-logo twitch-logo"
        />
      </a>
      <a
        href="https://github.com/nrodd/rgboo"
        target="_blank"
        rel="noopener noreferrer"
        className="content-center text-bone pointer-events-auto"
        aria-label="View RGBOO on GitHub"
      >
        <GhLogo
          aria-hidden="true"
          className="footer-logo github-icon"
          viewBox="0 0 100 100"
          width={isMobile ? SM : LG}
          height={isMobile ? SM : LG}
        />
      </a>
    </nav>
  );
};
