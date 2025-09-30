import ColorForm from '../components/ColorForm';
import { TwitchEmbed } from '../components/TwitchEmbed';
import LogoIcon from '../assets/pumpkin.svg?react';

export const MainContent = () => (
    <div id="main-content" className="main-content">
        <div className="flex flex-col items-center justify-center">
            <LogoIcon viewBox="0 0 441 409" width="128" height="128" />
            <h1 className="text-bone text-md font-bold text-center">RGBOO</h1>
        </div>
        <div className="flex flex-col md:flex-row-reverse justify-center md:items-start gap-12 md:gap-8">
            <div className="w-full md:flex-1 max-w-2xl">
                <div className="mb-4 md:mb-0">
                    <TwitchEmbed channel="roddzillaaa" />
                </div>
            </div>
            <div className="w-full md:w-auto md:flex-shrink-0">
                <ColorForm />
            </div>
        </div>
    </div>
)