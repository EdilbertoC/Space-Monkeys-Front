import { format, Icon, PanelTitle } from "../../shared/ui/ui";
import { DEFAULT_DATES } from "../history/date-selection/date-range";
import { getObservation } from "../history/demo/demo-data";
import { SensorDot } from "./SensorControls";
import {
  hasDemoData,
  matchesSensor,
  SENSOR_IDS,
  SENSOR_METADATA,
  type SensorSelection,
} from "./sensors";

export default function SatelliteSources({
  full = false,
  onInfo,
  period = DEFAULT_DATES,
  regionScale = 1,
  sensor = "ALL",
}: {
  full?: boolean;
  onInfo: () => void;
  period?: string;
  regionScale?: number;
  sensor?: SensorSelection;
}) {
  const observation = getObservation(period, regionScale);
  const coreObservations = {
    MODIS: getObservation(period, regionScale, "MODIS"),
    VIIRS: getObservation(period, regionScale, "VIIRS"),
  };
  return (
    <section className={`panel sources-panel ${full ? "sources-full" : ""}`}>
      <PanelTitle title="Satellite data sources">
        <button className="icon-button" aria-label="About satellite data" onClick={onInfo}>
          <Icon name="info" size={16} />
        </button>
      </PanelTitle>
      {full ? (
        <div className="sensor-source-cards">
          {SENSOR_IDS.map((id) => {
            const source = SENSOR_METADATA[id];
            return (
              <article className="sensor-source-card" key={id} data-source={id}>
                <h3>
                  <SensorDot sensor={id} />
                  {source.group}
                  {source.group !== source.instrument && ` · ${source.instrument}`}
                </h3>
                <p>{source.satellites}</p>
                <dl>
                  <dt>Instrument</dt>
                  <dd>{source.instrument}</dd>
                  <dt>Sensor identifier</dt>
                  <dd>{id}</dd>
                  <dt>Resolution</dt>
                  <dd>{source.resolution}</dd>
                  <dt>Orbit</dt>
                  <dd>{source.orbit}</dd>
                  <dt>Geographical coverage</dt>
                  <dd>{source.coverage}</dd>
                  <dt>Monitoring role</dt>
                  <dd>{source.role}</dd>
                  <dt>Observation timing</dt>
                  <dd>{source.cadence}</dd>
                  <dt>Algorithm / quality</dt>
                  <dd>{source.algorithm}</dd>
                  <dt>Format / provenance</dt>
                  <dd>{source.format}</dd>
                </dl>
                <div className="sensor-source-status">
                  <strong>Integration:</strong> {source.integration}
                  <br />
                  <strong>Data availability:</strong> {source.availability}
                  <br />
                  <strong>Scope:</strong>{" "}
                  {source.tier === "core"
                    ? "Core MODIS–VIIRS challenge workflow"
                    : "Extended complementary monitoring; outside core harmonization"}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        SENSOR_IDS.map((id) => (
          <div className="source-row" key={id}>
            <SensorDot sensor={id} />
            <div className="source-copy">
              <strong>
                {SENSOR_METADATA[id].label}
                <span>{SENSOR_METADATA[id].satellites}</span>
              </strong>
              <p>{SENSOR_METADATA[id].resolution}</p>
            </div>
            <span className="source-status">
              {SENSOR_METADATA[id].tier === "core" ? "Demo only" : "Planned · no data"}
            </span>
          </div>
        ))
      )}
      {!full && (
        <div className="source-observation">
          <span className="workflow-step">SELECTED OBSERVATION WINDOW</span>
          <strong>{observation.dateLabel}</strong>
          <div>
            {(["MODIS", "VIIRS"] as const).map((id) => (
              <span key={id}>
                <SensorDot sensor={id} />
                {id}
                <b>
                  {!hasDemoData(sensor) || !matchesSensor(sensor, id)
                    ? "Not selected"
                    : !coreObservations[id].hasObservations
                      ? "N/A"
                      : format(coreObservations[id].total)}
                </b>
              </span>
            ))}
          </div>
          <p>
            All Sensors includes available MODIS/VIIRS demo records only. Sentinel-3 SLSTR and GOES
            ABI have no loaded observations. Counts are not harmonized or deduplicated.
          </p>
        </div>
      )}
      <div className="source-note">
        <Icon name="info" size={14} />
        <span>
          No live integrations are connected. MODIS and VIIRS have implemented demo views only.
          Planned sources are unavailable, not zero activity.
        </span>
      </div>
      {full && (
        <div className="source-documentation">
          <h3>Core harmonization and complementary monitoring</h3>
          <p>
            MODIS and VIIRS remain the original challenge focus. No scientifically validated
            harmonization pipeline has been implemented. Sentinel-3 SLSTR and GOES ABI are planned
            complementary sources, not harmonized measurements. Spatial footprints, overpass versus
            scan frequency, algorithms, native file formats, confidence attributes and quality flags
            must be interpreted separately before comparison. GOES footprints vary away from the
            subsatellite point, and its coverage is regional rather than global.
          </p>
          <a
            className="button secondary"
            href="https://firms.modaps.eosdis.nasa.gov/"
            target="_blank"
            rel="noreferrer"
          >
            MODIS / VIIRS reference: NASA FIRMS
            <Icon name="external" size={15} />
          </a>
        </div>
      )}
    </section>
  );
}
