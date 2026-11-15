// SI-assisted: written with Claude (Anthropic), reviewed by the Space Monkeys team. See README.
// 7-day fire forecast from /forecast and its model card from /forecast/model. The forecast
// is a probability per 0.25° cell that VIIRS detects fire on each day; it is not a
// regional risk index, and this page does not turn it into one.
import { useState } from "react";
import { forecastApi } from "../../../app/api";
import type { Schemas } from "../../../shared/api/types";
import { useApi } from "../../../shared/api/useApi";
import { BRAZIL_BOUNDS } from "../../../shared/geo/projection";
import { Icon, PanelTitle } from "../../../shared/ui/ui";
import { Card, PanelState, describeError } from "../../history/components/HistoryParts";
import { longDate } from "../../history/model/history-view";
import { ForecastLayer, GeoMap } from "../../map/components/GeoMap";

type Forecast = Schemas["Forecast"];

export function useForecast(minP = 0.05) {
  return useApi((signal) => forecastApi.getForecast({ min_p: minP }, { signal }), [minP]);
}

export default function ForecastPage() {
  const forecast = useForecast();
  const model = useApi((signal) => forecastApi.getModel({ signal }), []);
  const [lead, setLead] = useState(0);

  return (
    <div className="history-workspace">
      {forecast.status === "error" && (
        <p className="hw-note warn">
          <Icon name="info" size={13} /> No forecast to show: {describeError(forecast.error)}
        </p>
      )}
      <div className="hw-kpis">
        <Card title="Issued for" state={forecast}>
          {forecast.data && (
            <>
              <strong className="hw-big">{longDate(forecast.data.issued_for)}</strong>
              <small>
                last complete UTC day of input · generated{" "}
                {forecast.data.generated_at.replace("T", " ").slice(0, 16)} UTC
              </small>
            </>
          )}
        </Card>
        <Card title="Cells at 50% or more" state={forecast}>
          {forecast.data && <CellsAbove forecast={forecast.data} lead={lead} threshold={0.5} />}
        </Card>
        <Card title="Raised by live fires" state={forecast}>
          {forecast.data && (
            <>
              <strong className="hw-big">
                {forecast.data.cells.filter((c) => c.anchored).length}
              </strong>
              <small>
                cells anchored on a fire seen in real time
                {forecast.data.anchored_at
                  ? ` (${forecast.data.anchored_at.replace("T", " ").slice(0, 16)} UTC)`
                  : ""}
              </small>
            </>
          )}
        </Card>
        <Card title="Model skill (test 2024–2025)" state={model}>
          {model.data && <Skill model={model.data} />}
        </Card>
      </div>

      <section className="panel hw-map-panel">
        <PanelTitle
          title="Probability of a VIIRS fire detection"
          subtitle="Per 0.25° cell of Brazil, for each of the next 7 days. Cells below 5% on every day are not listed by the API."
        >
          {forecast.data && (
            <div className="segmented" role="group" aria-label="Forecast day">
              {forecast.data.valid_dates.map((d, i) => (
                <button
                  key={d}
                  className={lead === i ? "selected" : ""}
                  aria-pressed={lead === i}
                  onClick={() => setLead(i)}
                >
                  {i === 0 ? "Today" : d.slice(5)}
                </button>
              ))}
            </div>
          )}
        </PanelTitle>
        {forecast.status === "loading" ? (
          <PanelState />
        ) : (
          <GeoMap
            bounds={BRAZIL_BOUNDS}
            large
            label="Fire probability per 0.25° cell"
            legend={
              <>
                <span>
                  <i className="geo-swatch fc1" /> 5–15% <i className="geo-swatch fc2" /> 15–30%{" "}
                  <i className="geo-swatch fc3" /> 30–50% <i className="geo-swatch fc4" /> ≥ 50%
                </span>
                <span>White outline: raised by a live fire</span>
              </>
            }
          >
            {forecast.data && (
              <ForecastLayer
                cells={forecast.data.cells}
                lead={lead}
                resolution={forecast.data.resolution_deg}
                date={forecast.data.valid_dates[lead] ?? ""}
              />
            )}
          </GeoMap>
        )}
      </section>

      {model.status === "success" && <ModelCard model={model.data} />}
    </div>
  );
}

function CellsAbove({
  forecast,
  lead,
  threshold,
}: {
  forecast: Forecast;
  lead: number;
  threshold: number;
}) {
  const n = forecast.cells.filter((c) => (c.p[lead] ?? 0) >= threshold).length;
  return (
    <>
      <strong className="hw-big">{n.toLocaleString("en-US")}</strong>
      <small>0.25° cells on {forecast.valid_dates[lead] ?? "the selected day"}</small>
    </>
  );
}

function Skill({ model }: { model: Schemas["ForecastModel"] }) {
  const ap = model.test_avg_precision;
  const brier = model.test_brier;
  if (!ap) return <small>No test scores in the model card.</small>;
  return (
    <>
      <strong className="hw-big">
        {ap.unet?.toFixed(2) ?? "—"}
        <em> avg. precision</em>
      </strong>
      <small>
        climatology {ap.climatology?.toFixed(2) ?? "—"}, persistence{" "}
        {ap.persistence?.toFixed(2) ?? "—"}
        {brier
          ? ` · Brier ${brier.unet?.toFixed(3) ?? "—"} (climatology ${brier.climatology?.toFixed(3) ?? "—"})`
          : ""}
      </small>
    </>
  );
}

export function ModelCard({ model }: { model: Schemas["ForecastModel"] }) {
  const m = model as Schemas["ForecastModel"] & { data?: string; trained_with?: string };
  return (
    <details className="panel hw-method">
      <summary>
        <Icon name="info" size={14} /> About the forecast model
      </summary>
      <ul>
        {model.description && <li>{model.description}</li>}
        {m.data && <li>Data: {m.data}</li>}
        {model.train_period && (
          <li>
            Trained {model.train_period.join(" to ")}, validated{" "}
            {model.validation_period?.join(" to ")}, tested {model.test_period?.join(" to ")}.
          </li>
        )}
        <li>
          No weather input. The probabilities say how likely VIIRS is to detect fire in a cell; they
          are not a fire danger index and not burned area.
        </li>
        {model.status.last_error && <li>Last error: {model.status.last_error}</li>}
      </ul>
    </details>
  );
}

/** Compact card for the Overview page. */
export function ForecastSummary({ onOpen }: { onOpen: () => void }) {
  const forecast = useForecast();
  return (
    <section className="panel hw-card hw-forecast-summary">
      <div className="hw-card-title">7-day fire forecast</div>
      {forecast.status === "success" ? (
        <>
          <strong className="hw-big">
            {forecast.data.cells.filter((c) => (c.p[0] ?? 0) >= 0.5).length}
            <em> cells ≥ 50% today</em>
          </strong>
          <small>
            Issued for {longDate(forecast.data.issued_for)} ·{" "}
            {forecast.data.cells.filter((c) => c.anchored).length} raised by live fires
          </small>
        </>
      ) : (
        <small>
          {forecast.status === "error"
            ? `Unavailable: ${describeError(forecast.error)}`
            : "Loading…"}
        </small>
      )}
      <button className="text-link" onClick={onOpen}>
        Open the forecast <Icon name="arrow" size={13} />
      </button>
    </section>
  );
}
