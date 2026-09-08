import { useMemo, useState } from "react";
import type { ColorRow, Swatch } from "../stats-api";
import { formatCount, formatShare, pluralise } from "../format";

/**
 * Every colour people picked, one square per submission, ordered by hue.
 *
 * This replaced two earlier attempts, both of which encoded a count as the
 * brightness of a cell. That can never work here: brightness is also an
 * intrinsic property of a colour the audience chose, so the two meanings
 * collide and the scale can run backwards.
 *
 * Nothing is encoded here at all. A colour picked forty times gets forty
 * squares, so popularity is simply how much of the mosaic it occupies, and
 * sorting by hue turns the pile into a spectrum. It also stops binning
 * shades into fourteen named families -- every shade shows as itself.
 */

/** Cap on rendered squares, so a very busy month cannot bloat the DOM. */
const MAX_CELLS = 4000;

type Cell = { hex: string; n: number };

/**
 * Expand counts into one cell per submission.
 *
 * Past the cap the whole mosaic is scaled down by a single factor, which
 * keeps every colour's share of the picture intact; the caption says the
 * true total either way. Colours that round away are kept at one cell
 * rather than dropped, so a rare colour never vanishes.
 */
const toCells = (swatches: Swatch[], total: number) => {
  const scale = total > MAX_CELLS ? MAX_CELLS / total : 1;
  const cells: Cell[] = [];
  swatches.forEach((swatch) => {
    const repeats = scale === 1 ? swatch.n : Math.max(1, Math.round(swatch.n * scale));
    for (let index = 0; index < repeats; index += 1) {
      cells.push({ hex: swatch.hex, n: swatch.n });
    }
  });
  return { cells, scaled: scale !== 1 };
};

type Props = {
  swatches: Swatch[];
  colors: ColorRow[];
  total: number;
  isRefreshing: boolean;
};

export const ColorMosaic = ({ swatches, colors, total, isRefreshing }: Props) => {
  const { cells, scaled } = useMemo(() => toCells(swatches, total), [swatches, total]);
  const [hover, setHover] = useState<(Cell & { x: number; y: number }) | null>(null);

  // One delegated listener rather than a handler per square: at a few
  // thousand cells, per-cell handlers are the expensive part.
  const onPointer = (event: React.PointerEvent) => {
    const cell = (event.target as HTMLElement).closest<HTMLElement>("[data-hex]");
    if (!cell) {
      setHover(null);
      return;
    }
    const box = cell.getBoundingClientRect();
    setHover({
      hex: cell.dataset.hex as string,
      n: Number(cell.dataset.n),
      x: box.left + box.width / 2,
      y: box.top,
    });
  };

  return (
    <section className="stats-card" aria-labelledby="mosaic-heading">
      <div className="stats-card-head px-6 py-5">
        <p className="stats-eyebrow">The month in colour</p>
        <h2 id="mosaic-heading" className="stats-heading mt-1">
          Every colour picked
        </h2>
        <p className="stats-note mt-2 max-w-2xl">
          One square per colour someone sent, arranged around the colour wheel.
          The wider a band, the more people picked that shade.
          {scaled && ` Scaled to fit — each square stands for about ${Math.round(total / MAX_CELLS)} picks.`}
        </p>
      </div>

      {cells.length === 0 ? (
        <p className="stats-note px-6 py-8">No colours in this window yet.</p>
      ) : (
        <>
          <div
            className={`stats-mosaic ${isRefreshing ? "opacity-60" : ""}`}
            role="img"
            aria-label={`A mosaic of ${pluralise(total, "colour")} picked by the community, arranged by hue. The full breakdown is in the table below.`}
            onPointerMove={onPointer}
            onPointerLeave={() => setHover(null)}
          >
            {cells.map((cell, index) => (
              <span
                key={index}
                className="stats-chip"
                data-hex={cell.hex}
                data-n={cell.n}
                style={{ backgroundColor: cell.hex }}
              />
            ))}
          </div>
          <FamilyBar colors={colors} />
        </>
      )}

      {hover && (
        <div role="tooltip" className="stats-tooltip" style={{ left: hover.x, top: hover.y }}>
          <p className="stats-ink text-lg font-bold leading-none">
            {pluralise(hover.n, "pick")}
          </p>
          <p className="stats-muted mt-1.5 flex items-center gap-2 text-[0.7rem] font-medium">
            <span
              aria-hidden="true"
              className="stats-swatch h-3 w-3 rounded-full"
              style={{ backgroundColor: hover.hex }}
            />
            {hover.hex}
          </p>
        </div>
      )}
    </section>
  );
};

/**
 * A single stacked bar of the coarse colour families.
 *
 * The mosaic shows dominance as area, which is a good glance but not a
 * number. This keeps an exact ranking on the page without reintroducing a
 * row per family.
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
