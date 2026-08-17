import CountdownSection from "../components/CountdownSection";
import LogoIconSrc from "../assets/pumpkin.svg";
import * as React from "react";
const LogoIcon = LogoIconSrc as unknown as React.ComponentType<any>;

export const MainContent = () => (
  <div id="main-content" className="main-content">
    <div className="flex sm:flex-col items-center sm:justify-center gap-4 mt-12">
      <LogoIcon viewBox="0 0 441 409" className="w-10 h-10 sm:w-24 sm:h-24" />
      <h1 className="m-0 leading-none text-bone text-sm sm:text-md font-bold text-center translate-y-1 sm:translate-y-0">
        RGBOO
      </h1>
    </div>
    <CountdownSection />
  </div>
);
