// SI-assisted: written with Claude (Anthropic), reviewed by the Space Monkeys team. See README.
// The next 7 days against normal for the selected area (/forecast/outlook): the forecast
// summed over the area's 0.25° cells next to the climatology the model was trained with
// for the same dates. Forecast units only; never mixed with /history fire cell-days.
import "../styles/forecast.css";
import { forecastApi } from "../../../app/api";
import { BRAZIL_BOUNDS } from "../../../shared/geo/projection";
import { useApi } from "../../../shared/api/useApi";
import { Icon, PanelTitle } from "../../../shared/ui/ui";
import { niceTicks, PanelState } from "../../history/components/HistoryParts";
import { areaKey, areaLabel, type AreaChoice } from "../../history/model/area";
import { longDate } from "../../history/model/history-view";

/** The outlook takes a bbox or a biome; Brazil as a whole goes in as its lon/lat box. */
function outlookQuery(area: AreaChoice) {
  if (area.kind === "biome") return { biome: area.biome };
  if (area.kind === "bbox") return { bbox: area.bbox };
  return { bbox: BRAZIL_BOUNDS.join(",") };
}

/** Words for a ratio to normal; within ±10% reads as "about normal". */
function verdict(ratio: number | null) {
  if (ratio === null) return { text: "no normal to compare with", tone: "" };
  if (ratio >= 1.1) return { text: `${ratio.toFixed(1)}× the normal`, tone: "above" };
  if (ratio <= 0.9) return { text: `${ratio.toFixed(1)}× the normal`, tone: "below" };
  return { text: "about normal", tone: "" };
}

const W = 760;
const H = 170;
const PAD = { left: 46, right: 12, top: 12, bottom: 24 };

export default function OutlookPanel({ area }: { area: AreaChoice }) {
  const outlook = useApi(
    (signal) => forecastApi.getOutlook(outlookQuery(area), { signal }),
    [areaKey(area)],
  );
  const o = outlook.data;
  const week = o ? verdict(o.week.ratio_to_normal) : null;
  const place = area.kind === "country" ? "Brazil (its lon/lat box)" : areaLabel(area);

  return (
    <section className="panel fo-outlook">
      <PanelTitle
        title="Next 7 days against normal"
        subtitle={`${place}. Expected number of 0.25° cells with a VIIRS fire detection per day (sum of the forecast probabilities), next to the same sum for the climatology the model was trained with (VIIRS S-NPP 2012–2022) on those dates.`}
      />
      {outlook.status !== "success" || !o ? (
        <PanelState error={outlook.error ?? undefined} />
      ) : (
        <>
          <div className="fo-headline">
            <strong className={`hw-big ${week?.tone ?? ""}`}>
              {week?.text}
              <em> over the week</em>
            </strong>
            <small>
              {o.week.expected_fire_cell_days.toFixed(1)} expected against{" "}
              {o.week.normal_fire_cell_days.toFixed(1)} normal cell-days · {o.forecast_cells}{" "}
              forecast cells
              {o.anchored_cells && o.anchored_cells > 0
                ? ` · ${o.anchored_cells} raised by fires burning now`
                : ""}{" "}
              · issued for {longDate(o.issued_for)}
            </small>
          </div>
          <OutlookChart days={o.days} />
          <p className="hw-note hw-pad">
            <Icon name="info" size={13} /> These are forecast units (0.25° cells seen by VIIRS), not
            the MODIS-equivalent fire cell-days of the historical pages; do not add or compare them.
            {area.kind === "country"
              ? " Brazil is sent as its lon/lat box, which also takes in border areas of neighbouring countries if the forecast covers them."
              : ""}
          </p>
        </>
      )}
    </section>
  );
}

type Day = {
  date: string;
  expected_fire_cells: number;
  normal_fire_cells: number;
  ratio_to_normal: number | null;
};

function OutlookChart({ days }: { days: Day[] }) {
  const max = Math.max(1, ...days.flatMap((d) => [d.expected_fire_cells, d.normal_fire_cells]));
  const step = (W - PAD.left - PAD.right) / Math.max(1, days.length);
  const x = (i: number) => PAD.left + i * step + step / 2;
  const y = (v: number) => PAD.top + (1 - v / max) * (H - PAD.top - PAD.bottom);
  return (
    <div className="hw-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Expected and normal fire cells per day">
        {niceTicks(max).map((t) => (
          <g key={t}>
            <line className="hw-gridline" x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
            <text className="hw-axis" x={PAD.left - 6} y={y(t) + 3} textAnchor="end">
              {t >= 100 ? Math.round(t) : t.toFixed(t < 10 ? 1 : 0)}
            </text>
          </g>
        ))}
        {days.map((d, i) => {
          const tone = verdict(d.ratio_to_normal).tone;
          return (
            <g key={d.date}>
              <rect
                className={`fo-bar ${tone}`}
                x={x(i) - step * 0.3}
                width={step * 0.6}
                y={y(d.expected_fire_cells)}
                height={Math.max(0, y(0) - y(d.expected_fire_cells))}
              />
              <line
                className="fo-normal"
                x1={x(i) - step * 0.38}
                x2={x(i) + step * 0.38}
                y1={y(d.normal_fire_cells)}
                y2={y(d.normal_fire_cells)}
              />
              <text className="hw-axis" x={x(i)} y={H - 7} textAnchor="middle">
                {i === 0 ? "Today" : d.date.slice(5)}
              </text>
              <rect
                className="hw-hit"
                x={x(i) - step / 2}
                width={step}
                y={PAD.top}
                height={H - PAD.top - PAD.bottom}
              >
                <title>
                  {`${d.date}: ${d.expected_fire_cells.toFixed(1)} expected, ${d.normal_fire_cells.toFixed(1)} normal` +
                    (d.ratio_to_normal === null ? "" : ` (${d.ratio_to_normal.toFixed(2)}×)`)}
                </title>
              </rect>
            </g>
          );
        })}
      </svg>
      <div className="hw-legend">
        <i className="hw-swatch fo-bar-swatch" /> <span>Forecast: expected cells</span>
        <i className="hw-swatch line fo-normal-swatch" /> <span>Normal for the date</span>
        <span className="fo-legend-note">
          Orange: 10% or more above normal · blue: 10% or more below
        </span>
      </div>
    </div>
  );
}
