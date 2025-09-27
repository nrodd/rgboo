import ColorForm from '../components/ColorForm';
import LogoIcon from '../assets/pumpkin.svg?react';

export const MainContent = () => (
    <div id="main-content" className="main-content">
        <div className="flex flex-col items-center justify-center">
            <LogoIcon viewBox="0 0 441 409" width="128" height="128" />
            <h1 className="text-bone text-md font-bold text-center">RGBOO</h1>
        </div>
        <div className="flex flex-col md:flex-row-reverse justify-center md:items-center space-y-12">
            {/* placeholder until we get stream up :) */}
            <div className="w-100% h-100% md:flex-grow aspect-3/2 bg-bone" />
            <ColorForm />
        </div>
    </div>
)