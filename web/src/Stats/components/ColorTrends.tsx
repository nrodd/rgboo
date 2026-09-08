import { useCallback, useRef, useState } from "react";
import type { ColorRow, StatsDay } from "../stats-api";
import {
  INTENSITY_STEPS,
  formatCount,
  formatDayLong,
  formatDayShort,
  formatShare,
  hexToRgba,
  intensityFor,
  pluralise,
  rampHex,
} from "../format";

/**
 * Colour x day: one row per colour family, one column per day.
 *
 * This replaced a day x hour grid whose cells were painted with each hour's
 * most-picked colour and dimmed by volume. That encoding could not work:
 * brightness carried the count, but brightness is also an intrinsic
 * property of a colour the audience chose, so a busy hour of near-black
 * rendered darker than a quiet hour of white -- the scale ran backwards.
 *
 * Here a row is one fixed hue, so light-to-dark within it means only "more
 * of this colour", which is the one arrangement where a sequential ramp is
 * honest. Nothing asks the reader to compare two hues by brightness: the
 * ranking is the row order, stated again as a count and a share in text.
 */

/** Enough columns that the date ticks never collide, whatever the range. */
const dayTickEvery = (count: number) => Math.max(1, Math.ceil(count / 8));

const isDayTick = (column: number, total: number, every: number) => {
  const last = total - 1;
  if (column === last) return true;
  if (column % every !== 0) return false;
  return last - column >= every;
};

type HoverState = { row: ColorRow; day: StatsDay; count: number; x: number; y: number };

type Props = {
  grid: StatsDay[];
  colors: ColorRow[];
  peak: number;
  isRefreshing: boolean;
};

export const ColorTrends = ({ grid, colors, peak, isRefreshing }: Props) => {
  const [hover, setHover] = useState<HoverState | null>(null);
  // Roving tabindex: one tab stop for the grid, arrow keys move within it.
  // A stop per cell would bury the rest of the page.
  const [cursor, setCursor] = useState({ row: 0, column: 0 });
  const gridRef = useRef<HTMLDivElement>(null);

  const show = useCallback(
    (element: HTMLElement, row: ColorRow, day: StatsDay, count: number) => {
      const box = element.getBoundingClientRect();
      setHover({ row, day, count, x: box.left + box.width / 2, y: box.top });
    },
    [],
  );

  const onKeyDown = useCallback((event: React.KeyboardEvent) => {
    const moves: Record<string, [number, number]> = {
      ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0],
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();

    const row = Math.min(colors.length - 1, Math.max(0, cursor.row + move[0]));
    const column = Math.min(grid.length - 1, Math.max(0, cursor.column + move[1]));
    setCursor({ row, column });
    requestAnimationFrame(() => {
      gridRef.current?.querySelector<HTMLElement>(`[data-cell="${row}-${column}"]`)?.focus();
    });
  }, [colors.length, grid.length, cursor]);

  if (!grid.length) return null;

  const tickEvery = dayTickEvery(grid.length);

  return (
    <section className="stats-card" aria-labelledby="trends-heading">
      <div className="stats-card-head flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="stats-eyebrow">The month in colour</p>
          <h2 id="trends-heading" className="stats-heading mt-1">
            Which colours people picked
          </h2>
          <p className="stats-note mt-2 max-w-xl">
            One row per colour, busiest at the top. Each square is a day, and it
            deepens the more that colour was picked — every row is a single
            shade, so darker always means more of it.
          </p>
        </div>
        <IntensityLegend peak={peak} />
      </div>

      {colors.length === 0 ? (
        <p className="stats-note px-6 py-8">No colours in this window yet.</p>
      ) : (
        <div className="overflow-x-auto px-6 py-6">
          <div
            ref={gridRef}
            role="grid"
            aria-label={`Colours picked per day, ${formatDayLong(grid[0].date)} to ${formatDayLong(grid[grid.length - 1].date)}`}
            className={`stats-trends ${isRefreshing ? "opacity-60" : ""}`}
            style={{ gridTemplateColumns: `auto repeat(${grid.length}, var(--cell)) auto` }}
            onKeyDown={onKeyDown}
            onMouseLeave={() => setHover(null)}
          >
            {colors.map((row, rowIndex) => (
              <div role="row" key={row.key} className="contents">
                <div role="rowheader" className="stats-trend-name">
                  <span
                    aria-hidden="true"
                    className="stats-swatch stats-trend-swatch"
                    style={{ backgroundColor: row.hex ?? "transparent" }}
                  />
                  <span className="capitalize">{row.label}</span>
                </div>

                {grid.map((day, column) => {
                  const count = day.colors[row.key] ?? 0;
                  const isCursor = cursor.row === rowIndex && cursor.column === column;
                  return (
                    <div
                      key={day.date}
                      role="gridcell"
                      data-cell={`${rowIndex}-${column}`}
                      tabIndex={isCursor ? 0 : -1}
                      aria-label={
                        count
                          ? `${row.label}, ${formatDayLong(day.date)}, ${pluralise(count, "colour")}`
                          : `${row.label}, ${formatDayLong(day.date)}, none`
                      }
                      className={`stats-cell ${count ? "stats-cell--on" : ""}`}
                      style={
                        count && row.hex
                          ? {
                              backgroundColor: hexToRgba(
                                rampHex(row.hex),
                                intensityFor(count, peak),
                              ),
                            }
                          : undefined
                      }
                      onMouseEnter={(event) => show(event.currentTarget, row, day, count)}
                      onFocus={(event) => {
                        setCursor({ row: rowIndex, column });
                        show(event.currentTarget, row, day, count);
                      }}
                      onBlur={() => setHover(null)}
                    />
                  );
                })}

                {/* The ranking lives here, in text, so nobody has to infer it
                    by comparing one hue's brightness against another's. */}
                <div className="stats-trend-total">
                  <span className="stats-ink">{formatCount(row.count)}</span>
                  <span className="stats-faint"> · {formatShare(row.share)}</span>
                </div>
              </div>
            ))}

            {/* The date axis, inside the grid so it scrolls with the cells. */}
            <div role="row" className="contents">
              <div role="rowheader" className="stats-trend-name" />
              {grid.map((day, column) => (
                <div key={day.date} role="columnheader" className="stats-day-tick">
                  {isDayTick(column, grid.length, tickEvery) ? formatDayShort(day.date) : ""}
                </div>
              ))}
              <div />
            </div>
          </div>
        </div>
      )}

      {hover && <TrendTooltip hover={hover} />}
    </section>
  );
};

const TrendTooltip = ({ hover }: { hover: HoverState }) => (
  <div role="tooltip" className="stats-tooltip" style={{ left: hover.x, top: hover.y }}>
    {/* Value leads, label follows: the reader has the cell and wants the number. */}
    <p className="stats-ink text-lg font-bold leading-none">
      {hover.count ? pluralise(hover.count, "colour") : "None"}
    </p>
    <p className="stats-muted mt-1.5 flex items-center gap-2 text-[0.7rem] font-medium">
      <span
        aria-hidden="true"
        className="stats-swatch h-3 w-3 rounded-full"
        style={{ backgroundColor: hover.row.hex ?? "transparent" }}
      />
      <span className="capitalize">{hover.row.label}</span>
      {hover.row.hex && <span className="stats-faint">{hover.row.hex}</span>}
    </p>
    <p className="stats-faint mt-1 text-[0.7rem] font-medium">
      {formatDayLong(hover.day.date)} · {pluralise(hover.day.count, "colour")} that night
    </p>
  </div>
);

const IntensityLegend = ({ peak }: { peak: number }) => (
  <div className="flex shrink-0 items-center gap-3">
    <span className="stats-faint text-[0.7rem] font-bold uppercase tracking-wider">Less</span>
    <div className="flex gap-[2px]">
      <span className="stats-cell" aria-hidden="true" />
      {INTENSITY_STEPS.map((step) => (
        <span
          key={step}
          aria-hidden="true"
          className="stats-cell stats-cell--on"
          // A neutral grey, not a theme colour: the legend is about depth,
          // and each row applies that depth to its own hue. Anything with a
          // hue here would read as a fourteenth colour row.
          style={{ backgroundColor: hexToRgba("#c9c7d2", step) }}
        />
      ))}
    </div>
    <span className="stats-faint text-[0.7rem] font-bold uppercase tracking-wider">
      More{peak ? ` (${peak}/day)` : ""}
    </span>
  </div>
);
