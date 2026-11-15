import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Icon, SensorBadge } from "../../../shared/ui/ui";
import { SENSOR_METADATA } from "../../sensors/sensors";
import type { MapLocationSelection } from "../model/map-location";
import "../styles/map-location.css";

export default function MapLocationDialog({
  location,
  observationWindow,
  onClose,
  onFocusLocation,
  onExploreRegion,
  container,
}: {
  location: MapLocationSelection;
  observationWindow: string;
  onClose: () => void;
  onFocusLocation: () => void;
  onExploreRegion: () => void;
  container: Element;
}) {
  const dialog = useRef<HTMLElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const source = SENSOR_METADATA[location.sensor];
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    close.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      if (
        previous?.isConnected &&
        (previous instanceof HTMLElement || previous instanceof SVGElement)
      )
        previous.focus({ preventScroll: true });
    };
  }, []);
  return createPortal(
    <div
      className="map-location-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={dialog}
        className="map-location-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`Location details: ${location.region}`}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            e.preventDefault();
            onClose();
          }
          if (e.key === "Tab") {
            const buttons = [
              ...e.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
            ];
            if (e.shiftKey && document.activeElement === buttons[0]) {
              e.preventDefault();
              buttons[buttons.length - 1]?.focus();
            } else if (!e.shiftKey && document.activeElement === buttons[buttons.length - 1]) {
              e.preventDefault();
              buttons[0]?.focus();
            }
          }
        }}
      >
        <header className="map-location-header">
          <span>ORBITBURN INTELLIGENCE</span>
          <button
            ref={close}
            className="icon-button"
            aria-label="Close location details"
            onClick={onClose}
          >
            <Icon name="close" size={20} />
          </button>
          <h2>{location.region}</h2>
          <div>
            <SensorBadge sensor={location.sensor} />
            <span>Illustrative spatial sample · not a confirmed incident</span>
          </div>
        </header>
        <div className="map-location-body">
          <p className="map-location-window">
            <Icon name="calendar" size={15} />
            <span>
              Selected observation window<strong>{observationWindow}</strong>
              <small>Filter context only; the marker has no acquisition timestamp.</small>
            </span>
          </p>
          <div className="map-location-metrics">
            <div>
              <span>Anomaly score</span>
              <strong>Not supplied</strong>
              <p>No anomaly score is available for this spatial demo marker.</p>
            </div>
            <div>
              <span>Harmonized FRP</span>
              <strong>Not computed</strong>
              <p>Sensor harmonization is not implemented. No MW value is inferred.</p>
            </div>
          </div>
          <dl className="map-location-facts">
            <div>
              <dt>Source sensor</dt>
              <dd>{source.label}</dd>
            </div>
            <div>
              <dt>Nominal sensor resolution</dt>
              <dd>{source.resolution}</dd>
            </div>
            <div>
              <dt>Observation timestamp</dt>
              <dd>{location.observation.observedAt ?? "Not supplied"}</dd>
            </div>
            <div>
              <dt>Acquiring satellite</dt>
              <dd>{location.observation.satellite ?? "Not supplied"}</dd>
            </div>
            <div>
              <dt>Confidence</dt>
              <dd>{location.observation.confidence ?? "Not supplied"}</dd>
            </div>
            <div>
              <dt>Marker position · demo map grid</dt>
              <dd className="map-location-position">
                X {location.mapPosition.x.toFixed(2)} · Y {location.mapPosition.y.toFixed(2)}
              </dd>
            </div>
          </dl>
          <section className="map-location-workflow">
            <h3>
              <Icon name="target" size={18} />
              Suggested review workflow
            </h3>
            <ol>
              <li>Review the selected period in Historical Analysis or the Burning Calendar.</li>
              <li>Inspect nearby markers and available sensor coverage using the map controls.</li>
              <li>
                Cross-check real conditions with official local fire and emergency information.
              </li>
            </ol>
          </section>
          <div className="map-location-disclaimer">
            <Icon name="info" size={17} />
            <p>
              This location and its marker are illustrative. They are not an official emergency
              warning, a live incident report, or a validated risk assessment. A continent-level
              region is the only location label supplied; no country, biome, or area boundary is
              inferred.
            </p>
          </div>
        </div>
        <footer className="map-location-actions">
          <button className="button map-location-focus" onClick={onFocusLocation}>
            <Icon name="target" size={16} />
            Focus this location
            <Icon name="arrow" size={15} />
          </button>
          <button className="text-link" onClick={onExploreRegion}>
            Explore this region
            <Icon name="arrow" size={13} />
          </button>
        </footer>
      </section>
    </div>,
    container,
  );
}
