// SI-assisted: written with Claude (Anthropic), reviewed by the Space Monkeys team. See README.
// Loading helpers for the Territory page: keep the last answer on screen while a new one
// loads (so dragging a period does not blank the map), settle fast-changing inputs before
// requesting, and skeleton blocks shaped like the content they stand in for.
import { useEffect, useState, type CSSProperties } from "react";

// Shared with the other map pages; re-exported so Territory imports stay as they were.
export { useKeep } from "../../../shared/api/useKeep";

/** `value` once `key` has stopped changing for `ms` (the first value is used at once). */
export function useSettled<T>(value: T, key: string, ms = 350): T {
  const [settled, setSettled] = useState({ key, value });
  useEffect(() => {
    if (key === settled.key) return;
    const id = setTimeout(() => setSettled({ key, value }), ms);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` stands for `value`
  }, [key, ms]);
  return settled.value;
}

export function Skeleton({
  width = "100%",
  height = 14,
  radius = 6,
  style,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number;
  style?: CSSProperties;
}) {
  return (
    <span
      className="tr-skel"
      aria-hidden="true"
      style={{ width, height, borderRadius: radius, ...style }}
    />
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <span className="tr-loading-pill" role="status">
      <span className="tr-spinner" aria-hidden="true" />
      {label}
    </span>
  );
}
