// SI-assisted: written with Claude (Anthropic), reviewed by the Space Monkeys team. See README.
// Which months of EVERY year are counted. The periods A and B are whole years; this window
// is applied inside each of those years (e.g. Jul–Oct 2003, Jul–Oct 2004, …), never as one
// span from a month of the first year to a month of the last. A strip of the 12 months:
// click the first month, then the last; the sentence under it says what is counted.
import { useEffect, useState } from "react";
import {
  ALL_MONTHS,
  isAllYear,
  MONTHS,
  monthsLabel,
  windowMonths,
  type MonthRange,
} from "../model/territory";

const FULL = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export default function SeasonPicker({
  value,
  onChange,
  firstYear,
  lastYear,
}: {
  value: MonthRange;
  onChange: (m: MonthRange) => void;
  firstYear: number | null;
  lastYear: number | null;
}) {
  // The first click picks the first month; the second click closes the window.
  const [pending, setPending] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    if (pending === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPending(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending]);

  const shown: MonthRange = pending !== null ? { from: pending, to: hover ?? pending } : value;
  const inside = new Set(windowMonths(shown));
  const whole = pending === null && isAllYear(value);

  const pick = (k: number) => {
    if (pending === null) {
      setPending(k);
      return;
    }
    onChange({ from: pending, to: k });
    setPending(null);
  };

  return (
    <div className="hw-field tr-season">
      <span id="tr-season-label">Months counted in each year</span>
      <div className="tr-season-row">
        <button
          type="button"
          className={`tr-season-all ${whole ? "on" : ""}`}
          aria-pressed={whole}
          onClick={() => {
            setPending(null);
            onChange(ALL_MONTHS);
          }}
        >
          All
        </button>
        <div
          className={`tr-months ${pending !== null ? "picking" : ""}`}
          role="group"
          aria-labelledby="tr-season-label"
          onMouseLeave={() => setHover(null)}
        >
          {MONTHS.map((m, i) => {
            const k = i + 1;
            const on = !whole && inside.has(k);
            const edge = on && (k === shown.from || k === shown.to);
            return (
              <button
                key={m}
                type="button"
                className={`tr-month ${on ? "on" : ""} ${edge ? "edge" : ""}`}
                aria-pressed={on}
                aria-label={
                  pending === null
                    ? `${FULL[i]}: start the window here`
                    : `${FULL[i]}: end the window here`
                }
                onMouseEnter={() => setHover(k)}
                onFocus={() => setHover(k)}
                onClick={() => pick(k)}
              >
                {m}
              </button>
            );
          })}
        </div>
      </div>
      <small className="tr-season-note" aria-live="polite">
        {note(pending, value, firstYear, lastYear)}
      </small>
    </div>
  );
}

function note(
  pending: number | null,
  value: MonthRange,
  firstYear: number | null,
  lastYear: number | null,
): string {
  if (pending !== null)
    return `Now click the last month. Click ${MONTHS[pending - 1]} again for that month alone; Esc cancels.`;
  if (isAllYear(value)) return "The whole calendar year, January to December, in every year.";
  const label = monthsLabel(value);
  const y0 = firstYear ?? 2003;
  const y1 = lastYear ?? y0 + 2;
  if (value.from > value.to)
    // A window across the new year is counted for the year it ends in.
    return `Only ${label} of each year, across the new year: ${MONTHS[value.from - 1]} ${y0 - 1}–${MONTHS[value.to - 1]} ${y0} counts as ${y0}.`;
  return `Only ${label} inside every year: ${label} ${y0}, ${label} ${y0 + 1}, … ${label} ${y1}. Not one span from ${MONTHS[value.from - 1]} ${y0} to ${MONTHS[value.to - 1]} ${y1}.`;
}
