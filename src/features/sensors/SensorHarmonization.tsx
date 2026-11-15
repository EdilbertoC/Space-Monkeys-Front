// SI-assisted: written with Claude (Anthropic), reviewed by the Space Monkeys team. See README.
// How MODIS and VIIRS are harmonized, as reported by the API (/history/meta).
import type { Meta } from "../history/model/history-view";
import { Icon, PanelTitle, SensorBadge } from "../../shared/ui/ui";
import { SensorDot } from "./SensorControls";

export default function SensorHarmonization({ meta }: { meta: Meta | null }) {
  const h = meta?.harmonization;
  const metrics = h?.test_metrics
    ? Object.entries(h.test_metrics)
        .filter(([, v]) => typeof v === "number")
        .slice(0, 4)
    : [];
  return (
    <section className="panel harmonization-panel">
      <PanelTitle
        title="Sensor Harmonization"
        subtitle="MODIS and VIIRS combined into one record in MODIS-equivalent units"
      >
        <span className="demo-pill">{h ? `STATUS: ${h.status.toUpperCase()}` : "LOADING"}</span>
      </PanelTitle>
      <div className="harmonization-flow">
        <div className="harmonization-sources">
          <div className="harmonization-source">
            <span className="source-icon yellow">
              <Icon name="satellite" size={20} />
            </span>
            <div>
              <strong>
                MODIS <span>Terra / Aqua</span>
              </strong>
              <p>1 km pixel · the long, consistent record since 2000</p>
            </div>
            <SensorBadge sensor="MODIS" />
          </div>
          <div className="harmonization-source">
            <span className="source-icon orange">
              <Icon name="satellite" size={20} />
            </span>
            <div>
              <strong>
                VIIRS <span>Suomi-NPP / NOAA-20 / NOAA-21</span>
              </strong>
              <p>375 m pixel · sees smaller fires, since 2012</p>
            </div>
            <SensorBadge sensor="VIIRS" />
          </div>
        </div>
        <span className="workflow-arrow">
          <Icon name="arrow" size={18} />
        </span>
        <div className="harmonization-processing">
          <span className="workflow-step">01 — COMMON UNIT</span>
          <strong>Fire cell-days on a 0.1° grid</strong>
          <p>A cell counts once per UTC day if a sensor detected fire</p>
          <p>Sensors combined with OR, never summed</p>
          <p>Static sources removed, per-sensor confidence thresholds</p>
          <span className="workflow-step">02 — CALIBRATION</span>
          <p>{h?.method ?? "Loading the method from the API…"}</p>
        </div>
        <span className="workflow-arrow">
          <Icon name="arrow" size={18} />
        </span>
        <div className="harmonization-output">
          <span className="workflow-step">03 — OUTPUT</span>
          <Icon name="layers" size={21} />
          <strong>
            Harmonized fire
            <br />
            cell-days
          </strong>
          <p>
            MODIS where MODIS delivers data, the VIIRS estimate after
            {h?.switch_date ? ` ${h.switch_date}` : " MODIS ends"}
          </p>
          {h?.model && (
            <p>
              Model {h.model}
              {h.version ? ` ${h.version}` : ""}
            </p>
          )}
          {metrics.length > 0 && (
            <p>
              Held-out:{" "}
              {metrics
                .map(([k, v]) => `${k.replace(/_/g, " ")} ${(v as number).toFixed(3)}`)
                .join(" · ")}
            </p>
          )}
        </div>
      </div>
      <div className="extended-monitoring">
        <h3>Other satellites</h3>
        <p>
          <SensorDot sensor="GOES_ABI" /> GOES ABI · <SensorDot sensor="SENTINEL3_SLSTR" />{" "}
          Sentinel-3 SLSTR
        </p>
        <p>
          GOES ABI (geostationary, about 2 km, every 10 minutes) feeds only the live fire layer and
          the real-time anchor of the forecast; it is not part of the historical record. Sentinel-3
          SLSTR is not used.
        </p>
      </div>
      <div className="source-note harmonization-note">
        <Icon name="info" size={14} />
        <span>
          Fire cell-days are not hotspot counts, fire intensity or burned area. The full method is
          in the backend repository (docs/methodology.md).
        </span>
      </div>
    </section>
  );
}
