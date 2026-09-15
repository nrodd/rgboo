import { useField } from "formik";
import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useState,
} from "react";

type RgbColor = { r: number; g: number; b: number };
type HsvColor = { h: number; s: number; v: number };

const componentToHex = (value: number) =>
  Math.max(0, Math.min(255, Math.round(value)))
    .toString(16)
    .padStart(2, "0");

const rgbToHex = ({ r, g, b }: RgbColor) =>
  `#${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`;

const hexToRgb = (hex: string): RgbColor => ({
  r: Number.parseInt(hex.slice(1, 3), 16),
  g: Number.parseInt(hex.slice(3, 5), 16),
  b: Number.parseInt(hex.slice(5, 7), 16),
});

const rgbToHsv = ({ r, g, b }: RgbColor): HsvColor => {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;

  if (delta !== 0) {
    if (max === red) hue = 60 * (((green - blue) / delta) % 6);
    if (max === green) hue = 60 * ((blue - red) / delta + 2);
    if (max === blue) hue = 60 * ((red - green) / delta + 4);
  }

  return {
    h: (hue + 360) % 360,
    s: max === 0 ? 0 : delta / max,
    v: max,
  };
};

const hsvToRgb = ({ h, s, v }: HsvColor): RgbColor => {
  const chroma = v * s;
  const hueSection = h / 60;
  const secondary = chroma * (1 - Math.abs((hueSection % 2) - 1));
  const offset = v - chroma;
  let red = 0;
  let green = 0;
  let blue = 0;

  if (hueSection < 1) [red, green, blue] = [chroma, secondary, 0];
  else if (hueSection < 2) [red, green, blue] = [secondary, chroma, 0];
  else if (hueSection < 3) [red, green, blue] = [0, chroma, secondary];
  else if (hueSection < 4) [red, green, blue] = [0, secondary, chroma];
  else if (hueSection < 5) [red, green, blue] = [secondary, 0, chroma];
  else [red, green, blue] = [chroma, 0, secondary];

  return {
    r: Math.round((red + offset) * 255),
    g: Math.round((green + offset) * 255),
    b: Math.round((blue + offset) * 255),
  };
};

export const ColorInput = () => {
  const [, { value }, { setTouched, setValue }] = useField<RgbColor>("color");
  const hexValue = rgbToHex(value).toUpperCase();
  const [hexDraft, setHexDraft] = useState(hexValue);
  const hsvValue = rgbToHsv(value);
  const angle = ((hsvValue.h - 90) * Math.PI) / 180;
  const markerDistance = hsvValue.s * 46;
  const wheelStyle = {
    "--marker-x": `${50 + Math.cos(angle) * markerDistance}%`,
    "--marker-y": `${50 + Math.sin(angle) * markerDistance}%`,
    "--selected-color": hexValue,
  } as CSSProperties;

  useEffect(() => {
    setHexDraft(hexValue);
  }, [hexValue]);

  const chooseColor = (
    clientX: number,
    clientY: number,
    wheel: HTMLButtonElement,
  ) => {
    const bounds = wheel.getBoundingClientRect();
    const radius = Math.min(bounds.width, bounds.height) / 2;
    const x = clientX - bounds.left - bounds.width / 2;
    const y = clientY - bounds.top - bounds.height / 2;
    const saturation = Math.min(1, Math.hypot(x, y) / radius);
    const hue = (Math.atan2(y, x) * (180 / Math.PI) + 450) % 360;

    void setValue(hsvToRgb({ h: hue, s: saturation, v: 1 }));
  };

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    chooseColor(event.clientX, event.clientY, event.currentTarget);
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      chooseColor(event.clientX, event.clientY, event.currentTarget);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = event.shiftKey ? 10 : 2;
    let nextHue = hsvValue.h;
    let nextSaturation = hsvValue.s;

    if (event.key === "ArrowLeft") nextHue = (nextHue - step + 360) % 360;
    else if (event.key === "ArrowRight") nextHue = (nextHue + step) % 360;
    else if (event.key === "ArrowUp") {
      nextSaturation = Math.min(1, nextSaturation + step / 100);
    } else if (event.key === "ArrowDown") {
      nextSaturation = Math.max(0, nextSaturation - step / 100);
    } else {
      return;
    }

    event.preventDefault();
    void setValue(hsvToRgb({ h: nextHue, s: nextSaturation, v: 1 }));
  };

  const handleHexChange = (nextValue: string) => {
    const upperValue = nextValue.toUpperCase();
    const normalizedValue = upperValue.startsWith("#")
      ? upperValue
      : `#${upperValue}`;

    if (!/^#[0-9A-F]{0,6}$/.test(normalizedValue)) return;

    setHexDraft(normalizedValue);
    if (/^#[0-9A-F]{6}$/.test(normalizedValue)) {
      void setValue(hexToRgb(normalizedValue));
    }
  };

  return (
    <div className="color-input">
      <div className="wheel-dial-surround">
        <button
          id="color-dial"
          type="button"
          className="color-wheel"
          aria-label={`Color picker, ${hexValue}`}
          style={wheelStyle}
          onBlur={() => void setTouched(true)}
          onKeyDown={handleKeyDown}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
        >
          <span className="color-wheel-marker" aria-hidden="true" />
        </button>
      </div>

      <label className="hex-editor" htmlFor="color-hex">
        <span>HEX</span>
        <input
          id="color-hex"
          type="text"
          value={hexDraft}
          maxLength={7}
          aria-label="Hex color"
          autoComplete="off"
          spellCheck={false}
          onBlur={() => {
            setHexDraft(hexValue);
            void setTouched(true);
          }}
          onChange={(event) => handleHexChange(event.currentTarget.value)}
        />
      </label>
    </div>
  );
};

export default ColorInput;
