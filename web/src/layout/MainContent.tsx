import LogoIcon from "../assets/pumpkin.svg?react";
import ColorForm from "../components/ColorForm";
import { StreamEmbed } from "../components/StreamEmbed";

export const MainContent = () => (
  <div className="main-content">
    <div className="flex lg:absolute py-4 left-0 right-0 justify-center items-center gap-4 z-50">
      <LogoIcon viewBox="0 0 441 409" className="w-10 h-10 sm:w-24 sm:h-24" />
      <h1 className="leading-none text-bone text-sm sm:text-md font-bold">
        RGBOO
      </h1>
    </div>
    <div>
      <StreamEmbed />
    </div>
    <div className="lg:absolute lg:bottom-0 lg:right-0 md:w-auto md:flex-shrink-0 w-full mt-12 mb-16 z-40">
      <ColorForm />
    </div>
  </div>
);
