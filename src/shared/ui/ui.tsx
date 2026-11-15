import type { ReactNode } from "react";
import { SENSOR_METADATA, type SensorId } from "../../features/sensors/sensors";

export type IconName =
  | "grid"
  | "globe"
  | "calendar"
  | "chart"
  | "layers"
  | "settings"
  | "arrow"
  | "chevron"
  | "bell"
  | "download"
  | "plus"
  | "minus"
  | "expand"
  | "target"
  | "flame"
  | "satellite"
  | "alert"
  | "info"
  | "close"
  | "check"
  | "external"
  | "menu"
  | "search";
export function Icon({
  name,
  size = 18,
  className = "",
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  const paths: Record<IconName, ReactNode> = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
    globe: (
      <>
        <circle cx="12" cy="12" r="9" />
        <ellipse cx="12" cy="12" rx="4" ry="9" />
        <path d="M3 12h18M5 7h14M5 17h14" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 3v4m10-4v4M3 10h18m-13 4h1m3 0h1m3 0h1M8 17h1m3 0h1" />
      </>
    ),
    chart: (
      <>
        <path d="M4 3v17h17M7 14l4-5 4 3 6-7" />
      </>
    ),
    layers: (
      <>
        <path d="m12 3 10 5-10 5L2 8l10-5Zm-10 9 10 5 10-5M2 16l10 5 10-5" />
      </>
    ),
    settings: (
      <>
        <path d="m9 3-1 3-3 1-2 4 2 2v4l4 2 2-1 3 1 4-2v-4l2-2-2-4-3-1-1-3Z" />
        <circle cx="11" cy="11" r="3" />
      </>
    ),
    arrow: <path d="M5 17 19 5M5 5h14v14" />,
    chevron: <path d="m8 10 4 4 4-4" />,
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    minus: <path d="M5 12h14" />,
    expand: <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" />,
    target: (
      <>
        <circle cx="12" cy="12" r="7" />
        <circle cx="12" cy="12" r="2" />
        <path d="M12 2v3m0 14v3M2 12h3m14 0h3" />
      </>
    ),
    flame: <path d="M13 2c1 6-5 6-4 11 1-2 3-2 4-5 5 4 7 7 4 11-3 4-11 3-12-2C3 11 9 9 13 2Z" />,
    satellite: (
      <>
        <path d="m9 9 6 6m-1-8 3 3-7 7-3-3 7-7ZM5 4l4 4-3 3-4-4 3-3Zm12 9 5 5-3 3-5-5 3-3ZM5 16c2 0 3 1 3 3m-6-3c3 0 6 3 6 6" />
      </>
    ),
    alert: (
      <>
        <path d="m12 3 10 18H2L12 3Z" />
        <path d="M12 9v5m0 3v.5" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6m0-10v.5" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
    check: <path d="m5 12 4 4L19 6" />,
    external: (
      <>
        <path d="M14 3h7v7m0-7L10 14m0-10H4v16h16v-6" />
      </>
    ),
    menu: <path d="M3 6h18M3 12h18M3 18h18" />,
    search: (
      <>
        <circle cx="10" cy="10" r="6" />
        <path d="m15 15 6 6" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

export { formatCount as format } from "../lib/format-count";
export function Dot({ color = "green" }: { color?: string }) {
  return <span className={`dot ${color}`} />;
}
export function PanelTitle({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className="panel-heading">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="panel-actions">{children}</div>
    </div>
  );
}
export function SensorBadge({ sensor }: { sensor: string }) {
  const known = sensor in SENSOR_METADATA;
  return (
    <span className={`sensor-badge ${sensor.toLowerCase()}`}>
      {known ? <span className={`sensor-color sensor-${sensor}`} /> : <Dot color="yellow" />}
      {known ? SENSOR_METADATA[sensor as SensorId].label : sensor}
    </span>
  );
}
