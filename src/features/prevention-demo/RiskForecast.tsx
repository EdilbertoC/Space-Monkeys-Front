import { useState, type ReactNode } from "react";
import SelectControl from "../../shared/ui/SelectControl";
import { Icon, PanelTitle } from "../../shared/ui/ui";
import {
  AssessmentTrend,
  DataBoundary,
  DataState,
  RiskBadge,
  RiskEvolutionChart,
} from "./components";
import { dateTime, displayableRisk, previousComparable, validityLabel } from "./presentation";
import type { PreventionController } from "./usePrevention";

export default function RiskForecast({
  controller,
  map,
  onRegion,
}: {
  controller: PreventionController;
  map: ReactNode;
  onRegion: (id: string) => void;
}) {
  const [showPrevious, setShowPrevious] = useState(true);
  const data = controller.payload;
  const region =
    data?.regions.find((r) => r.id === controller.selectedRegionId) ?? data?.regions[0];
  const window =
    data?.forecastWindows.find((w) => w.id === controller.windowId) ?? data?.forecastWindows[0];
  const assessment =
    data?.currentAssessments.find(
      (a) => a.regionId === region?.id && a.validityId === window?.id,
    ) ?? null;
  const previous = assessment && data ? previousComparable(assessment, data) : null;
  return (
    <div className="risk-forecast-page">
      <div className="forecast-region-toolbar">
        <label>
          <Icon name="globe" size={15} />
          <span>Assessment region</span>
          <SelectControl
            label="Forecast region"
            value={region?.id ?? ""}
            disabled={!data?.regions.length}
            onChange={onRegion}
          >
            {data?.regions.length ? (
              data.regions.map((r) => (
                <option value={r.id} key={r.id}>
                  {r.name}
                  {r.country ? `, ${r.country}` : ""}
                </option>
              ))
            ) : (
              <option value="">No regions supplied</option>
            )}
          </SelectControl>
        </label>
        <span>Forecast periods are supplied independently of observation filters.</span>
      </div>
      <div className="forecast-workspace">
        <section className="forecast-geography">
          <div className="forecast-map-caption">
            <strong>Geographic observation context</strong>
            <span>Hotspots are not forecast risk areas</span>
          </div>
          {map}
          <p className="prevention-note">
            This is the existing satellite observation map, using its own observation window and
            layer controls. It is not a predicted-fire or probability surface. The selected
            assessment region is {region?.name ?? "not supplied"}.
          </p>
        </section>
        <aside className="forecast-assessment">
          <PanelTitle
            title="Supplied current assessment"
            subtitle={
              region
                ? `${region.name}${region.country ? `, ${region.country}` : ""}`
                : "No region supplied"
            }
          />
          <DataBoundary resource={controller.resource} retry={controller.retry}>
            {(payload) => {
              if (!assessment)
                return (
                  <DataState
                    status="empty"
                    compact
                    message="No assessment was supplied for this region and forecast period. No risk level or probability can be inferred."
                  />
                );
              if (assessment.quality !== "sufficient")
                return (
                  <DataState
                    status="insufficient"
                    compact
                    message={
                      assessment.qualityReason ??
                      "The supplier has not established sufficient data for this assessment."
                    }
                  />
                );
              return (
                <>
                  <div className="forecast-level">
                    <RiskBadge level={assessment.classification} />
                    <AssessmentTrend assessment={assessment} data={payload} />
                  </div>
                  <div className="forecast-score">
                    <span>{assessment.metric.label}</span>
                    <strong>
                      {displayableRisk(assessment) ? assessment.value : "Not supplied"}
                      {displayableRisk(assessment) && <small> / {assessment.metric.max}</small>}
                    </strong>
                    <p>
                      {payload.provenance === "demonstration"
                        ? "Synthetic index, not a probability or real risk measurement."
                        : "Value and scale supplied by the backend; no frontend risk calculation."}
                    </p>
                  </div>
                  {assessment.probability !== null && (
                    <div className="forecast-probability">
                      <span>Estimated probability · supplier-provided</span>
                      <strong>
                        {new Intl.NumberFormat("en", {
                          style: "percent",
                          maximumFractionDigits: 1,
                        }).format(assessment.probability.value)}
                      </strong>
                      <p>{assessment.probability.eventLabel}</p>
                    </div>
                  )}
                  <dl className="forecast-metadata">
                    <dt>Forecast validity</dt>
                    <dd>{validityLabel(window)}</dd>
                    <dt>Forecast horizon</dt>
                    <dd>
                      {window?.horizonHours == null
                        ? "Not supplied"
                        : `${window?.horizonHours} hours · supplied`}
                    </dd>
                    <dt>Updated / issued</dt>
                    <dd>{dateTime(assessment.issuedAt)}</dd>
                    <dt>Model status</dt>
                    <dd>{assessment.model.statusLabel || "Not supplied"}</dd>
                    <dt>Uncertainty</dt>
                    <dd>{assessment.uncertainty ?? "No uncertainty estimate was supplied."}</dd>
                  </dl>
                  <div className="forecast-previous">
                    <span>Previous comparable assessment</span>
                    {previous ? (
                      <>
                        <strong>
                          {displayableRisk(previous) ? previous.value : "No numeric value"}{" "}
                          <small>· {previous.classification}</small>
                        </strong>
                        <p>
                          Issued {dateTime(previous.issuedAt)} · same target validity, metric,
                          horizon and model.
                        </p>
                      </>
                    ) : (
                      <p>
                        No compatible reference was supplied. Different periods or models are not
                        compared.
                      </p>
                    )}
                  </div>
                </>
              );
            }}
          </DataBoundary>
        </aside>
      </div>
      <div className="forecast-history-toolbar">
        <h2>Assessment history</h2>
        <label>
          <input
            type="checkbox"
            checked={showPrevious}
            onChange={(e) => setShowPrevious(e.target.checked)}
          />
          Show previous comparable assessments
        </label>
      </div>
      <RiskEvolutionChart
        resource={controller.resource}
        assessment={assessment}
        showPrevious={showPrevious}
      />
      <section className="forecast-factors">
        <PanelTitle
          title="Contributing environmental factors"
          subtitle="Supplier descriptions only; not measured or inferred by the frontend"
        />
        <DataBoundary resource={controller.resource}>
          {() => {
            if (!assessment || assessment.quality !== "sufficient")
              return (
                <DataState
                  status="insufficient"
                  compact
                  message="Factors are not available for a supported assessment in this selection."
                />
              );
            return assessment.factors.length ? (
              <div className="forecast-factor-list">
                {assessment.factors.map((f) => (
                  <article key={f.id}>
                    <h3>{f.label}</h3>
                    <strong>{f.valueLabel ?? "Value not supplied"}</strong>
                    <p>{f.explanation}</p>
                    <span>{f.sourceLabel ?? "Source not supplied"}</span>
                  </article>
                ))}
              </div>
            ) : (
              <DataState
                status="empty"
                compact
                message="No contributing factors were supplied. The frontend does not infer environmental drivers."
              />
            );
          }}
        </DataBoundary>
      </section>
      <p className="prevention-limitations">
        <Icon name="info" size={14} />
        The frontend does not calculate risk, predict ignition, generate alerts, or harmonize
        satellite measurements. Always distinguish observation context from supplied assessments.
        Demonstration scenarios are not operational intelligence.
      </p>
    </div>
  );
}
