// SI-assisted: written with Claude (Anthropic), reviewed by the Space Monkeys team. See README.
// Pieces every map page shares, taken from the Territory map: a one-line hint on how to use
// the map, a legend whose colour steps carry words and a note on the unit, and a stage that
// keeps the previous cells (dimmed) under an "Updating…" pill while new ones load.
import type { ReactNode } from "react";

/** One line above the map on how to move around it. */
export function MapHint({ children }: { children?: ReactNode }) {
  return (
    <p className="geo-hint">
      {children ??
        "Drag to move · scroll, double-click or +/− to zoom · ⟲ resets · hover a cell for its numbers."}
    </p>
  );
}

/**
 * Wraps a GeoMap. `firstLoad` shows a pill over the empty map; `refreshing` dims the cells
 * still on screen while their replacement loads.
 */
export function MapStage({
  firstLoad = false,
  refreshing = false,
  loadingLabel = "Loading cells…",
  children,
}: {
  firstLoad?: boolean;
  refreshing?: boolean;
  loadingLabel?: string;
  children: ReactNode;
}) {
  return (
    <div className={`geo-stage ${refreshing ? "refreshing" : ""}`} aria-busy={firstLoad || refreshing}>
      {(firstLoad || refreshing) && (
        <span className="geo-loading-pill" role="status">
          <span className="geo-spinner" aria-hidden="true" />
          {firstLoad ? loadingLabel : "Updating…"}
        </span>
      )}
      {children}
    </div>
  );
}

/** Colour steps with words under them, a note on what a cell measures, and extra keys. */
export function MapLegend({
  steps,
  note,
  children,
}: {
  /** Swatch class (e.g. "l1", "fc2") and the word shown under it ("" for none). */
  steps: readonly (readonly [string, string])[];
  note: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="geo-legend-body">
      <div className="geo-scale">
        {steps.map(([cls, label]) => (
          <span key={cls}>
            <i className={`geo-swatch ${cls}`} />
            {label}
          </span>
        ))}
      </div>
      <span className="geo-legend-note">{note}</span>
      {children}
    </div>
  );
}

/** Five-step fire cell-day ramp, labelled at its ends. */
export const LEVEL_STEPS = [
  ["l1", "Fewest"],
  ["l2", ""],
  ["l3", ""],
  ["l4", ""],
  ["l5", "Most"],
] as const;
