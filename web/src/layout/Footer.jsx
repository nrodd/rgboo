import GhLogo from '../assets/github-mark-white.svg?react';
import { useScreenSize } from '../libs/useScreenSize';

const SM = "28";
const LG = "40";

export const Footer = () => {

    const { isMobile } = useScreenSize();

    return <div id="footer" className="footer">
        <img src="https://www.vectorlogo.zone/logos/twitch/twitch-icon.svg" className="w-6 md: w-10 object-contain" />
        <div className="content-center text-bone">
            <GhLogo className="github-icon fill-current" viewBox="0 0 100 100" width={isMobile ? SM : LG} height={isMobile ? SM : LG} />
        </div>
    </div>
}