import type { JSX } from "react";
import type { BzComputation, BzPointType } from "../lib/types";

interface SpecialPointTableProps {
  computation: BzComputation | null;
  selectedPointId: string | null;
  onSelectPoint: (pointId: string) => void;
}

function typeLabel(type: BzPointType): string {
  switch (type) {
    case "center":
      return "Center";
    case "edge":
      return "Vertex";
    case "line":
      return "Edge midpoint";
    case "poly":
      return "Face center";
  }
}

function renderVector(values: [number, number, number]): string {
  return values.map((value) => value.toFixed(5)).join("  ");
}

export default function SpecialPointTable({
  computation,
  selectedPointId,
  onSelectPoint
}: SpecialPointTableProps): JSX.Element {
  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Special Points</h2>
        <p>Directly extracted from the BZ polyhedron in XCrySDen style.</p>
      </div>

      {!computation ? (
        <div className="panel-empty">
          <p>No Brillouin zone has been computed yet.</p>
        </div>
      ) : (
        <div className="point-table">
          <div className="point-table-head">
            <span>Type</span>
            <span>Reciprocal fractional</span>
            <span>Reciprocal cartesian</span>
          </div>
          <div className="point-table-body">
            {computation.points.map((point) => (
              <button
                key={point.id}
                className={point.id === selectedPointId ? "point-row point-row-active" : "point-row"}
                type="button"
                onClick={() => onSelectPoint(point.id)}
              >
                <span>{typeLabel(point.type)}</span>
                <code>{renderVector(point.fractional)}</code>
                <code>{renderVector(point.cart)}</code>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
