import { useEffect, useRef, useState, type JSX, type MouseEvent, type PointerEvent, type WheelEvent } from "react";
import type { BzComputation, BzPointType, KPathResolvedPoint, Vec3 } from "../lib/types";
import {
  clamp,
  dotVec3,
  lengthVec3,
  normalizeVec3,
  scaleVec3
} from "../lib/math";

interface BzCanvasProps {
  computation: BzComputation | null;
  selectedPointId: string | null;
  kPath: KPathResolvedPoint[];
  onSelectPoint: (pointId: string | null) => void;
  showReciprocalVectors: boolean;
  viewResetToken: number;
}

interface Rotation {
  x: number;
  y: number;
  z: number;
}

interface ProjectedPoint {
  id: string;
  x: number;
  y: number;
  z: number;
  radius: number;
}

const POINT_COLORS: Record<BzPointType, string> = {
  center: "#ff7a1a",
  edge: "#f2d06b",
  line: "#5fd3bc",
  poly: "#68a5ff"
};

const POINT_RADII: Record<BzPointType, number> = {
  center: 8,
  edge: 5,
  line: 4.5,
  poly: 5
};

const DEFAULT_ROTATION: Rotation = { x: 0.8, y: -0.65, z: 0.25 };

function rotateVector(vector: Vec3, rotation: Rotation): Vec3 {
  const [x0, y0, z0] = vector;
  const cosX = Math.cos(rotation.x);
  const sinX = Math.sin(rotation.x);
  const cosY = Math.cos(rotation.y);
  const sinY = Math.sin(rotation.y);
  const cosZ = Math.cos(rotation.z);
  const sinZ = Math.sin(rotation.z);

  const y1 = y0 * cosX - z0 * sinX;
  const z1 = y0 * sinX + z0 * cosX;
  const x2 = x0 * cosY + z1 * sinY;
  const z2 = -x0 * sinY + z1 * cosY;
  const x3 = x2 * cosZ - y1 * sinZ;
  const y3 = x2 * sinZ + y1 * cosZ;

  return [x3, y3, z2];
}

function projectVector(
  vector: Vec3,
  width: number,
  height: number,
  scale: number
): { x: number; y: number; z: number } {
  return {
    x: width / 2 + vector[0] * scale,
    y: height / 2 - vector[1] * scale,
    z: vector[2]
  };
}

function getTypeLabel(type: BzPointType): string {
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

export default function BzCanvas({
  computation,
  selectedPointId,
  kPath,
  onSelectPoint,
  showReciprocalVectors,
  viewResetToken
}: BzCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [rotation, setRotation] = useState<Rotation>(DEFAULT_ROTATION);
  const [zoom, setZoom] = useState(1);
  const interactionRef = useRef<{ dragging: boolean; moved: boolean; x: number; y: number }>({
    dragging: false,
    moved: false,
    x: 0,
    y: 0
  });
  const projectedPointsRef = useRef<ProjectedPoint[]>([]);

  useEffect(() => {
    if (viewResetToken === 0) {
      return;
    }
    setRotation(DEFAULT_ROTATION);
    setZoom(1);
  }, [viewResetToken]);

  useEffect(() => {
    if (!computation) {
      return;
    }

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const resize = (): void => {
      const bounds = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(bounds.width * dpr));
      canvas.height = Math.max(1, Math.floor(bounds.height * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(context, bounds.width, bounds.height);
    };

    const draw = (ctx: CanvasRenderingContext2D, width: number, height: number): void => {
      ctx.clearRect(0, 0, width, height);

      ctx.fillStyle = "rgba(9, 18, 30, 0.96)";
      ctx.fillRect(0, 0, width, height);

      const maxRadius = Math.max(
        ...computation.bz.vertices.map((vertex) => lengthVec3(vertex.cart)),
        1
      );
      const scale = (Math.min(width, height) * 0.28 * zoom) / maxRadius;

      const verticesById = new Map(
        computation.bz.vertices.map((vertex) => [vertex.id, rotateVector(vertex.cart, rotation)])
      );

      const sortedFaces = [...computation.bz.faces]
        .map((face) => ({
          face,
          centroid: rotateVector(face.centroid, rotation)
        }))
        .sort((left, right) => left.centroid[2] - right.centroid[2]);

      for (const { face } of sortedFaces) {
        const rotatedPoints = face.vertexIds.map((vertexId) => verticesById.get(vertexId)!);
        const projected = rotatedPoints.map((point) => projectVector(point, width, height, scale));
        const faceLight = clamp(dotVec3(normalizeVec3(rotateVector(face.normal, rotation)), normalizeVec3([0.4, 0.2, 1])), 0.18, 1);

        ctx.beginPath();
        ctx.moveTo(projected[0].x, projected[0].y);
        for (let index = 1; index < projected.length; index += 1) {
          ctx.lineTo(projected[index].x, projected[index].y);
        }
        ctx.closePath();

        ctx.fillStyle = `rgba(84, 122, 182, ${0.14 + faceLight * 0.16})`;
        ctx.fill();
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = "rgba(226, 236, 255, 0.82)";
        ctx.stroke();
      }

      if (showReciprocalVectors) {
        const basis = computation.reciprocal.reciprocalBasis.map((vector) => rotateVector(vector, rotation));
        const colors = ["#ff8a3d", "#5ae6be", "#83b7ff"];
        basis.forEach((vector, index) => {
          const start = projectVector([0, 0, 0], width, height, scale);
          const mid = projectVector(scaleVec3(vector, 0.5), width, height, scale);
          const end = projectVector(vector, width, height, scale);
          const direction = normalizeVec3([end.x - mid.x, end.y - mid.y, 0]);
          const perpendicular: Vec3 = [-direction[1], direction[0], 0];

          ctx.strokeStyle = colors[index];
          ctx.fillStyle = colors[index];
          ctx.lineWidth = 2.3;
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(end.x, end.y);
          ctx.lineTo(end.x - direction[0] * 12 + perpendicular[0] * 5, end.y - direction[1] * 12 + perpendicular[1] * 5);
          ctx.lineTo(end.x - direction[0] * 12 - perpendicular[0] * 5, end.y - direction[1] * 12 - perpendicular[1] * 5);
          ctx.closePath();
          ctx.fill();

          ctx.font = "12px 'Avenir Next', 'Segoe UI', sans-serif";
          ctx.fillText(`b${index + 1}`, end.x + 8, end.y - 8);
        });
      }

      const projectedPoints = computation.points
        .map((point) => {
          const rotated = rotateVector(point.cart, rotation);
          const projected = projectVector(rotated, width, height, scale);
          return {
            point,
            x: projected.x,
            y: projected.y,
            z: projected.z,
            radius: POINT_RADII[point.type]
          };
        })
        .sort((left, right) => left.z - right.z);

      const projectedPath = kPath.map((point, index) => {
        if (!point.cart) {
          return {
            point,
            index,
            projected: null
          };
        }

        const rotated = rotateVector(point.cart, rotation);
        return {
          point,
          index,
          projected: projectVector(rotated, width, height, scale)
        };
      });

      let previousProjectedPoint: { x: number; y: number } | null = null;
      for (const entry of projectedPath) {
        if (!entry.projected) {
          previousProjectedPoint = null;
          continue;
        }

        if (previousProjectedPoint) {
          ctx.strokeStyle = "rgba(255, 118, 190, 0.95)";
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.moveTo(previousProjectedPoint.x, previousProjectedPoint.y);
          ctx.lineTo(entry.projected.x, entry.projected.y);
          ctx.stroke();
        }

        previousProjectedPoint = entry.projected;
      }

      projectedPointsRef.current = projectedPoints.map((entry) => ({
        id: entry.point.id,
        x: entry.x,
        y: entry.y,
        z: entry.z,
        radius: entry.radius
      }));

      for (const entry of projectedPoints) {
        const isSelected = entry.point.id === selectedPointId;
        ctx.beginPath();
        ctx.arc(entry.x, entry.y, entry.radius + (isSelected ? 3 : 0), 0, Math.PI * 2);
        ctx.fillStyle = POINT_COLORS[entry.point.type];
        ctx.fill();

        if (isSelected) {
          ctx.lineWidth = 2;
          ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
          ctx.stroke();
        }
      }

      for (const entry of projectedPath) {
        if (!entry.projected) {
          continue;
        }

        ctx.beginPath();
        ctx.arc(entry.projected.x, entry.projected.y, 7, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 118, 190, 0.95)";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(255, 240, 248, 0.95)";
        ctx.stroke();

        ctx.fillStyle = "#fff4fb";
        ctx.font = "12px 'Avenir Next', 'Segoe UI', sans-serif";
        ctx.fillText(String(entry.index + 1), entry.projected.x + 10, entry.projected.y - 10);
      }

      if (selectedPointId) {
        const selectedPoint = computation.points.find((point) => point.id === selectedPointId);
        const projectedPoint = projectedPoints.find((entry) => entry.point.id === selectedPointId);
        if (selectedPoint && projectedPoint) {
          const label = `${getTypeLabel(selectedPoint.type)}  ${selectedPoint.fractional
            .map((value) => value.toFixed(4))
            .join(", ")}`;

          ctx.font = "13px 'Avenir Next', 'Segoe UI', sans-serif";
          const paddingX = 10;
          const paddingY = 8;
          const textWidth = ctx.measureText(label).width;
          const boxWidth = textWidth + paddingX * 2;
          const boxHeight = 30;
          const boxX = clamp(projectedPoint.x + 12, 12, width - boxWidth - 12);
          const boxY = clamp(projectedPoint.y - 38, 12, height - boxHeight - 12);

          ctx.fillStyle = "rgba(9, 18, 30, 0.9)";
          ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
          ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
          ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

          ctx.fillStyle = "#f4f8ff";
          ctx.fillText(label, boxX + paddingX, boxY + 19);
        }
      }
    };

    const resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(container);
    resize();

    return () => resizeObserver.disconnect();
  }, [computation, kPath, rotation, selectedPointId, showReciprocalVectors, zoom]);

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>): void => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    canvas.setPointerCapture(event.pointerId);
    interactionRef.current = {
      dragging: true,
      moved: false,
      x: event.clientX,
      y: event.clientY
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>): void => {
    if (!interactionRef.current.dragging) {
      return;
    }

    const dx = event.clientX - interactionRef.current.x;
    const dy = event.clientY - interactionRef.current.y;
    interactionRef.current.moved = interactionRef.current.moved || Math.abs(dx) > 1 || Math.abs(dy) > 1;
    interactionRef.current.x = event.clientX;
    interactionRef.current.y = event.clientY;

    setRotation((current) => ({
      x: current.x + dy * 0.01,
      y: current.y + dx * 0.01,
      z: current.z
    }));
  };

  const handlePointerUp = (event: PointerEvent<HTMLCanvasElement>): void => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.releasePointerCapture(event.pointerId);
    }

    const wasMoved = interactionRef.current.moved;
    interactionRef.current.dragging = false;
    interactionRef.current.moved = wasMoved;
  };

  const handleClick = (event: MouseEvent<HTMLCanvasElement>): void => {
    if (!computation) {
      return;
    }
    if (interactionRef.current.moved) {
      interactionRef.current.moved = false;
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;

    const hit = [...projectedPointsRef.current]
      .sort((left, right) => right.z - left.z)
      .find((point) => Math.hypot(point.x - x, point.y - y) <= point.radius + 6);

    onSelectPoint(hit?.id ?? null);
  };

  const handleWheel = (event: WheelEvent<HTMLCanvasElement>): void => {
    event.preventDefault();
    setZoom((current) => clamp(current * (event.deltaY > 0 ? 0.92 : 1.08), 0.4, 3.2));
  };

  return (
    <div className="viewer-panel">
      <div className="viewer-canvas-shell" ref={containerRef}>
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={() => {
            interactionRef.current.dragging = false;
          }}
          onClick={handleClick}
          onWheel={handleWheel}
        />
        {!computation ? (
          <div className="viewer-empty">
            <p>Paste a POSCAR and render to build the first Brillouin zone.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
