import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../../../shared/ui/ui";
import "./date-calendar.css";

import {
  DEFAULT_DATES,
  isDateRange,
  isoDate as iso,
  MONTHS as months,
  parseDate as date,
  resolveObservationPeriod,
} from "./date-range";
export default function DateCalendar({
  value,
  onApply,
  label = "Choose observation dates",
}: {
  value: string;
  onApply: (range: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"days" | "months" | "years">("days");
  const [cursor, setCursor] = useState(new Date(Date.UTC(2026, 7, 1)));
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [yearPage, setYearPage] = useState(2015);
  const root = useRef<HTMLDivElement>(null);
  const popup = useRef<HTMLElement>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("keydown", escape);
    popup.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    return () => document.removeEventListener("keydown", escape);
  }, [open]);
  useEffect(() => {
    const closeOnResize = () => setOpen(false);
    window.addEventListener("resize", closeOnResize);
    window.addEventListener("orbit-filter-open", closeOnResize);
    return () => {
      window.removeEventListener("resize", closeOnResize);
      window.removeEventListener("orbit-filter-open", closeOnResize);
    };
  }, []);
  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node) && !popup.current?.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  const year = cursor.getUTCFullYear(),
    month = cursor.getUTCMonth();
  const show = () => {
    window.dispatchEvent(new Event("orbit-filter-open"));
    const bounds = trigger.current!.getBoundingClientRect();
    setPosition({
      left: Math.max(16, Math.min(window.innerWidth - 316, bounds.right - 300)),
      top: Math.max(12, Math.min(window.innerHeight - 400, bounds.bottom + 6)),
    });
    const selectedPeriod = resolveObservationPeriod(value);
    const [a, b] = (isDateRange(selectedPeriod) ? selectedPeriod : DEFAULT_DATES).split("/");
    setStart(a);
    setEnd(b);
    setCursor(new Date(Date.UTC(date(b).getUTCFullYear(), date(b).getUTCMonth(), 1)));
    setYearPage(Math.min(2015, Math.max(2001, date(b).getUTCFullYear() - 5)));
    setView("days");
    setOpen(true);
  };
  const move = (step: number) => {
    if (view === "years") {
      setYearPage((y) => Math.min(2015, Math.max(2001, y + step * 12)));
      return;
    }
    const next = new Date(
      Date.UTC(year + (view === "months" ? step : 0), month + (view === "days" ? step : 0), 1),
    );
    if (next.getUTCFullYear() >= 2001 && next.getUTCFullYear() <= 2026) setCursor(next);
  };
  const select = (s: string) => {
    if (!start || end) {
      setStart(s);
      setEnd("");
    } else {
      setStart(s < start ? s : start);
      setEnd(s < start ? start : s);
    }
  };
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  const offset = new Date(Date.UTC(year, month, 1)).getUTCDay();
  return (
    <div className="date-calendar-anchor" ref={root}>
      <button
        ref={trigger}
        className="date-calendar-trigger orbit-filter-trigger"
        aria-label={label}
        title={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? close() : show())}
      >
        <Icon name="calendar" size={16} />
        <span>
          {isDateRange(value)
            ? value.slice(0, 10) === value.slice(-10)
              ? value.slice(0, 10)
              : `${value.slice(0, 10)} – ${value.slice(-10)}`
            : value}
        </span>
        <Icon name="chevron" size={14} />
      </button>
      {open &&
        createPortal(
          <section
            ref={popup}
            style={{ position: "fixed", left: position.left, top: position.top, transform: "none" }}
            className="date-calendar-popup"
            role="dialog"
            aria-label="Select observation dates"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                close();
              }
              if (e.key === "Tab") {
                const buttons = [
                  ...e.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
                ];
                if (e.shiftKey && document.activeElement === buttons[0]) {
                  e.preventDefault();
                  buttons.at(-1)?.focus();
                } else if (!e.shiftKey && document.activeElement === buttons.at(-1)) {
                  e.preventDefault();
                  buttons[0]?.focus();
                }
              }
            }}
          >
            <div className="date-calendar-header">
              <button
                autoFocus
                className="date-calendar-prev"
                aria-label={
                  view === "years"
                    ? "Previous years"
                    : view === "months"
                      ? "Previous year"
                      : "Previous month"
                }
                disabled={
                  view === "years"
                    ? yearPage === 2001
                    : year === 2001 && (view === "months" || month === 0)
                }
                onClick={() => move(-1)}
              >
                <Icon name="chevron" size={17} />
              </button>
              <div>
                <button
                  className="date-calendar-month"
                  onClick={() => setView(view === "months" ? "days" : "months")}
                >
                  {months[month]}
                </button>
                <button
                  className="date-calendar-year"
                  onClick={() => setView(view === "years" ? "days" : "years")}
                >
                  {view === "years" ? `${yearPage}–${Math.min(2026, yearPage + 11)}` : year}
                </button>
              </div>
              <button
                className="date-calendar-next"
                aria-label={
                  view === "years" ? "Next years" : view === "months" ? "Next year" : "Next month"
                }
                disabled={
                  view === "years"
                    ? yearPage === 2015
                    : year === 2026 && (view === "months" || month === 11)
                }
                onClick={() => move(1)}
              >
                <Icon name="chevron" size={17} />
              </button>
            </div>
            {view === "days" ? (
              <>
                <div className="date-calendar-weekdays">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                    <span key={d}>{d}</span>
                  ))}
                </div>
                <div className="date-calendar-days">
                  {Array.from({ length: 42 }, (_, i) => {
                    const d = new Date(Date.UTC(year, month, i - offset + 1)),
                      s = iso(d);
                    return (
                      <button
                        key={s}
                        data-date={s}
                        disabled={s < "2001-01-01" || s > "2026-12-31"}
                        aria-label={d.toLocaleDateString("en-US", {
                          dateStyle: "long",
                          timeZone: "UTC",
                        })}
                        aria-pressed={s === start || s === end}
                        className={`${d.getUTCMonth() !== month ? "adjacent" : ""} ${s === start || s === end ? "endpoint" : ""} ${start && end && s > start && s < end ? "in-range" : ""}`}
                        onClick={() => select(s)}
                        onKeyDown={(e) => {
                          const step = (
                            { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 } as Record<
                              string,
                              number
                            >
                          )[e.key];
                          if (step) {
                            e.preventDefault();
                            const next = new Date(d.getTime() + step * 86400000),
                              id = iso(next);
                            if (id < "2001-01-01" || id > "2026-12-31") return;
                            setCursor(
                              new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth(), 1)),
                            );
                            requestAnimationFrame(() =>
                              popup.current
                                ?.querySelector<HTMLButtonElement>(`[data-date="${id}"]`)
                                ?.focus(),
                            );
                          }
                        }}
                      >
                        {d.getUTCDate()}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="date-calendar-grid">
                {view === "months"
                  ? months.map((m, i) => (
                      <button
                        className={i === month ? "current" : ""}
                        key={m}
                        onClick={() => {
                          setCursor(new Date(Date.UTC(year, i, 1)));
                          setView("days");
                        }}
                      >
                        {m.slice(0, 3)}
                      </button>
                    ))
                  : Array.from({ length: 12 }, (_, i) => yearPage + i)
                      .filter((y) => y <= 2026)
                      .map((y) => (
                        <button
                          key={y}
                          className={y === year ? "current" : ""}
                          onClick={() => {
                            setCursor(new Date(Date.UTC(y, month, 1)));
                            setView("months");
                          }}
                        >
                          {y}
                        </button>
                      ))}
              </div>
            )}
            <div className="date-calendar-selection" aria-live="polite">
              {!start
                ? "Select a day or the start of a range"
                : !end
                  ? `${start} · select an end date, or Apply this day`
                  : start === end
                    ? start
                    : `${start} — ${end}`}
            </div>
            <div className="date-calendar-footer">
              <button
                onClick={() => {
                  setStart("");
                  setEnd("");
                }}
              >
                Clear
              </button>
              <button
                className="date-calendar-apply"
                disabled={!start}
                onClick={() => {
                  onApply(`${start}/${end || start}`);
                  close();
                }}
              >
                Apply
              </button>
            </div>
          </section>,
          document.body,
        )}
    </div>
  );
}
