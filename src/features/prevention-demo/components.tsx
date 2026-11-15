import { useState, type ReactNode } from "react";
import { Icon, PanelTitle } from "../../shared/ui/ui";
import type {
  AlertRecord,
  DataStatus,
  PreventionPayload,
  PreventionResource,
  RiskAssessment,
  RiskLevel,
  TrendDirection,
} from "./contracts";
import {
  compatibleAssessments,
  dateTime,
  displayableRisk,
  hasPreventionData,
  previousComparable,
  validityLabel,
} from "./presentation";
import type { PreventionController } from "./usePrevention";

const stateCopy: Record<
  Exclude<DataStatus, "success" | "demonstration">,
  { title: string; description: string }
> = {
  loading: {
    title: "Loading supplied information",
    description: "Waiting for the data source. No risk values are inferred while loading.",
  },
  empty: {
    title: "No records supplied",
    description: "There are no results for this selection. This does not mean zero fire risk.",
  },
  insufficient: {
    title: "Insufficient data",
    description:
      "The supplied inputs do not support an assessment. Missing information is not low or zero risk.",
  },
  unavailable: {
    title: "Prevention data unavailable",
    description:
      "No backend adapter or endpoints have been supplied. Forecasts and preventive alerts are unavailable in backend mode.",
  },
  error: {
    title: "Unable to display prevention data",
    description: "The data source could not be read or validated. No risk values are substituted.",
  },
};
export function DataState({
  status,
  message,
  retry,
  compact = false,
}: {
  status: Exclude<DataStatus, "success" | "demonstration">;
  message?: string;
  retry?: () => void;
  compact?: boolean;
}) {
  const copy = stateCopy[status];
  return (
    <div
      className={`prevention-state ${compact ? "compact" : ""}`}
      data-state={status}
      role={status === "error" ? "alert" : "status"}
    >
      <Icon
        name={status === "error" ? "alert" : status === "loading" ? "layers" : "info"}
        size={20}
      />
      <div>
        <strong>{copy.title}</strong>
        <p>{message || copy.description}</p>
      </div>
      {(status === "error" || status === "unavailable") && retry && (
        <button className="text-link" onClick={retry}>
          Retry data source
          <Icon name="arrow" size={12} />
        </button>
      )}
    </div>
  );
}
export function DataBoundary({
  resource,
  children,
  retry,
  compact = false,
}: {
  resource: PreventionResource;
  children: (data: PreventionPayload) => ReactNode;
  retry?: () => void;
  compact?: boolean;
}) {
  return hasPreventionData(resource) ? (
    <div className="prevention-result" data-provenance={resource.data.provenance}>
      {children(resource.data)}
    </div>
  ) : (
    <DataState
      status={resource.status}
      message={resource.message}
      retry={retry}
      compact={compact}
    />
  );
}
export function PreventionToolbar({
  controller,
  periodControl = false,
}: {
  controller: PreventionController;
  periodControl?: boolean;
}) {
  const { payload } = controller;
  return (
    <div className="prevention-toolbar">
      <div>
        <Icon name="layers" size={15} />
        <strong>Prevention workspace</strong>
        <span
          className={`prevention-source ${controller.resource.status === "demonstration" ? "demo" : ""}`}
        >
          {controller.resource.status === "demonstration"
            ? "Illustrative preview"
            : controller.mode === "backend"
              ? "Backend data"
              : "Loading preview"}
        </span>
      </div>
      <div>
        {periodControl && payload && payload.forecastWindows.length > 0 && (
          <label>
            Assessment period
            <select
              aria-label="Forecast period"
              value={
                payload.forecastWindows.some((w) => w.id === controller.windowId)
                  ? controller.windowId
                  : payload.forecastWindows[0].id
              }
              onChange={(e) => controller.setWindowId(e.target.value)}
            >
              {payload.forecastWindows.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Data source
          <select
            aria-label="Prevention data source"
            value={controller.mode}
            onChange={(e) => controller.setMode(e.target.value as "backend" | "demonstration")}
          >
            <option value="demonstration">Illustrative preview</option>
            <option value="backend">Backend data</option>
          </select>
        </label>
      </div>
      <p>
        {controller.mode === "demonstration" || controller.resource.status === "demonstration"
          ? "Synthetic UI scenarios only. No prediction model, measured risk, or notification service is connected. Not for operational decisions."
          : "Backend data mode. Supplied responses must pass UI contract checks; this is not scientific model validation. Missing risk information is never estimated by the frontend."}
      </p>
    </div>
  );
}
export function RiskBadge({ level }: { level: RiskLevel }) {
  return (
    <span className={`risk-badge risk-${level}`}>
      <i />
      {level === "unknown" ? "Not assessed" : level.charAt(0).toUpperCase() + level.slice(1)}
    </span>
  );
}
export function TrendLabel({
  direction,
  reason,
}: {
  direction: TrendDirection;
  reason?: string | null;
}) {
  return (
    <span className={`risk-trend trend-${direction}`} title={reason ?? undefined}>
      <Icon
        name={direction === "increasing" || direction === "decreasing" ? "arrow" : "minus"}
        size={13}
      />
      {direction === "unknown"
        ? "Trend not established"
        : direction.charAt(0).toUpperCase() + direction.slice(1)}
    </span>
  );
}
export function AssessmentTrend({
  assessment,
  data,
}: {
  assessment: RiskAssessment;
  data: PreventionPayload;
}) {
  const prior = previousComparable(assessment, data);
  return (
    <TrendLabel
      direction={prior ? assessment.trend.direction : "unknown"}
      reason={
        prior
          ? assessment.trend.explanation
          : "No supplied reference with matching region, model, metric, horizon and validity window."
      }
    />
  );
}
export function AlertList({
  alerts,
  data,
  onSelect,
  compact = false,
}: {
  alerts: AlertRecord[];
  data: PreventionPayload;
  onSelect: (id: string) => void;
  compact?: boolean;
}) {
  if (!alerts.length)
    return (
      <DataState
        status="empty"
        compact
        message="No preventive alerts were supplied for this selection. This is not an assurance of safety."
      />
    );
  return (
    <div className={`preventive-alert-list ${compact ? "compact" : ""}`}>
      {alerts.map((alert) => (
        <button
          key={alert.id}
          className={`preventive-alert-row ${alert.readStatus}`}
          onClick={() => onSelect(alert.id)}
        >
          <span className="alert-read-indicator" aria-label={alert.readStatus} />
          <span className="preventive-alert-copy">
            <strong>{alert.title}</strong>
            <span>
              {data.regions.find((r) => r.id === alert.regionId)?.name ?? "Region not supplied"} ·{" "}
              {dateTime(alert.createdAt)}
            </span>
            {!compact && <p>{alert.description}</p>}
          </span>
          <RiskBadge level={alert.severity} />
          <Icon name="chevron" size={14} />
        </button>
      ))}
    </div>
  );
}
export function PreventiveNotifications({
  controller,
  onOpen,
  onCenter,
}: {
  controller: PreventionController;
  onOpen: (id: string) => void;
  onCenter: () => void;
}) {
  return (
    <div className="preventive-notifications">
      <div className="popover-title">
        Preventive alerts
        <span className="prevention-source">
          {controller.resource.status === "demonstration" ? "Synthetic demo" : "Supplied records"}
        </span>
      </div>
      <DataBoundary resource={controller.resource} compact retry={controller.retry}>
        {(data) => (
          <AlertList alerts={controller.alerts.slice(0, 3)} data={data} compact onSelect={onOpen} />
        )}
      </DataBoundary>
      <button className="prevention-center-link" onClick={onCenter}>
        Open Alert Center
        <Icon name="arrow" size={13} />
      </button>
    </div>
  );
}

export function RiskEvolutionChart({
  resource,
  assessment,
  showPrevious = true,
}: {
  resource: PreventionResource;
  assessment: RiskAssessment | null;
  showPrevious?: boolean;
}) {
  const [hover, setHover] = useState<string | null>(null);
  return (
    <section className="risk-evolution">
      <PanelTitle
        title="Risk evolution"
        subtitle="Supplied assessment history · matching forecast validity and model only"
      />
      <DataBoundary resource={resource}>
        {(data) => {
          if (!assessment || assessment.quality !== "sufficient")
            return (
              <DataState
                status="insufficient"
                compact
                message={
                  assessment?.qualityReason ??
                  "No assessment is available for this region and forecast period."
                }
              />
            );
          const candidates = [
            assessment,
            ...data.riskHistory.filter(
              (a) =>
                a.id !== assessment.id &&
                a.regionId === assessment.regionId &&
                Date.parse(a.issuedAt) <= Date.parse(assessment.issuedAt),
            ),
          ];
          const compatible = candidates.filter(
            (a) =>
              a.id === assessment.id || compatibleAssessments(assessment, a, data.forecastWindows),
          );
          const excluded = candidates.length - compatible.length;
          const samples = (
            showPrevious ? compatible : compatible.filter((a) => a.id === assessment.id)
          ).sort((a, b) => Date.parse(a.issuedAt) - Date.parse(b.issuedAt));
          const numeric = samples.filter((a) => a.quality === "sufficient" && displayableRisk(a));
          if (!numeric.length)
            return (
              <DataState
                status="insufficient"
                compact
                message="No numeric risk series was supplied. Qualitative classifications are not converted into scores or probabilities."
              />
            );
          const start = Date.parse(samples[0].issuedAt),
            end = Date.parse(samples[samples.length - 1].issuedAt);
          const x = (a: RiskAssessment) =>
            end === start ? 340 : 52 + ((Date.parse(a.issuedAt) - start) / (end - start)) * 580;
          const y = (a: RiskAssessment) =>
            145 -
            ((a.value! - assessment.metric.min) / (assessment.metric.max - assessment.metric.min)) *
              115;
          let pen = false;
          const path = samples
            .map((a) => {
              if (a.quality !== "sufficient" || !displayableRisk(a)) {
                pen = false;
                return "";
              }
              const part = `${pen ? "L" : "M"}${x(a)},${y(a)}`;
              pen = true;
              return part;
            })
            .join(" ");
          const active = numeric.find((a) => a.id === hover);
          return (
            <>
              <div className="risk-chart-key">
                <span>
                  <i />
                  Comparable history
                </span>
                <span>
                  <i className="current" />
                  Supplied current assessment
                </span>
                <span>
                  {assessment.metric.label} · {assessment.metric.min}–{assessment.metric.max}
                  {data.provenance === "demonstration" ? " · synthetic, not probability" : ""}
                </span>
              </div>
              <div className="risk-chart-frame" onMouseLeave={() => setHover(null)}>
                <svg
                  viewBox="0 0 680 186"
                  role="group"
                  aria-label={`${assessment.metric.label}, supplied comparable assessment history`}
                  data-points={numeric.length}
                >
                  {[0, 0.5, 1].map((r) => (
                    <g key={r}>
                      <line
                        x1="52"
                        x2="640"
                        y1={145 - r * 115}
                        y2={145 - r * 115}
                        className="risk-gridline"
                      />
                      <text x="41" y={149 - r * 115} textAnchor="end">
                        {assessment.metric.min +
                          r * (assessment.metric.max - assessment.metric.min)}
                      </text>
                    </g>
                  ))}
                  <path d={path} className="risk-history-line" />
                  {numeric.map((a) => (
                    <circle
                      key={a.id}
                      cx={x(a)}
                      cy={y(a)}
                      r={a.id === assessment.id ? 4.5 : 3}
                      className={
                        a.id === assessment.id ? "risk-current-point" : "risk-history-point"
                      }
                      tabIndex={0}
                      role="img"
                      aria-label={`${dateTime(a.issuedAt)}: ${a.value}, ${a.classification}, ${a.trend.direction}`}
                      onFocus={() => setHover(a.id)}
                      onBlur={() => setHover(null)}
                      onMouseEnter={() => setHover(a.id)}
                    >
                      <title>
                        {dateTime(a.issuedAt)} · {a.value} · {a.classification}
                      </title>
                    </circle>
                  ))}
                  <text x="52" y="174">
                    {dateTime(samples[0].issuedAt)}
                  </text>
                  <text x="640" y="174" textAnchor="end">
                    {dateTime(samples[samples.length - 1].issuedAt)}
                  </text>
                </svg>
                {active && (
                  <div className="risk-chart-tooltip">
                    <strong>{dateTime(active.issuedAt)}</strong>
                    <span>
                      {active.metric.label}: {active.value}
                    </span>
                    <RiskBadge level={active.classification} />
                    <span>
                      {active.id === assessment.id
                        ? "Supplied current"
                        : "Comparable earlier issuance"}
                    </span>
                  </div>
                )}
              </div>
              <p className="prevention-note">
                Target validity:{" "}
                {validityLabel(data.forecastWindows.find((w) => w.id === assessment.validityId))}.{" "}
                {excluded > 0 && `${excluded} incompatible record(s) excluded. `}Missing values are
                gaps, not zero risk.{" "}
                {data.provenance === "demonstration" &&
                  "Every plotted value is a synthetic UI fixture, not a scientific prediction."}
              </p>
            </>
          );
        }}
      </DataBoundary>
    </section>
  );
}
