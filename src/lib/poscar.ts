import type { CoordinateMode, Mat3, ParsedPoscar, Vec3 } from "./types";
import { detMat3, scaleVec3 } from "./math";

function parseVector(line: string, label: string): Vec3 {
  const values = line
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .map((token) => Number(token));

  if (values.length !== 3 || values.some((value) => Number.isNaN(value))) {
    throw new Error(`Failed to parse ${label}.`);
  }

  return [values[0], values[1], values[2]];
}

function isNumericLine(line: string): boolean {
  return line
    .trim()
    .split(/\s+/)
    .every((token) => token.length > 0 && !Number.isNaN(Number(token)));
}

function normalizeCoordinateMode(line: string): CoordinateMode {
  const normalized = line.trim().toLowerCase();
  if (normalized.startsWith("d")) {
    return "direct";
  }
  if (normalized.startsWith("c") || normalized.startsWith("k")) {
    return "cartesian";
  }
  throw new Error(`Unsupported coordinate mode: "${line}".`);
}

function applyScale(lattice: Mat3, scale: number): Mat3 {
  if (scale > 0) {
    return lattice.map((vector) => scaleVec3(vector, scale)) as Mat3;
  }

  const rawVolume = Math.abs(detMat3(lattice));
  if (rawVolume === 0) {
    throw new Error("POSCAR lattice has zero volume.");
  }
  const targetVolume = Math.abs(scale);
  const factor = Math.cbrt(targetVolume / rawVolume);
  return lattice.map((vector) => scaleVec3(vector, factor)) as Mat3;
}

export function parsePoscar(source: string): ParsedPoscar {
  const lines = source
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 8) {
    throw new Error("POSCAR is too short.");
  }

  const title = lines[0];
  const scale = Number(lines[1]);
  if (Number.isNaN(scale) || scale === 0) {
    throw new Error("POSCAR scale must be a non-zero number.");
  }

  const rawLattice: Mat3 = [
    parseVector(lines[2], "lattice vector a1"),
    parseVector(lines[3], "lattice vector a2"),
    parseVector(lines[4], "lattice vector a3")
  ];
  const lattice = applyScale(rawLattice, scale);

  let cursor = 5;
  let species: string[] = [];

  if (!isNumericLine(lines[cursor])) {
    species = lines[cursor].split(/\s+/);
    cursor += 1;
  }

  const counts = lines[cursor]
    .split(/\s+/)
    .map((token) => Number(token))
    .filter((value) => !Number.isNaN(value));

  if (counts.length === 0 || counts.some((count) => count <= 0 || !Number.isInteger(count))) {
    throw new Error("POSCAR atom counts line is invalid.");
  }

  cursor += 1;
  if (species.length === 0) {
    species = counts.map((_, index) => `X${index + 1}`);
  }

  if (species.length !== counts.length) {
    throw new Error("Species count does not match atom counts.");
  }

  if (lines[cursor]?.toLowerCase().startsWith("s")) {
    cursor += 1;
  }

  const coordinateMode = normalizeCoordinateMode(lines[cursor] ?? "");
  cursor += 1;

  const totalAtoms = counts.reduce((sum, count) => sum + count, 0);
  const positions: Vec3[] = [];
  for (let index = 0; index < totalAtoms; index += 1) {
    const line = lines[cursor + index];
    if (!line) {
      throw new Error("POSCAR ended before all atomic coordinates were read.");
    }
    positions.push(parseVector(line, `atomic position ${index + 1}`));
  }

  return {
    title,
    scale,
    lattice,
    species,
    counts,
    coordinateMode,
    positions
  };
}
