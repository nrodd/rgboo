import LogoIcon from "../assets/pumpkin.svg?react";
import ColorForm from "../components/ColorForm";
import { StreamEmbed } from "../components/StreamEmbed";

export const MainContent = () => (
  <main className="scene-page">
    <header className="scene-header">
      <LogoIcon viewBox="0 0 441 409" className="w-10 h-10" />
      <h1>
        RGBOO
      </h1>
    </header>
    <div className="scene-workspace">
      <StreamEmbed />
      <aside className="scene-participation" aria-label="Choose a color">
        <ColorForm />
      </aside>
    </div>
  </main>
);
