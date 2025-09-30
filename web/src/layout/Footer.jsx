import GhLogo from '../assets/github-mark-white.svg?react';
import TwitchLogo from '../assets/twitch-icon.svg?url';
import { useScreenSize } from '../libs/useScreenSize';

const SM = "28";
const LG = "40";

export const Footer = () => {

    const { isMobile } = useScreenSize();

    return <div id="footer" className="footer">
        <a href="https://twitch.tv/roddzillaaa" target="_blank" rel="noopener noreferrer" className="content-center text-bone">
            <img src={TwitchLogo} className="w-6 md:w-10 object-contain cursor-pointer hover:opacity-80 transition-opacity" />
        </a>
        <a href="https://github.com/nrodd/rgboo" target="_blank" rel="noopener noreferrer" className="content-center text-bone">
            <GhLogo className="github-icon fill-current cursor-pointer hover:opacity-80 transition-opacity" viewBox="0 0 100 100" width={isMobile ? SM : LG} height={isMobile ? SM : LG} />
        </a>
    </div>
}