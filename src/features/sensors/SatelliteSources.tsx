// Static description of each satellite source (what it is and how this system uses it).
import { Icon, PanelTitle } from "../../shared/ui/ui";
import { SensorDot } from "./SensorControls";
import { SENSOR_IDS, SENSOR_METADATA } from "./sensors";

export default function SatelliteSources({ onInfo }: { onInfo: () => void }) {
  return (
    <section className="panel sources-panel sources-full">
      <PanelTitle title="Satellite data sources">
        <button className="icon-button" aria-label="About satellite data" onClick={onInfo}>
          <Icon name="info" size={16} />
        </button>
      </PanelTitle>
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
      <div className="source-documentation">
        <h3>Core harmonization and complementary monitoring</h3>
        <p>
          MODIS and VIIRS are the challenge focus and the only sources of the historical record and
          its harmonization. GOES ABI feeds the real-time fire layer only. Sentinel-3 SLSTR is not
          used. Footprints, overpass times, algorithms and confidence attributes differ between
          sensors, so detections are never simply added together.
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
    </section>
  );
}
