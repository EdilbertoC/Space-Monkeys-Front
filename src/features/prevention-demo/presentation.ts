import type {
  ForecastValidity,
  PreventionPayload,
  PreventionResource,
  RiskAssessment,
} from "./contracts.ts";

export const hasPreventionData = (
  resource: PreventionResource,
): resource is Extract<PreventionResource, { data: PreventionPayload }> =>
  resource.status === "success" || resource.status === "demonstration";
export function compatibleAssessments(
  a: RiskAssessment,
  b: RiskAssessment,
  windows: ForecastValidity[],
) {
  const aw = windows.find((w) => w.id === a.validityId),
    bw = windows.find((w) => w.id === b.validityId);
  return (
    !!aw &&
    !!bw &&
    a.regionId === b.regionId &&
    a.model.id === b.model.id &&
    a.model.version === b.model.version &&
    a.metric.id === b.metric.id &&
    a.metric.min === b.metric.min &&
    a.metric.max === b.metric.max &&
    aw.horizonHours !== null &&
    aw.horizonHours === bw.horizonHours &&
    aw.validFrom === bw.validFrom &&
    aw.validTo === bw.validTo
  );
}
export function previousComparable(current: RiskAssessment, data: PreventionPayload) {
  const prior = data.riskHistory.find((a) => a.id === current.trend.referenceAssessmentId);
  return prior &&
    current.quality === "sufficient" &&
    prior.quality === "sufficient" &&
    Date.parse(prior.issuedAt) < Date.parse(current.issuedAt) &&
    compatibleAssessments(current, prior, data.forecastWindows)
    ? prior
    : null;
}
export function displayableRisk(a: RiskAssessment) {
  return (
    a.value !== null &&
    Number.isFinite(a.value) &&
    a.metric.max > a.metric.min &&
    a.value >= a.metric.min &&
    a.value <= a.metric.max
  );
}
export function validPayload(data: PreventionPayload): boolean {
  const validDate = (date: string) => Number.isFinite(Date.parse(date));
  if (
    !data ||
    data.schemaVersion !== "provisional-ui-v1" ||
    !["backend", "demonstration"].includes(data.provenance) ||
    !Array.isArray(data.regions) ||
    !Array.isArray(data.forecastWindows) ||
    !Array.isArray(data.currentAssessments) ||
    !Array.isArray(data.riskHistory) ||
    !Array.isArray(data.alerts) ||
    !Array.isArray(data.monitoredRegions)
  )
    return false;
  const regionIds = new Set(data.regions.map((r) => r.id));
  const windowIds = new Set(data.forecastWindows.map((w) => w.id));
  const nullableText = (value: unknown) => value === null || typeof value === "string";
  return (
    (data.updatedAt === null || validDate(data.updatedAt)) &&
    regionIds.size === data.regions.length &&
    windowIds.size === data.forecastWindows.length &&
    data.regions.every(
      (r) =>
        typeof r.id === "string" &&
        typeof r.name === "string" &&
        nullableText(r.country) &&
        nullableText(r.observationContext),
    ) &&
    data.forecastWindows.every(
      (w) =>
        validDate(w.validFrom) &&
        typeof w.id === "string" &&
        typeof w.label === "string" &&
        validDate(w.validTo) &&
        Date.parse(w.validFrom) < Date.parse(w.validTo) &&
        (w.horizonHours === null || (Number.isFinite(w.horizonHours) && w.horizonHours > 0)),
    ) &&
    [...data.currentAssessments, ...data.riskHistory].every(
      (a) =>
        regionIds.has(a.regionId) &&
        typeof a.id === "string" &&
        windowIds.has(a.validityId) &&
        validDate(a.issuedAt) &&
        ["low", "moderate", "high", "critical", "unknown"].includes(a.classification) &&
        ["sufficient", "insufficient", "unknown"].includes(a.quality) &&
        ["increasing", "decreasing", "stable", "unknown"].includes(a.trend.direction) &&
        typeof a.requiresAttention === "boolean" &&
        nullableText(a.qualityReason) &&
        nullableText(a.uncertainty) &&
        nullableText(a.trend.referenceAssessmentId) &&
        nullableText(a.trend.explanation) &&
        typeof a.model.id === "string" &&
        !!a.model.id &&
        typeof a.model.version === "string" &&
        !!a.model.version &&
        typeof a.model.statusLabel === "string" &&
        typeof a.metric.id === "string" &&
        typeof a.metric.label === "string" &&
        Number.isFinite(a.metric.min) &&
        Number.isFinite(a.metric.max) &&
        a.metric.max > a.metric.min &&
        Array.isArray(a.factors) &&
        a.factors.every(
          (f) =>
            typeof f.id === "string" &&
            typeof f.label === "string" &&
            typeof f.explanation === "string" &&
            nullableText(f.valueLabel) &&
            nullableText(f.sourceLabel),
        ) &&
        (a.value === null || displayableRisk(a)) &&
        (a.probability === null ||
          (Number.isFinite(a.probability.value) &&
            a.probability.value >= 0 &&
            a.probability.value <= 1 &&
            typeof a.probability.eventLabel === "string" &&
            !!a.probability.eventLabel)),
    ) &&
    data.alerts.every(
      (a) =>
        regionIds.has(a.regionId) &&
        typeof a.id === "string" &&
        nullableText(a.assessmentId) &&
        nullableText(a.recommendedAction) &&
        windowIds.has(a.validityId) &&
        validDate(a.createdAt) &&
        typeof a.title === "string" &&
        typeof a.description === "string" &&
        ["read", "unread"].includes(a.readStatus) &&
        ["low", "moderate", "high", "critical", "unknown"].includes(a.severity) &&
        ["increasing", "decreasing", "stable", "unknown"].includes(a.trend) &&
        Array.isArray(a.rationale) &&
        a.rationale.every((reason) => typeof reason === "string"),
    ) &&
    data.monitoredRegions.every(
      (m) =>
        regionIds.has(m.regionId) &&
        typeof m.id === "string" &&
        typeof m.enabled === "boolean" &&
        (m.monitoredSince === null || validDate(m.monitoredSince)),
    )
  );
}
export const dateTime = (value: string | null) =>
  value
    ? new Date(value).toLocaleString("en-GB", {
        month: "short",
        day: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
        hour12: false,
      }) + " UTC"
    : "Not supplied";
export const validityLabel = (window: ForecastValidity | undefined) =>
  window
    ? `${dateTime(window.validFrom)} – ${dateTime(window.validTo)}`
    : "Validity period not supplied";
