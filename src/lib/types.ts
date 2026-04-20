export type Vec3 = [number, number, number];

export type Mat3 = [Vec3, Vec3, Vec3];

export type CoordinateMode = "direct" | "cartesian";

export interface ParsedPoscar {
  title: string;
  scale: number;
  lattice: Mat3;
  species: string[];
  counts: number[];
  coordinateMode: CoordinateMode;
  positions: Vec3[];
}

export interface ReciprocalLattice {
  directBasis: Mat3;
  reciprocalBasis: Mat3;
  reciprocalInverse: Mat3;
  volume: number;
}

export interface BzPlane {
  id: string;
  normal: Vec3;
  offset: number;
  generator: Vec3;
}

export interface BzVertex {
  id: string;
  cart: Vec3;
  planeIds: string[];
}

export interface BzFace {
  id: string;
  planeId: string;
  vertexIds: string[];
  normal: Vec3;
  centroid: Vec3;
}

export interface BzEdge {
  id: string;
  vertexIds: [string, string];
  midpoint: Vec3;
}

export interface BzPolyhedron {
  faces: BzFace[];
  vertices: BzVertex[];
  edges: BzEdge[];
  planes: BzPlane[];
  center: Vec3;
}

export type BzPointType = "center" | "edge" | "line" | "poly";

export interface BzSpecialPoint {
  id: string;
  type: BzPointType;
  cart: Vec3;
  fractional: Vec3;
}

export interface BzComputation {
  parsed: ParsedPoscar;
  reciprocal: ReciprocalLattice;
  bz: BzPolyhedron;
  points: BzSpecialPoint[];
}

export interface KPathPointDraft {
  id: string;
  label: string;
  fractionalText: [string, string, string];
  sourcePointId?: string;
}

export interface KPathResolvedPoint {
  id: string;
  label: string;
  fractionalText: [string, string, string];
  sourcePointId?: string;
  fractional: Vec3 | null;
  cart: Vec3 | null;
  error: string | null;
}
