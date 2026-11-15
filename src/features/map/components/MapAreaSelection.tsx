import { useRef, useState } from "react";
import {
  cellBounds,
  GRID_COLUMNS,
  GRID_ROWS,
  validPolygon,
  type AreaSelection,
  type MapPoint,
} from "../../history/demo/exploration";

export type AreaTool = "Pan" | "Cell" | "Multi-cell" | "Rectangle" | "Polygon";
export default function MapAreaSelection({
  tool,
  value,
  onChange,
  initialCursor = { x: 500, y: 225 },
}: {
  tool: AreaTool;
  value: AreaSelection | null;
  onChange: (area: AreaSelection | null) => void;
  initialCursor?: MapPoint;
}) {
  const group = useRef<SVGGElement>(null);
  const [draft, setDraft] = useState<MapPoint[]>([]);
  const [activeCell, setActiveCell] = useState(6 * GRID_COLUMNS + 11);
  const [keyboardCursor, setKeyboardCursor] = useState<MapPoint>(initialCursor);
  const [keyboardActive, setKeyboardActive] = useState(false);
  const origin = useRef<MapPoint | null>(null);
  const position = (e: { clientX: number; clientY: number }): MapPoint => {
    const matrix = group.current?.getScreenCTM();
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix?.inverse());
    return {
      x: Math.round(Math.max(0, Math.min(1000, p.x))),
      y: Math.round(Math.max(0, Math.min(450, p.y))),
    };
  };
  const chooseCell = (index: number) => {
    const previous = tool === "Multi-cell" && value?.kind === "cells" ? value.cells : [];
    const cells = previous.includes(index)
      ? previous.filter((i) => i !== index)
      : [...previous, index];
    onChange(cells.length ? { kind: "cells", cells, points: [] } : null);
  };
  const shape = value?.kind === "rectangle" ? value.points : draft;
  const rectangle = (points: MapPoint[]) =>
    points.length >= 2
      ? {
          x: Math.min(points[0].x, points[1].x),
          y: Math.min(points[0].y, points[1].y),
          width: Math.abs(points[0].x - points[1].x),
          height: Math.abs(points[0].y - points[1].y),
        }
      : null;
  const box = rectangle(tool === "Rectangle" && draft.length ? draft : shape);
  const finishPolygon = () => {
    if (!validPolygon(draft)) return;
    onChange({ kind: "polygon", points: draft, cells: [] });
    setDraft([]);
  };
  return (
    <g
      ref={group}
      className="area-selection-layer"
      role="group"
      aria-label="Geographical area selection"
    >
      {tool !== "Pan" && (
        <g
          onPointerDown={(e) => {
            e.stopPropagation();
            if (tool !== "Rectangle") return;
            const p = position(e);
            origin.current = p;
            setDraft([p, p]);
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (tool === "Rectangle" && origin.current) setDraft([origin.current, position(e)]);
          }}
          onPointerUp={(e) => {
            if (tool !== "Rectangle" || !origin.current) return;
            const points = [origin.current, position(e)];
            origin.current = null;
            setDraft([]);
            if (Math.abs(points[0].x - points[1].x) < 3 || Math.abs(points[0].y - points[1].y) < 3)
              return;
            onChange({ kind: "rectangle", points, cells: [] });
          }}
          onPointerCancel={() => {
            origin.current = null;
            setDraft([]);
          }}
          onClick={(e) => {
            if (tool === "Polygon" && e.detail < 2) setDraft((p) => [...p, position(e)]);
          }}
          onDoubleClick={tool === "Polygon" ? finishPolygon : undefined}
        >
          {tool === "Cell" || tool === "Multi-cell" ? (
            Array.from({ length: GRID_COLUMNS * GRID_ROWS }, (_, index) => (
              <rect
                key={index}
                {...cellBounds(index)}
                className="area-grid-cell"
                role="button"
                data-cell={index}
                tabIndex={index === activeCell ? 0 : -1}
                aria-label={`Select grid cell row ${Math.floor(index / GRID_COLUMNS) + 1}, column ${(index % GRID_COLUMNS) + 1}`}
                aria-pressed={value?.cells.includes(index) ?? false}
                onClick={() => chooseCell(index)}
                onFocus={() => setActiveCell(index)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    chooseCell(index);
                  }
                  const steps: Record<string, number> = {
                    ArrowLeft: -1,
                    ArrowRight: 1,
                    ArrowUp: -GRID_COLUMNS,
                    ArrowDown: GRID_COLUMNS,
                  };
                  if (e.key in steps || e.key === "Home" || e.key === "End") {
                    e.preventDefault();
                    const next =
                      e.key === "Home"
                        ? 0
                        : e.key === "End"
                          ? GRID_COLUMNS * GRID_ROWS - 1
                          : Math.max(
                              0,
                              Math.min(GRID_COLUMNS * GRID_ROWS - 1, index + steps[e.key]),
                            );
                    setActiveCell(next);
                    group.current?.querySelector<SVGRectElement>(`[data-cell="${next}"]`)?.focus();
                  }
                }}
              />
            ))
          ) : (
            <rect
              width="1000"
              height="450"
              fill="transparent"
              className="area-drawing-surface"
              role="button"
              tabIndex={0}
              aria-label={
                tool === "Polygon"
                  ? "Draw polygon. Click vertices and double-click to finish. Keyboard: arrows move cursor, Space adds vertex, Enter finishes, Escape cancels."
                  : "Draw rectangle. Drag with pointer, or use arrows to move cursor and Space to set each corner. Escape cancels."
              }
              onFocus={() => setKeyboardActive(true)}
              onBlur={() => setKeyboardActive(false)}
              onKeyDown={(e) => {
                const steps: Record<string, [number, number]> = {
                  ArrowLeft: [-1, 0],
                  ArrowRight: [1, 0],
                  ArrowUp: [0, -1],
                  ArrowDown: [0, 1],
                };
                if (e.key in steps) {
                  e.preventDefault();
                  const step = e.shiftKey ? 5 : 25;
                  const [dx, dy] = steps[e.key];
                  const next = {
                    x: Math.max(0, Math.min(1000, keyboardCursor.x + dx * step)),
                    y: Math.max(0, Math.min(450, keyboardCursor.y + dy * step)),
                  };
                  setKeyboardCursor(next);
                  if (tool === "Rectangle" && draft.length) setDraft([draft[0], next]);
                }
                if (e.key === " ") {
                  e.preventDefault();
                  if (tool === "Polygon") setDraft((points) => [...points, keyboardCursor]);
                  else if (!draft.length) setDraft([keyboardCursor, keyboardCursor]);
                  else {
                    if (
                      Math.abs(draft[0].x - keyboardCursor.x) >= 3 &&
                      Math.abs(draft[0].y - keyboardCursor.y) >= 3
                    ) {
                      onChange({
                        kind: "rectangle",
                        points: [draft[0], keyboardCursor],
                        cells: [],
                      });
                      setDraft([]);
                    }
                  }
                }
                if (e.key === "Enter" && tool === "Polygon") {
                  e.preventDefault();
                  finishPolygon();
                }
                if (e.key === "Escape") setDraft([]);
              }}
            />
          )}
        </g>
      )}
      <g className="area-selected-shape" pointerEvents="none">
        {value?.kind === "cells" && value.cells.map((i) => <rect key={i} {...cellBounds(i)} />)}
        {value?.kind === "rectangle" && box && <rect {...box} />}
        {value?.kind === "polygon" && (
          <polygon points={value.points.map((p) => `${p.x},${p.y}`).join(" ")} />
        )}
        {tool === "Rectangle" && draft.length >= 2 && rectangle(draft) && (
          <rect {...rectangle(draft)!} />
        )}
        {tool === "Polygon" && draft.length > 0 && (
          <>
            <polyline points={draft.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" />
            {draft.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="3" />
            ))}
          </>
        )}
        {keyboardActive && (tool === "Rectangle" || tool === "Polygon") && (
          <g className="area-keyboard-cursor">
            <circle cx={keyboardCursor.x} cy={keyboardCursor.y} r="5" fill="none" />
            <path
              d={`M${keyboardCursor.x - 10},${keyboardCursor.y}h20 M${keyboardCursor.x},${keyboardCursor.y - 10}v20`}
            />
          </g>
        )}
      </g>
    </g>
  );
}
