import type { SensorId } from "../sensors/sensors";

/** Provisional frontend view contracts, NOT a claim about an existing backend API.
 * The backend team can adapt its actual responses through PreventionAdapter.
 * All timestamps are ISO 8601; all numeric risk values are supplied, never inferred. */
export type DataStatus =
  | "loading"
  | "success"
  | "empty"
  | "insufficient"
  | "unavailable"
  | "error"
  | "demonstration";
export type RiskLevel = "low" | "moderate" | "high" | "critical" | "unknown";
export type TrendDirection = "increasing" | "decreasing" | "stable" | "unknown";
export type ReadStatus = "read" | "unread";

export interface GeographicRegion {
  id: string;
  name: string;
  country: string | null;
  /** Optional adapter-provided link to one of the existing observation map's scopes. */
  observationContext: string | null;
  centroid: { longitude: number; latitude: number } | null;
}
export interface SatelliteHotspotObservation {
  id: string;
  sensor: SensorId;
  regionId: string | null;
  acquiredAt: string | null;
  longitude: number;
  latitude: number;
  confidence: string | number | null;
  nativeResolution: string | null;
  original: unknown;
}
export interface ForecastValidity {
  id: string;
  label: string;
  validFrom: string;
  validTo: string;
  /** Supplied forecast horizon; not calculated from issue times by the UI. */
  horizonHours: number | null;
}
export interface RiskTrend {
  direction: TrendDirection;
  referenceAssessmentId: string | null;
  explanation: string | null;
}
export interface ContributingFactor {
  id: string;
  label: string;
  valueLabel: string | null;
  explanation: string;
  sourceLabel: string | null;
}
export interface RiskAssessment {
  id: string;
  regionId: string;
  issuedAt: string;
  validityId: string;
  classification: RiskLevel;
  /** Optional supplied index. It is NEVER converted to a probability or classification. */
  value: number | null;
  metric: { id: string; label: string; min: number; max: number };
  probability: { value: number; eventLabel: string } | null;
  trend: RiskTrend;
  requiresAttention: boolean;
  quality: "sufficient" | "insufficient" | "unknown";
  qualityReason: string | null;
  model: { id: string; version: string; statusLabel: string };
  uncertainty: string | null;
  factors: ContributingFactor[];
}
export interface AlertRecord {
  id: string;
  regionId: string;
  assessmentId: string | null;
  severity: RiskLevel;
  trend: TrendDirection;
  title: string;
  description: string;
  createdAt: string;
  validityId: string;
  recommendedAction: string | null;
  readStatus: ReadStatus;
  rationale: string[];
}
export interface MonitoredRegion {
  id: string;
  regionId: string;
  monitoredSince: string | null;
  enabled: boolean;
}
export interface PreventionPayload {
  schemaVersion: "provisional-ui-v1";
  provenance: "demonstration" | "backend";
  updatedAt: string | null;
  regions: GeographicRegion[];
  forecastWindows: ForecastValidity[];
  /** Current results must be explicitly identified by the supplier, not inferred by UI. */
  currentAssessments: RiskAssessment[];
  riskHistory: RiskAssessment[];
  alerts: AlertRecord[];
  monitoredRegions: MonitoredRegion[];
}
export type PreventionResource =
  | { status: "success" | "demonstration"; data: PreventionPayload; message?: string }
  | { status: Exclude<DataStatus, "success" | "demonstration">; data?: never; message?: string };
export type PreventionMode = "backend" | "demonstration";
export interface PreventionAdapter {
  /** Browser-side adapter for a future contract; signal must be honored by real requests. */
  load(signal: AbortSignal): Promise<PreventionResource>;
}
