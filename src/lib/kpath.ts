import { multiplyBasisVec3 } from "./math";
import type {
  BzSpecialPoint,
  KPathPointDraft,
  KPathResolvedPoint,
  ReciprocalLattice,
  Vec3
} from "./types";

export type KPathExportFormat = "vasp" | "wannier90";

const DEFAULT_VASP_LINE_POINTS = 50;

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

function formatKPathLine(point: KPathPointDraft, index: number, separator: string): string {
  const label = point.label.trim() || `K.${index + 1}`;
  const coordinates = `${point.fractionalText[0]} ${point.fractionalText[1]} ${point.fractionalText[2]}`;
  return `${coordinates}${separator}${label}`;
}

function sanitizeVaspLinePoints(pointsPerLine: number): number {
  if (!Number.isFinite(pointsPerLine)) {
    return DEFAULT_VASP_LINE_POINTS;
  }
  return Math.max(1, Math.floor(pointsPerLine));
}

export function canFormatVaspKpoints(points: KPathPointDraft[]): boolean {
  return points.length >= 2 && points.length % 2 === 0;
}

export function formatKPathExport(
  points: KPathPointDraft[],
  format: KPathExportFormat = "wannier90",
  vaspLinePoints = DEFAULT_VASP_LINE_POINTS
): string {
  if (points.length === 0) {
    return "";
  }

  if (format === "vasp") {
    if (!canFormatVaspKpoints(points)) {
      return "";
    }

    const linePoints = sanitizeVaspLinePoints(vaspLinePoints);
    const lines = [
      "KPOINTS",
      `${linePoints} !${linePoints} grid`,
      "Line-mode",
      "reciprocal"
    ];

    for (let index = 0; index < points.length; index += 2) {
      lines.push(formatKPathLine(points[index], index, " ! "));
      lines.push(formatKPathLine(points[index + 1], index + 1, " ! "));
      if (index + 2 < points.length) {
        lines.push("");
      }
    }

    return lines.join("\n");
  }

  return points
    .map((point, index) => formatKPathLine(point, index, " "))
    .join("\n");
}
