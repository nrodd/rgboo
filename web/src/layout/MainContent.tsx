import ColorForm from "../components/ColorForm";
import InfoButton from "../components/InfoButton";
import { StreamEmbed } from "../components/StreamEmbed";
import { Footer } from "./Footer";

export const MainContent = () => (
  <main id="main-content" className="main-content">
    <section className="tv-set" aria-label="RGBOO live color television">
      <div className="cabinet-highlight" aria-hidden="true" />

      <header className="tv-header">
        <div className="brand-plate">
          <div>
            <h1>RGBOO</h1>
            <p>Colorcast receiver</p>
          </div>
        </div>
        <div className="channel-readout" aria-label="Channel 31">
          <span>CH</span>
          <strong>31</strong>
        </div>
      </header>

      <div className="tv-face">
        <div className="screen-bezel">
          <div className="screen-window">
            <StreamEmbed />
            <div className="screen-effects" aria-hidden="true" />
            <div className="on-air-bug" aria-hidden="true">
              <span /> LIVE
            </div>
          </div>
        </div>

        <aside className="control-panel" aria-label="Television controls">
          <div className="panel-heading">
            <p>Viewer control</p>
            <span>COLOR•TRONIC</span>
          </div>

          <ColorForm />

          <div className="speaker" aria-label="Speaker grille" role="img">
            {Array.from({ length: 21 }, (_, index) => (
              <span key={index} />
            ))}
          </div>

          <div className="panel-badges" aria-hidden="true">
            <span>REMOTE</span>
            <span>SOLID STATE</span>
          </div>
        </aside>
      </div>

      <footer className="tv-footer">
        <div className="vent" aria-hidden="true" />
        <p>Live interactive broadcast system</p>
        <div className="tv-footer-actions">
          <div className="power-light" aria-label="Television powered on">
            <span /> POWER
          </div>
          <Footer />
          <InfoButton />
        </div>
      </footer>
    </section>
  </main>
);
