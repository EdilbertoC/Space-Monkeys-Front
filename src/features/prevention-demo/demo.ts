import type {
  AlertRecord,
  ForecastValidity,
  GeographicRegion,
  PreventionPayload,
  RiskAssessment,
  RiskLevel,
  TrendDirection,
} from "./contracts";

/** UI-ONLY SCENARIOS. All scores, classifications, factors and alerts below are invented
 * visual-development fixtures, NOT observations, model outputs, predictions or advice.
 * Never merge this file into a backend response or label it production data. */
export const demoRegions: GeographicRegion[] = [
  {
    id: "amazonas",
    name: "Amazonas",
    country: "Brazil",
    observationContext: "South America",
    centroid: { longitude: -63, latitude: -4 },
  },
  {
    id: "queensland",
    name: "Queensland",
    country: "Australia",
    observationContext: "Oceania",
    centroid: { longitude: 144, latitude: -22 },
  },
  {
    id: "attica",
    name: "Attica",
    country: "Greece",
    observationContext: "Europe",
    centroid: { longitude: 23.7, latitude: 38 },
  },
  {
    id: "british-columbia",
    name: "British Columbia",
    country: "Canada",
    observationContext: "North America",
    centroid: { longitude: -124, latitude: 54 },
  },
];
const windows: ForecastValidity[] = [
  {
    id: "demo-24",
    label: "24-hour scenario",
    horizonHours: 24,
    validFrom: "2026-08-24T12:00:00Z",
    validTo: "2026-08-25T12:00:00Z",
  },
  {
    id: "demo-48",
    label: "48-hour scenario",
    horizonHours: 48,
    validFrom: "2026-08-24T12:00:00Z",
    validTo: "2026-08-26T12:00:00Z",
  },
];
const dates = [
  "2026-08-22T00:00:00Z",
  "2026-08-22T12:00:00Z",
  "2026-08-23T00:00:00Z",
  "2026-08-23T12:00:00Z",
  "2026-08-24T06:00:00Z",
  "2026-08-24T12:00:00Z",
];
const scenarios: {
  id: string;
  level: RiskLevel;
  direction: TrendDirection;
  attention: boolean;
  values24: number[];
  values48: number[];
  factor: string;
  explanation: string;
}[] = [
  {
    id: "amazonas",
    level: "high",
    direction: "increasing",
    attention: true,
    values24: [42, 46, 48, 54, 58, 64],
    values48: [45, 48, 52, 56, 60, 66],
    factor: "Dry-fuel scenario",
    explanation: "Illustrative fuel-condition input, not an actual moisture measurement.",
  },
  {
    id: "queensland",
    level: "moderate",
    direction: "stable",
    attention: false,
    values24: [39, 40, 41, 40, 41, 41],
    values48: [40, 41, 42, 41, 42, 42],
    factor: "Stable-conditions scenario",
    explanation: "Illustrative environmental context; no weather feed is connected.",
  },
  {
    id: "attica",
    level: "high",
    direction: "increasing",
    attention: true,
    values24: [44, 47, 45, 50, 54, 59],
    values48: [47, 49, 50, 53, 57, 61],
    factor: "Wind-exposure scenario",
    explanation: "Illustrative wind-related context, not a measured or forecast wind value.",
  },
  {
    id: "british-columbia",
    level: "low",
    direction: "decreasing",
    attention: false,
    values24: [36, 34, 32, 29, 27, 24],
    values48: [38, 36, 34, 31, 29, 26],
    factor: "Easing-conditions scenario",
    explanation: "Illustrative input narrative only; no field conditions have been verified.",
  },
];
const riskHistory: RiskAssessment[] = scenarios.flatMap((s) =>
  windows.flatMap((w) => {
    const values = w.id === "demo-24" ? s.values24 : s.values48;
    return values.map((value, i): RiskAssessment => ({
      id: `${s.id}-${w.id}-${i}`,
      regionId: s.id,
      issuedAt: dates[i],
      validityId: w.id,
      value,
      classification: s.level,
      metric: { id: "demo-index", label: "Illustrative risk index", min: 0, max: 100 },
      probability: null,
      trend: {
        direction: s.direction,
        referenceAssessmentId: i > 0 ? `${s.id}-${w.id}-${i - 1}` : null,
        explanation:
          "Supplied UI scenario trend. No frontend risk calculation or scientific trend validation.",
      },
      requiresAttention: s.attention,
      quality: "sufficient",
      qualityReason: null,
      model: {
        id: "ui-scenario",
        version: "fixture-v1",
        statusLabel: "Demonstration only · no prediction model connected",
      },
      uncertainty:
        "Not quantified. This synthetic scenario has no scientific uncertainty estimate.",
      factors: [
        {
          id: "demo-environment",
          label: "Environmental context",
          valueLabel: s.factor,
          explanation: s.explanation,
          sourceLabel: "Synthetic UI fixture — not measured",
        },
        {
          id: "demo-coverage",
          label: "Observation context",
          valueLabel: "Illustrative satellite context",
          explanation:
            "Observation coverage would be supplied by the backend. No sensor harmonization is performed here.",
          sourceLabel: "No production inputs connected",
        },
      ],
    }));
  }),
);
const alerts: AlertRecord[] = [
  {
    id: "demo-alert-amazonas",
    regionId: "amazonas",
    assessmentId: "amazonas-demo-24-5",
    severity: "high",
    trend: "increasing",
    title: "Review regional readiness",
    description:
      "Demonstration advisory: this scenario is flagged for preventive review. It is not an actual fire warning.",
    createdAt: "2026-08-24T12:05:00Z",
    validityId: "demo-24",
    recommendedAction:
      "Review local readiness procedures and verify conditions with authoritative agencies. Do not take operational action based on this demo.",
    readStatus: "unread",
    rationale: [
      "Synthetic increasing-trend scenario supplied to the UI.",
      "Dry-fuel scenario is illustrative, not a measured environmental factor.",
    ],
  },
  {
    id: "demo-alert-attica",
    regionId: "attica",
    assessmentId: "attica-demo-24-5",
    severity: "high",
    trend: "increasing",
    title: "Check prevention planning coverage",
    description:
      "Demonstration advisory for a changing-conditions scenario. No real risk event has been detected or forecast.",
    createdAt: "2026-08-24T11:40:00Z",
    validityId: "demo-24",
    recommendedAction:
      "Confirm that local prevention plans and contact information are up to date. Consult official information for real decisions.",
    readStatus: "unread",
    rationale: [
      "Synthetic wind-exposure scenario.",
      "Illustrative current assessment is marked for attention; not a validated scientific result.",
    ],
  },
  {
    id: "demo-alert-queensland",
    regionId: "queensland",
    assessmentId: "queensland-demo-48-5",
    severity: "moderate",
    trend: "stable",
    title: "Maintain routine monitoring",
    description: "Example of a lower-priority preventive notice for a separate 48-hour scenario.",
    createdAt: "2026-08-24T10:10:00Z",
    validityId: "demo-48",
    recommendedAction:
      "Continue reviewing authoritative updates. This record exists only to demonstrate the alert interface.",
    readStatus: "read",
    rationale: [
      "Synthetic stable-trend scenario.",
      "This 48-hour assessment must not be compared with a 24-hour assessment.",
    ],
  },
];
export const preventionDemo: PreventionPayload = {
  schemaVersion: "provisional-ui-v1",
  provenance: "demonstration",
  updatedAt: "2026-08-24T12:05:00Z",
  regions: demoRegions,
  forecastWindows: windows,
  currentAssessments: riskHistory.filter((a) => a.issuedAt === dates[5]),
  riskHistory,
  alerts,
  monitoredRegions: demoRegions.map((r) => ({
    id: `monitor-${r.id}`,
    regionId: r.id,
    enabled: true,
    monitoredSince: "2026-08-20T00:00:00Z",
  })),
};
