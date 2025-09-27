import GhLogo from '../assets/github-mark-white.svg?react';

export const Footer = () => (
    <div id="footer" className="flex justify-center content-center h-12 py-2 space-x-12">
        <img src="https://www.vectorlogo.zone/logos/twitch/twitch-icon.svg" className="w-6 object-contain" />
        <div className="content-center text-bone">
            <GhLogo className="fill-current" viewBox="0 0 100 100" width="28" height="28" />
        </div>
    </div>
)