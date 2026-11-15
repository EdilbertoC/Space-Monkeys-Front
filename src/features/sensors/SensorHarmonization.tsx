import { Icon, PanelTitle, SensorBadge } from "../../shared/ui/ui";
import { SensorDot } from "./SensorControls";

export default function SensorHarmonization() {
  return (
    <section className="panel harmonization-panel">
      <PanelTitle
        title="Sensor Harmonization"
        subtitle="Core Harmonization: MODIS + VIIRS · conceptual, not scientifically validated"
      >
        <span className="demo-pill">CONCEPTUAL WORKFLOW</span>
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
              <p>1 km nominal spatial resolution</p>
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
              <p>375 m nominal spatial resolution</p>
            </div>
            <SensorBadge sensor="VIIRS" />
          </div>
        </div>
        <span className="workflow-arrow">
          <Icon name="arrow" size={18} />
        </span>
        <div className="harmonization-processing">
          <span className="workflow-step">01 — PROPOSED PROCESSING</span>
          <strong>Account for sensor differences</strong>
          <p>Align timestamps & locations</p>
          <p>Account for resolution & confidence</p>
          <p>Review cross-sensor overlap</p>
          <p>Preserve detection algorithms, native formats & confidence attributes</p>
        </div>
        <span className="workflow-arrow">
          <Icon name="arrow" size={18} />
        </span>
        <div className="harmonization-output">
          <span className="workflow-step">02 — INTENDED OUTPUT</span>
          <Icon name="layers" size={21} />
          <strong>
            Harmonized fire
            <br />
            activity dataset
          </strong>
          <p>
            Shared time & spatial framework
            <br />
            Preserved sensor provenance
          </p>
          <span className="demo-pill">NOT YET IMPLEMENTED</span>
        </div>
      </div>
      <div className="extended-monitoring">
        <h3>Extended Satellite Monitoring</h3>
        <p>
          <SensorDot sensor="SENTINEL3_SLSTR" /> Sentinel-3 SLSTR · <SensorDot sensor="GOES_ABI" />{" "}
          GOES ABI
        </p>
        <p>
          Planned complementary sources, not part of the core MODIS–VIIRS harmonization workflow. No
          validated harmonization pipeline is implemented. Overpass versus geostationary scan
          frequency, spatial resolution and footprint, algorithms, native data formats and
          confidence attributes must be accounted for separately; detections must not simply be
          added into a harmonized count.
        </p>
      </div>
      <div className="source-note harmonization-note">
        <Icon name="info" size={14} />
        <span>
          Spatial resolution, overpass timing, and detection sensitivity must be accounted for
          before comparing sensors. This diagram illustrates a proposed workflow only; no scientific
          harmonization has been implemented. All displayed values remain illustrative demo data.
        </span>
      </div>
    </section>
  );
}
