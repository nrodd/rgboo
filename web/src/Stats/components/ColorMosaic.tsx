import type { ColorRow } from "../stats-api";
import { formatCount, formatShare, pluralise } from "../format";

/**
 * Every colour people picked, one square per submission, in arrival order.
 *
 * This replaced two grids that both encoded a count as the brightness of a
 * cell. That can never work here: brightness is also an intrinsic property
 * of a colour the audience chose, so the two meanings collide and the scale
 * can run backwards.
 *
 * Nothing is encoded here at all, and nothing is reordered. The mosaic is
 * the month exactly as it happened, read left to right. Popularity is not
 * meant to be read off it -- the family bar underneath carries that, in
 * numbers.
 */

type Props = {
  sequence: string[];
  colors: ColorRow[];
  total: number;
  sampled: boolean;
  isRefreshing: boolean;
};

export const ColorMosaic = ({ sequence, colors, total, sampled, isRefreshing }: Props) => (
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

    {sequence.length === 0 ? (
      <p className="stats-note px-6 py-8">No colours in this window yet.</p>
    ) : (
      <>
        {/* No hover layer: the squares are the record, and every number a
            reader might want is in the family bar below or the table
            further down. Nothing here has to be hovered to be reached. */}
        <div
          className={`stats-mosaic ${isRefreshing ? "opacity-60" : ""}`}
          role="img"
          aria-label={`A mosaic of ${pluralise(total, "colour")} picked by the community, in the order they arrived. The breakdown is in the table below.`}
        >
          {sequence.map((hex, index) => (
            <span key={index} className="stats-chip" style={{ backgroundColor: hex }} />
          ))}
        </div>
        <FamilyBar colors={colors} />
      </>
    )}
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
