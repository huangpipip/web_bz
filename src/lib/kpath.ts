import { multiplyBasisVec3 } from "./math";
import type {
  BzSpecialPoint,
  KPathPointDraft,
  KPathResolvedPoint,
  ReciprocalLattice,
  Vec3
} from "./types";

function createPointId(): string {
  return `kpath-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function defaultLabelForPoint(point: BzSpecialPoint, index: number): string {
  if (point.type === "center") {
    return "GAMMA";
  }
  return `K.${index + 1}`;
}

export function createKPathPointFromSpecialPoint(point: BzSpecialPoint, index: number): KPathPointDraft {
  return {
    id: createPointId(),
    label: defaultLabelForPoint(point, index),
    fractionalText: point.fractional.map((value) => value.toFixed(5)) as [string, string, string],
    sourcePointId: point.id
  };
}

export function createCustomKPathPoint(index: number): KPathPointDraft {
  return {
    id: createPointId(),
    label: `K.${index + 1}`,
    fractionalText: ["0.00000", "0.00000", "0.00000"]
  };
}

function parseFractionalComponent(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseFractionalVector(values: [string, string, string]): Vec3 | null {
  const parsed = values.map(parseFractionalComponent);
  if (parsed.some((value) => value === null)) {
    return null;
  }
  return parsed as Vec3;
}

export function resolveKPathPoints(
  drafts: KPathPointDraft[],
  reciprocal: ReciprocalLattice
): KPathResolvedPoint[] {
  return drafts.map((draft) => {
    const fractional = parseFractionalVector(draft.fractionalText);
    if (!fractional) {
      return {
        ...draft,
        fractional: null,
        cart: null,
        error: "K-point coordinates must contain three valid numbers."
      };
    }

    return {
      ...draft,
      fractional,
      cart: multiplyBasisVec3(reciprocal.reciprocalBasis, fractional),
      error: null
    };
  });
}

export function formatKPathExport(points: KPathPointDraft[]): string {
  if (points.length === 0) {
    return "";
  }

  return points
    .map((point, index) => {
      const label = point.label.trim() || `K.${index + 1}`;
      return `${point.fractionalText[0]} ${point.fractionalText[1]} ${point.fractionalText[2]} ${label}`;
    })
    .join("\n");
}
