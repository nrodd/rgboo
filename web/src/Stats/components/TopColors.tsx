import type { TopColor } from "../stats-api";
import { formatCount, formatShare } from "../format";

/**
 * Ranked bars for the month's most-picked colour families.
 *
 * The bar wears the colour because here the colour *is* the category; the
 * label and the value stay in text ink beside it, so identity never rests
 * on hue alone.
 */
export const TopColors = ({ colors }: { colors: TopColor[] }) => {
  const widest = colors[0]?.share ?? 1;

  return (
    <section className="stats-card p-6" aria-labelledby="top-colours-heading">
      <p className="stats-eyebrow">Crowd favourites</p>
      <h2 id="top-colours-heading" className="stats-heading mt-1">
        Most-picked colours
      </h2>

      {colors.length === 0 ? (
        <p className="stats-note mt-6">
          No colours in this window yet.
        </p>
      ) : (
        <ol className="mt-6 flex flex-col gap-4">
          {colors.map((color) => (
            <li key={color.key} className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="stats-swatch h-8 w-8 rounded-xl"
                style={{ backgroundColor: color.hex ?? "transparent" }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="stats-ink truncate text-[0.85rem] font-bold capitalize">
                    {color.label}
                  </p>
                  <p className="stats-muted shrink-0 text-[0.75rem] font-medium tabular-nums">
                    {formatCount(color.count)} · {formatShare(color.share)}
                  </p>
                </div>
                <div className="stats-track mt-2">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(3, (color.share / widest) * 100)}%`,
                      backgroundColor: color.hex ?? "#e36810",
                    }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
};
