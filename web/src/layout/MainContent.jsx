import ColorForm from '../components/ColorForm';
import { TwitchEmbed } from '../components/TwitchEmbed';
import LogoIcon from '../assets/pumpkin.svg?react';

export const MainContent = () => (
    <div id="main-content" className="main-content">
        <div className="flex sm:flex-col items-center sm:justify-center gap-4">
            <LogoIcon viewBox="0 0 441 409" className="w-10 h-10 sm:w-24 sm:h-24" />
            <h1 className="m-0 leading-none text-bone text-sm sm:text-md font-bold text-center translate-y-1 sm:translate-y-0">RGBOO</h1>
        </div>
        <div className="flex flex-col md:flex-row-reverse justify-center md:items-start gap-12 md:gap-8">
            <div className="w-full md:flex-1 max-w-2xl">
                <TwitchEmbed channel="roddzillaaa" />
            </div>
            <div className="w-full md:w-auto md:flex-shrink-0">
                <ColorForm />
            </div>
        </div>
    </div>
)