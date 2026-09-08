import { useCallback, useMemo, useRef, useState } from "react";
import type { StatsDay } from "../stats-api";
import {
  INTENSITY_STEPS,
  formatDayLong,
  formatDayShort,
  formatHour,
  hexToRgba,
  intensityFor,
  pluralise,
} from "../format";

const ALL_HOURS = Array.from({ length: 24 }, (_, hour) => hour);
// A tick on every row is chrome competing with the data, but a trimmed
// band is short enough to carry more of them.
const hourTickEvery = (rows: number) => (rows <= 12 ? 2 : 3);

/**
 * The hours worth drawing, padded by one either side.
 *
 * A stream that only ever runs in the evening leaves two thirds of a
 * 24-row grid permanently blank, which pushes the actual data into a
 * strip at the bottom. Trimming to the hours that have ever seen a colour
 * gives the data the card, and the header says what was left out so the
 * grid never implies the small hours were busy.
 */
const visibleHours = (grid: StatsDay[]) => {
  let first = 24;
  let last = -1;
  grid.forEach((day) =>
    day.hours.forEach((cell) => {
      if (cell.n <= 0) return;
      first = Math.min(first, cell.h);
      last = Math.max(last, cell.h);
    }),
  );
  if (last < 0) return { hours: ALL_HOURS, trimmed: false };

  const from = Math.max(0, first - 1);
  const to = Math.min(23, last + 1);
  const hours = ALL_HOURS.slice(from, to + 1);
  return { hours, trimmed: hours.length < ALL_HOURS.length };
};

/** "12 AM-3 PM and 11 PM" -- names only the bands actually left out. */
const hiddenHoursNote = (rows: number[]) => {
  const parts: string[] = [];
  const first = rows[0];
  const last = rows[rows.length - 1];
  if (first > 0) {
    parts.push(first === 1 ? formatHour(0) : `${formatHour(0)}\u2013${formatHour(first - 1)}`);
  }
  if (last < 23) {
    parts.push(last === 22 ? formatHour(23) : `${formatHour(last + 1)}\u2013${formatHour(23)}`);
  }
  if (!parts.length) return "";
  return ` Hours with no colours all window (${parts.join(" and ")}) are hidden.`;
};

type Cell = { n: number; hex?: string; label?: string };
type HoverState = { day: StatsDay; hour: number; cell: Cell; x: number; y: number };

/** Day id -> hour -> cell, so the grid can render straight through. */
const indexGrid = (grid: StatsDay[]) =>
  grid.map((day) => {
    const hours = new Map<number, Cell>();
    day.hours.forEach((cell) => hours.set(cell.h, cell));
    return { day, hours };
  });

/** Enough columns that the ticks don't collide, whatever the range. */
const dayTickEvery = (count: number) => Math.max(1, Math.ceil(count / 8));

/**
 * Which columns get a date label. The last column is always labelled --
 * a reader needs to know where the range ends -- but only if it is far
 * enough from the previous tick to not print on top of it.
 */
const isDayTick = (column: number, total: number, every: number) => {
  const last = total - 1;
  if (column === last) return true;
  if (column % every !== 0) return false;
  return last - column >= every;
};

type Props = {
  grid: StatsDay[];
  peak: number;
  timezone: string;
  isRefreshing: boolean;
};

export const ColorHeatmap = ({ grid, peak, timezone, isRefreshing }: Props) => {
  const columns = useMemo(() => indexGrid(grid), [grid]);
  const { hours: rows, trimmed } = useMemo(() => visibleHours(grid), [grid]);
  const [hover, setHover] = useState<HoverState | null>(null);
  // Roving tabindex: one stop for the whole grid, arrow keys move inside it.
  // 720 individual tab stops would make the rest of the page unreachable.
  const [cursor, setCursor] = useState({ column: 0, hour: 20 });
  const gridRef = useRef<HTMLDivElement>(null);

  const show = useCallback((element: HTMLElement, day: StatsDay, hour: number, cell: Cell) => {
    const box = element.getBoundingClientRect();
    setHover({ day, hour, cell, x: box.left + box.width / 2, y: box.top });
  }, []);

  const onKeyDown = useCallback((event: React.KeyboardEvent) => {
    const moves: Record<string, [number, number]> = {
      ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1],
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();

    const column = Math.min(columns.length - 1, Math.max(0, cursor.column + move[0]));
    // Clamp to the rendered band, not to 0-23: rows outside it have no cell
    // to focus, and stepping onto one would silently drop focus.
    const index = Math.max(0, rows.indexOf(cursor.hour));
    const hour = rows[Math.min(rows.length - 1, Math.max(0, index + move[1]))];
    setCursor({ column, hour });
    // The roving cell is re-rendered with tabIndex 0; move focus onto it so
    // keyboard and pointer surface the same tooltip.
    requestAnimationFrame(() => {
      gridRef.current
        ?.querySelector<HTMLElement>(`[data-cell="${column}-${hour}"]`)
        ?.focus();
    });
  }, [columns.length, cursor, rows]);

  if (!columns.length) return null;

  const tickEvery = dayTickEvery(columns.length);
  const hourTick = hourTickEvery(rows.length);
  // The default cursor hour may fall outside a trimmed band; without this
  // no cell would carry tabIndex 0 and the grid would be unreachable by Tab.
  const cursorHour = rows.includes(cursor.hour) ? cursor.hour : rows[rows.length - 1];

  return (
    <section className="stats-card" aria-labelledby="heatmap-heading">
      <div className="stats-card-head flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="stats-eyebrow">The month in colour</p>
          <h2 id="heatmap-heading" className="stats-heading mt-1">
            Every hour, every day
          </h2>
          <p className="stats-note mt-2 max-w-xl">
            Each square is one hour. Its colour is the shade most people picked in
            that hour, and it gets brighter the more colours came in. Times are{" "}
            {timezone.replace("_", " ")}.
            {trimmed && hiddenHoursNote(rows)}
          </p>
        </div>
        <IntensityLegend peak={peak} />
      </div>

      {/* The grid is wider than a phone; it scrolls inside this card so the
          page body never scrolls sideways. */}
      <div className="overflow-x-auto px-6 py-6">
        <div
          ref={gridRef}
          role="grid"
          aria-label={`Colours submitted by hour, ${formatDayLong(columns[0].day.date)} to ${formatDayLong(columns[columns.length - 1].day.date)}`}
          className={`stats-heatmap ${isRefreshing ? "opacity-60" : ""}`}
          style={{ gridTemplateColumns: `auto repeat(${columns.length}, var(--cell))` }}
          onKeyDown={onKeyDown}
          onMouseLeave={() => setHover(null)}
        >
          {rows.map((hour) => (
            <div role="row" key={hour} className="contents">
              <div role="rowheader" className="stats-hour-tick">
                {hour % hourTick === 0 ? formatHour(hour) : ""}
              </div>
              {columns.map(({ day, hours }, column) => {
                const cell = hours.get(hour);
                const count = cell?.n ?? 0;
                const isCursor = cursor.column === column && cursorHour === hour;
                return (
                  <div
                    key={day.date}
                    role="gridcell"
                    data-cell={`${column}-${hour}`}
                    tabIndex={isCursor ? 0 : -1}
                    aria-label={
                      count
                        ? `${formatDayLong(day.date)} ${formatHour(hour)}, ${pluralise(count, "colour")}, mostly ${cell?.label ?? cell?.hex}`
                        : `${formatDayLong(day.date)} ${formatHour(hour)}, no colours`
                    }
                    className={`stats-cell ${count ? "stats-cell--on" : ""}`}
                    style={
                      count && cell?.hex
                        ? { backgroundColor: hexToRgba(cell.hex, intensityFor(count, peak)) }
                        : undefined
                    }
                    onMouseEnter={(event) => show(event.currentTarget, day, hour, cell ?? { n: 0 })}
                    onFocus={(event) => {
                      setCursor({ column, hour });
                      show(event.currentTarget, day, hour, cell ?? { n: 0 });
                    }}
                    onBlur={() => setHover(null)}
                  />
                );
              })}
            </div>
          ))}

          {/* The day axis. Inside the grid, so it scrolls with the cells and
              is never clipped by the card. */}
          <div role="row" className="contents">
            <div role="rowheader" className="stats-hour-tick" />
            {columns.map(({ day }, column) => (
              <div key={day.date} role="columnheader" className="stats-day-tick">
                {isDayTick(column, columns.length, tickEvery) ? formatDayShort(day.date) : ""}
              </div>
            ))}
          </div>
        </div>
      </div>

      {hover && <HeatmapTooltip hover={hover} />}
    </section>
  );
};

const HeatmapTooltip = ({ hover }: { hover: HoverState }) => (
  <div
    role="tooltip"
    className="stats-tooltip"
    style={{ left: hover.x, top: hover.y }}
  >
    {/* Value leads, label follows: the reader already knows which cell they
        are on and wants the number. */}
    <p className="stats-ink text-lg font-bold leading-none">
      {hover.cell.n ? pluralise(hover.cell.n, "colour") : "No colours"}
    </p>
    <p className="stats-muted mt-1.5 text-[0.7rem] font-medium">
      {formatDayLong(hover.day.date)} · {formatHour(hover.hour)}
    </p>
    {hover.cell.hex && (
      <p className="stats-muted mt-2 flex items-center gap-2 text-[0.7rem] font-medium">
        <span
          className="stats-swatch h-3 w-3 rounded-full"
          style={{ backgroundColor: hover.cell.hex }}
        />
        mostly {hover.cell.label} · {hover.cell.hex}
      </p>
    )}
  </div>
);

const IntensityLegend = ({ peak }: { peak: number }) => (
  <div className="flex shrink-0 items-center gap-3">
    <span className="stats-faint text-[0.7rem] font-bold uppercase tracking-wider">
      Quieter
    </span>
    <div className="flex gap-[2px]">
      <span className="stats-cell" aria-hidden="true" />
      {INTENSITY_STEPS.map((step) => (
        <span
          key={step}
          aria-hidden="true"
          className="stats-cell stats-cell--on"
          style={{ backgroundColor: hexToRgba("#e36810", step) }}
        />
      ))}
    </div>
    <span className="stats-faint text-[0.7rem] font-bold uppercase tracking-wider">
      Busier{peak ? ` (${peak})` : ""}
    </span>
  </div>
);
