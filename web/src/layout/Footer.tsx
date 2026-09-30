import GhLogo from "../assets/github-mark-white.svg?react";
import TwitchLogo from "../assets/twitch-icon.svg?url";
import { useScreenSize } from "../libs/useScreenSize";
import { Link } from "react-router-dom";

const SM = "28";
const LG = "40";

export const Footer = () => {
  const { isMobile } = useScreenSize();

  return (
    <footer id="footer" data-testid="footer" className="footer">
      <div className="flex justify-center gap-8">
      <a
        href="https://twitch.tv/roddzillaaa"
        target="_blank"
        rel="noopener noreferrer"
        className="content-center text-bone pointer-events-auto"
        aria-label="RGBoo on Twitch"
      >
        <img
          src={TwitchLogo}
          alt=""
          className="w-6 md:w-10 object-contain cursor-pointer hover:opacity-80 transition-opacity"
        />
      </a>
      <a
        href="https://github.com/nrodd/rgboo"
        target="_blank"
        rel="noopener noreferrer"
        className="content-center text-bone pointer-events-auto"
        aria-label="RGBoo on GitHub"
      >
        <GhLogo
          className="github-icon fill-current cursor-pointer hover:opacity-80 transition-opacity"
          viewBox="0 0 100 100"
          width={isMobile ? SM : LG}
          height={isMobile ? SM : LG}
        />
      </a>
      </div>
      <nav aria-label="Site information" className="pointer-events-auto flex gap-5 rounded-full bg-arcana-900/90 px-4 py-1 text-[14px] text-bone">
        <Link to="/privacy" className="underline underline-offset-2">Privacy policy</Link>
        <Link to="/terms" className="underline underline-offset-2">Terms of service</Link>
      </nav>
    </footer>
  );
};
