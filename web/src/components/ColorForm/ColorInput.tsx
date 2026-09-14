import { useField } from "formik";

type RgbColor = { r: number; g: number; b: number };

const componentToHex = (value: number) =>
  Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");

const rgbToHex = ({ r, g, b }: RgbColor) =>
  `#${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`;

const hexToRgb = (hex: string): RgbColor => ({
  r: Number.parseInt(hex.slice(1, 3), 16),
  g: Number.parseInt(hex.slice(3, 5), 16),
  b: Number.parseInt(hex.slice(5, 7), 16),
});

export const ColorInput = () => {
  const [, { value }, { setValue }] = useField<RgbColor>("color");
  const hexValue = rgbToHex(value);

  return (
    <div className="color-input">
      <div className="dial-surround">
        <input
          id="color-dial"
          type="color"
          aria-label="Color picker"
          value={hexValue}
          onChange={(event) => setValue(hexToRgb(event.target.value))}
        />
      </div>
      <output htmlFor="color-dial" aria-live="polite">
        {hexValue.toUpperCase()}
      </output>
    </div>
  );
};

export default ColorInput;
