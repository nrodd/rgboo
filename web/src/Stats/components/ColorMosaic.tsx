import type { ColorRow } from "../stats-api";
import { formatCount, formatShare, pluralise } from "../format";

/**
 * Every colour people picked, one square per submission, in arrival order.
 *
 * Nothing is encoded and nothing is reordered: the mosaic is the month as it
 * happened. Popularity is not meant to be read off it -- the family bar
 * underneath carries that, in numbers. See docs/stats-heatmap.md.
 */

type Props = {
  sequence: string[];
  colors: ColorRow[];
  total: number;
  sampled: boolean;
};

export const ColorMosaic = ({ sequence, colors, total, sampled }: Props) => (
  <section className="stats-card" aria-labelledby="mosaic-heading">
    <div className="stats-card-head px-6 py-5">
      <p className="stats-eyebrow">The month in colour</p>
      <h2 id="mosaic-heading" className="stats-heading mt-1">
        Every colour picked
      </h2>
      <p className="stats-note mt-2 max-w-2xl">
        One square per colour someone sent, in the order they arrived.
        {sampled && ` Thinned to fit — every ${Math.round(total / sequence.length)}th pick is shown.`}
      </p>
    </div>

    <div
      className="stats-mosaic"
      role="img"
      aria-label={`A mosaic of ${pluralise(total, "colour")} picked by the community, in the order they arrived. The breakdown is in the table below.`}
    >
      {sequence.map((hex, index) => (
        <span key={index} className="stats-chip" style={{ backgroundColor: hex }} />
      ))}
    </div>
    <FamilyBar colors={colors} />
  </section>
);

/**
 * A single stacked bar of the coarse colour families.
 *
 * The mosaic deliberately says nothing about which colour won. This is
 * where that question gets an exact answer, without a row per family.
 */
const FamilyBar = ({ colors }: { colors: ColorRow[] }) => {
  if (!colors.length) return null;

  return (
    <div className="stats-family-row px-6 py-5">
      <div className="stats-family-bar">
        {colors.map((color) => (
          <span
            key={color.key}
            className="stats-family-seg"
            style={{ backgroundColor: color.hex ?? "transparent", flexGrow: color.count }}
            title={`${color.label}: ${formatCount(color.count)} (${formatShare(color.share)})`}
          />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {colors.slice(0, 6).map((color) => (
          <li key={color.key} className="flex items-center gap-2 text-[0.72rem] font-bold">
            <span
              aria-hidden="true"
              className="stats-swatch h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: color.hex ?? "transparent" }}
            />
            <span className="stats-ink capitalize">{color.label}</span>
            <span className="stats-faint tabular-nums">{formatShare(color.share)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
