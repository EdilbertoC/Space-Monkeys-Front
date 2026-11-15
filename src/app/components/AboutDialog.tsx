import { Icon } from "../../shared/ui/ui";

export default function AboutDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={() => onClose()}>
      <section
        className="info-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          autoFocus
          className="modal-close icon-button"
          aria-label="Close about dialog"
          onClick={() => onClose()}
        >
          <Icon name="close" />
        </button>
        <span className="modal-logo">
          <Icon name="flame" size={31} />
        </span>
        <span className="eyebrow">EARTH OBSERVATION, IN CONTEXT</span>
        <h2 id="about-title">Meet OrbitBurn.</h2>
        <p>
          A satellite-based wildfire intelligence concept created for the NASA Space Apps Challenge
          2026. Built to help researchers, responders, and environmental managers see the bigger
          picture.
        </p>
        <div className="modal-callout">
          <Icon name="info" />
          <p>
            This is an illustrative demo. All detection counts, trends, alerts, and hotspot
            locations are synthetic. OrbitBurn is not connected to live NASA data and must not be
            used for emergency decisions.
          </p>
        </div>
        <h3>Complementary sensors</h3>
        <p>
          MODIS observes thermal anomalies at 1 km resolution. VIIRS adds detail at 375 m.
          Observations represent potential heat sources, not verified fires or burned-area
          measurements.
        </p>
        <button className="button primary" onClick={() => onClose()}>
          Back to the workspace <Icon name="arrow" size={15} />
        </button>
      </section>
    </div>
  );
}
