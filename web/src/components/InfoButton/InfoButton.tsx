import { useState } from "react";
import InfoIcon from "../../assets/info.svg?react";
import { useScreenSize } from "../../libs/useScreenSize";

const SM = "32";
const LG = "48";

export const InfoButton = () => {
  const [showTooltip, setShowTooltip] = useState(false);
  const { isMobile } = useScreenSize();

  return (
    <div
      className="info-icon"
      data-testid="info-button"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <button
        type="button"
        aria-label="About RGBOO"
        aria-expanded={showTooltip}
        onClick={() => setShowTooltip((isVisible) => !isVisible)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
      >
        <InfoIcon
          viewBox="0 0 64 64"
          width={isMobile ? SM : LG}
          height={isMobile ? SM : LG}
        />
      </button>

      {showTooltip && (
        <div className="info-tooltip" role="tooltip">
          <div>
            <h3>The project</h3>
            <p>
              This project controls a physical LED strip in real-time! When you
              submit a color, it gets added to a queue.
            </p>
            <p>
              Your color will light up the pumpkin for a few seconds when it's
              your turn. Watch the stream to see your color come to life!
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default InfoButton;
