// SI-assisted: written with Claude (Anthropic), reviewed by the Space Monkeys team. See README.
// Fire cell-days of the selected area and period, read from /history/calendar and
// /history/anomaly. Values per sensor are observed counts; the harmonized value is the
// MODIS-equivalent series. Sensors are never added together.
import { useMemo } from "react";
import { historyApi } from "../../../app/api";
import type { Schemas, Series } from "../../../shared/api/types";
import { useApi } from "../../../shared/api/useApi";
import { PanelTitle } from "../../../shared/ui/ui";
import { areaKey, areaSelector, periodDays, type AreaChoice } from "../model/area";
import {
  ANOMALY_LABEL,
  bucketValue,
  formatValue,
  longDate,
  SERIES_LABEL,
  shortDate,
  type Bucket,
} from "../model/history-view";
import { granularityFor, seriesTotal, type Period } from "../model/period";
import { Card, H, niceTicks, PAD, PanelState, W } from "./HistoryParts";

export type { Period };

function useCalendar(area: AreaChoice, period: Period) {
  const granularity = granularityFor(period);
  return useApi(
    (signal) =>
      historyApi.getCalendar({ ...areaSelector(area), ...period, granularity }, { signal }),
    [areaKey(area), period.start, period.end, granularity],
  );
}

export function PeriodKpis({ area, period }: { area: AreaChoice; period: Period }) {
  const calendar = useCalendar(area, period);
  const fitsAnomaly = periodDays(period.start, period.end) <= 366;
  const anomaly = useApi(
    fitsAnomaly
      ? (signal) => historyApi.getAnomaly({ ...areaSelector(area), ...period }, { signal })
      : null,
    [areaKey(area), period.start, period.end, fitsAnomaly],
  );
  const buckets = calendar.data?.buckets ?? [];
  const provisional = buckets.some((b) => b.provisional);
  const card = (series: Series, title: string) => {
    const total = seriesTotal(buckets, series);
    return (
      <Card title={title} state={calendar}>
        <strong className="hw-big">{formatValue(total)}</strong>
        <Sparkline buckets={buckets} series={series} />
        <small>
          {series === "harmonized"
            ? "MODIS-equivalent fire cell-days"
            : `fire cell-days seen by ${series.toUpperCase()}`}
          {provisional && " · includes provisional (NRT) days"}
        </small>
      </Card>
    );
  };
  const a = anomaly.data?.data;
  return (
    <div className="hw-kpis">
      {card("harmonized", "Harmonized fire cell-days")}
      {card("modis", "MODIS observed")}
      {card("viirs", "VIIRS observed")}
      {fitsAnomaly ? (
        <Card title="Compared with the normal" state={anomaly}>
          {a && (
            <>
              <strong className={`hw-big hw-class-${a.class}`}>{ANOMALY_LABEL[a.class]}</strong>
              <small>
                {formatValue(a.value)} vs median {formatValue(a.normal.median)} (p10–p90{" "}
                {formatValue(a.normal.p10)}–{formatValue(a.normal.p90)}) for the same dates in{" "}
                {a.base_years[0]}–{a.base_years[1]}
              </small>
            </>
          )}
        </Card>
      ) : (
        <Card title="Compared with the normal">
          <small>Choose a period of one year or less to compare it with the normal.</small>
        </Card>
      )}
    </div>
  );
}

function Sparkline({ buckets, series }: { buckets: Bucket[]; series: Series }) {
  const values = buckets.map((b) => bucketValue(b, series));
  const max = Math.max(0, ...values.map((v) => v ?? 0));
  if (values.length < 2 || max === 0) return null;
  const pts = values
    .map((v, i) =>
      v === null ? null : `${(i / (values.length - 1)) * 100},${28 - (v / max) * 26}`,
    )
    .filter(Boolean)
    .join(" ");
  return (
    <svg className="hw-spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden>
      <polyline points={pts} />
    </svg>
  );
}

const SERIES_CLASS: Record<Series, string> = {
  harmonized: "harm",
  modis: "modis",
  viirs: "viirs",
};

export function PeriodChart({
  area,
  period,
  title = "Fire activity over the period",
}: {
  area: AreaChoice;
  period: Period;
  title?: string;
}) {
  const calendar = useCalendar(area, period);
  const granularity = granularityFor(period);
  return (
    <section className="panel hw-weekly-panel">
      <PanelTitle
        title={title}
        subtitle={`Fire cell-days per ${granularity}, ${longDate(period.start)} – ${longDate(period.end)} UTC. MODIS and VIIRS are what each sensor saw; harmonized is the MODIS-equivalent series, equal to MODIS while MODIS delivers data.`}
      />
      {calendar.status === "success" ? (
        <SeriesLines buckets={calendar.data.buckets} />
      ) : (
        <PanelState error={calendar.error ?? undefined} />
      )}
    </section>
  );
}

function SeriesLines({ buckets }: { buckets: Schemas["CalendarBucket"][] }) {
  const series: Series[] = ["viirs", "modis", "harmonized"];
  const max = useMemo(
    () => Math.max(1, ...buckets.flatMap((b) => series.map((s) => bucketValue(b, s) ?? 0))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [buckets],
  );
  if (!buckets.length) return <PanelState error={new Error("No data in this period.")} />;
  const n = buckets.length;
  const x = (i: number) => PAD.left + (n === 1 ? 0.5 : i / (n - 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - v / max) * (H - PAD.top - PAD.bottom);
  const every = Math.max(1, Math.ceil(n / 8));
  return (
    <div className="hw-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Fire cell-days per bucket">
        {niceTicks(max).map((t) => (
          <g key={t}>
            <line className="hw-gridline" x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
            <text className="hw-axis" x={PAD.left - 6} y={y(t) + 3} textAnchor="end">
              {formatValue(t)}
            </text>
          </g>
        ))}
        {buckets.map((b, i) =>
          i % every === 0 ? (
            <text key={b.start} className="hw-axis" x={x(i)} y={H - 6} textAnchor="middle">
              {shortDate(b.start)}
            </text>
          ) : null,
        )}
        {series.map((s) => {
          // Split the line at missing values instead of drawing them as zero.
          const segments: string[][] = [[]];
          buckets.forEach((b, i) => {
            const v = bucketValue(b, s);
            if (v === null) segments.push([]);
            else segments[segments.length - 1]!.push(`${x(i)},${y(v)}`);
          });
          return segments
            .filter((seg) => seg.length)
            .map((seg, k) => (
              <polyline
                key={`${s}${k}`}
                className={`hw-line ${SERIES_CLASS[s]}`}
                points={seg.join(" ")}
              />
            ));
        })}
        {buckets.map((b, i) => (
          <rect
            key={`hit${b.start}`}
            className="hw-hit"
            x={x(i) - (W - PAD.left - PAD.right) / n / 2}
            width={(W - PAD.left - PAD.right) / n}
            y={PAD.top}
            height={H - PAD.top - PAD.bottom}
          >
            <title>
              {`${b.start === b.end ? longDate(b.start) : `${longDate(b.start)} – ${longDate(b.end)}`}: harmonized ${formatValue(b.harmonized?.value)}, MODIS ${formatValue(b.modis)}, VIIRS ${formatValue(b.viirs)}${b.provisional ? " (provisional)" : ""}`}
            </title>
          </rect>
        ))}
      </svg>
      <div className="hw-legend">
        <i className="hw-swatch line harm" /> <span>{SERIES_LABEL.harmonized}</span>
        <i className="hw-swatch line modis" /> <span>{SERIES_LABEL.modis}</span>
        <i className="hw-swatch line viirs" /> <span>{SERIES_LABEL.viirs}</span>
      </div>
    </div>
  );
}
