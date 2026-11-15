import type { PreventionAdapter } from "./contracts";

/** Frontend-only integration seam. No routes, domains, credentials or API contract are assumed.
 * Set these only once the backend team supplies its contract; implement a browser adapter
 * that validates/normalizes those responses to contracts.ts. Never ship private credentials. */
export const preventionIntegration: {
  endpoints: {
    regions: string | null;
    assessments: string | null;
    alerts: string | null;
    monitoredRegions: string | null;
  };
  adapter: PreventionAdapter | null;
} = {
  endpoints: { regions: null, assessments: null, alerts: null, monitoredRegions: null },
  adapter: null,
};
