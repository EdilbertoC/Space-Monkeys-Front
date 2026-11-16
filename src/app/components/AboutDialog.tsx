// SI-assisted: written with Claude (Anthropic), reviewed by the Space Monkeys team. See README.
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
          aria-label="Close"
          onClick={() => onClose()}
        >
          <Icon name="close" />
        </button>
        <h2 id="about-title">How the record is built</h2>
        <ol className="about-steps">
          <li>
            <strong>One unit.</strong> A fire cell-day is a 0.1° cell (about 11 km) with at least
            one satellite detection on one UTC day. It is not a count of fires and not burned area.
          </li>
          <li>
            <strong>Two sensors that count differently.</strong> MODIS (1 km pixels, from 2000) and
            VIIRS (375 m, from 2012). VIIRS sees small fires MODIS misses, so a record that simply
            switches sensors more than doubles in 2012.
          </li>
          <li>
            <strong>A bridge learned while both flew.</strong> On 2012–2021, when the MODIS orbits
            were stable, a model learned what MODIS would have recorded from what VIIRS saw. On
            held-out years its monthly error is 3.7% for Brazil.
          </li>
          <li>
            <strong>One series in MODIS units.</strong> The harmonized series is observed MODIS
            while MODIS delivers data, then the VIIRS estimate. From 2022 the MODIS orbits drift, so
            those years are marked where they matter.
          </li>
        </ol>
        <div className="modal-callout">
          <Icon name="info" />
          <p>
            Data: NASA FIRMS (MODIS Collection 6.1, VIIRS 375 m), NOAA GOES-19 ABI as the real-time
            anchor of the forecast, IBGE 2019 biomes. Full credits on About the data. A research
            prototype for NASA Space Apps 2026; not for emergency decisions.
          </p>
        </div>
        <button className="button primary" onClick={() => onClose()}>
          Close
        </button>
      </section>
    </div>
  );
}
