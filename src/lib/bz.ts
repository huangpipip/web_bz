import type {
  BzComputation,
  BzEdge,
  BzFace,
  BzPlane,
  BzPolyhedron,
  BzSpecialPoint,
  BzVertex,
  ParsedPoscar,
  ReciprocalLattice,
  Vec3
} from "./types";
import {
  EPSILON,
  addVec3,
  approxEqual,
  approxVec3,
  averageVec3,
  crossVec3,
  detMat3,
  dotVec3,
  gcd3,
  invertMat3,
  lengthSqVec3,
  multiplyBasisVec3,
  multiplyMat3Vec3,
  normalizeVec3,
  scaleVec3,
  subVec3
} from "./math";
import { parsePoscar } from "./poscar";

const TWO_PI = Math.PI * 2;
const HALF_SPACE_EPSILON = 1e-6;
const VERTEX_EPSILON = 1e-5;
const MAX_SHELL = 3;
const MAX_CANDIDATE_PLANES = 96;

interface CandidatePlane {
  id: string;
  normal: Vec3;
  offset: number;
  generator: Vec3;
  normSq: number;
}

interface RawIntersection {
  point: Vec3;
  planeIds: Set<string>;
}

function reciprocalBasisFromDirect(directBasis: [Vec3, Vec3, Vec3]): [Vec3, Vec3, Vec3] {
  const [a1, a2, a3] = directBasis;
  const volume = detMat3(directBasis);
  if (Math.abs(volume) < EPSILON) {
    throw new Error("Direct lattice volume is zero.");
  }
  return [
    scaleVec3(crossVec3(a2, a3), TWO_PI / volume),
    scaleVec3(crossVec3(a3, a1), TWO_PI / volume),
    scaleVec3(crossVec3(a1, a2), TWO_PI / volume)
  ];
}

export function buildReciprocalLattice(parsed: ParsedPoscar): ReciprocalLattice {
  const reciprocalBasis = reciprocalBasisFromDirect(parsed.lattice);
  return {
    directBasis: parsed.lattice,
    reciprocalBasis,
    reciprocalInverse: invertMat3([
      [reciprocalBasis[0][0], reciprocalBasis[1][0], reciprocalBasis[2][0]],
      [reciprocalBasis[0][1], reciprocalBasis[1][1], reciprocalBasis[2][1]],
      [reciprocalBasis[0][2], reciprocalBasis[1][2], reciprocalBasis[2][2]]
    ]),
    volume: Math.abs(detMat3(parsed.lattice))
  };
}

function fractionalToCartesian(basis: [Vec3, Vec3, Vec3], fractional: Vec3): Vec3 {
  return multiplyBasisVec3(basis, fractional);
}

function cartesianToFractional(inverseBasisColumns: [Vec3, Vec3, Vec3], cartesian: Vec3): Vec3 {
  return multiplyMat3Vec3(inverseBasisColumns, cartesian);
}

function generateCandidatePlanes(reciprocal: ReciprocalLattice, shell: number): CandidatePlane[] {
  const candidates: CandidatePlane[] = [];
  let id = 0;

  for (let i = -shell; i <= shell; i += 1) {
    for (let j = -shell; j <= shell; j += 1) {
      for (let k = -shell; k <= shell; k += 1) {
        if (i === 0 && j === 0 && k === 0) {
          continue;
        }
        if (gcd3(i, j, k) !== 1) {
          continue;
        }

        const fractional: Vec3 = [i, j, k];
        const cartesian = fractionalToCartesian(reciprocal.reciprocalBasis, fractional);
        const normSq = lengthSqVec3(cartesian);
        candidates.push({
          id: `plane-${id}`,
          normal: cartesian,
          offset: normSq / 2,
          generator: fractional,
          normSq
        });
        id += 1;
      }
    }
  }

  candidates.sort((left, right) => left.normSq - right.normSq);
  return candidates.slice(0, MAX_CANDIDATE_PLANES);
}

function solveThreePlanes(a: CandidatePlane, b: CandidatePlane, c: CandidatePlane): Vec3 | null {
  const matrix: [Vec3, Vec3, Vec3] = [a.normal, b.normal, c.normal];
  const determinant = detMat3(matrix);
  if (Math.abs(determinant) < EPSILON) {
    return null;
  }

  const rhs: Vec3 = [a.offset, b.offset, c.offset];
  const cross23 = crossVec3(b.normal, c.normal);
  const cross31 = crossVec3(c.normal, a.normal);
  const cross12 = crossVec3(a.normal, b.normal);

  const numerator = addVec3(
    addVec3(scaleVec3(cross23, rhs[0]), scaleVec3(cross31, rhs[1])),
    scaleVec3(cross12, rhs[2])
  );

  return scaleVec3(numerator, 1 / determinant);
}

function pointInsideAllHalfSpaces(point: Vec3, planes: CandidatePlane[]): boolean {
  return planes.every((plane) => dotVec3(point, plane.normal) <= plane.offset + HALF_SPACE_EPSILON);
}

function upsertIntersection(intersections: RawIntersection[], point: Vec3, planeIds: string[]): void {
  const existing = intersections.find((intersection) => approxVec3(intersection.point, point, VERTEX_EPSILON));
  if (existing) {
    planeIds.forEach((planeId) => existing.planeIds.add(planeId));
    return;
  }
  intersections.push({
    point,
    planeIds: new Set(planeIds)
  });
}

function collectVertices(planes: CandidatePlane[]): RawIntersection[] {
  const intersections: RawIntersection[] = [];

  for (let i = 0; i < planes.length - 2; i += 1) {
    for (let j = i + 1; j < planes.length - 1; j += 1) {
      for (let k = j + 1; k < planes.length; k += 1) {
        const point = solveThreePlanes(planes[i], planes[j], planes[k]);
        if (!point) {
          continue;
        }
        if (!pointInsideAllHalfSpaces(point, planes)) {
          continue;
        }

        const supportingPlanes = planes
          .filter((plane) => approxEqual(dotVec3(point, plane.normal), plane.offset, 1e-5))
          .map((plane) => plane.id);

        upsertIntersection(intersections, point, supportingPlanes);
      }
    }
  }

  return intersections;
}

function sortFaceVertexIds(vertexIds: string[], verticesById: Map<string, BzVertex>, normal: Vec3): string[] {
  const points = vertexIds
    .map((vertexId) => verticesById.get(vertexId))
    .filter((vertex): vertex is BzVertex => Boolean(vertex));

  const centroid = averageVec3(points.map((vertex) => vertex.cart));
  const reference = normalizeVec3(subVec3(points[0].cart, centroid));
  const tangent: Vec3 = lengthSqVec3(reference) < EPSILON ? [1, 0, 0] : reference;
  const bitangent = normalizeVec3(crossVec3(normal, tangent));

  return [...vertexIds].sort((leftId, rightId) => {
    const left = verticesById.get(leftId)!;
    const right = verticesById.get(rightId)!;
    const leftVector = subVec3(left.cart, centroid);
    const rightVector = subVec3(right.cart, centroid);

    const leftAngle = Math.atan2(dotVec3(leftVector, bitangent), dotVec3(leftVector, tangent));
    const rightAngle = Math.atan2(dotVec3(rightVector, bitangent), dotVec3(rightVector, tangent));
    return leftAngle - rightAngle;
  });
}

function buildFacesAndEdges(planes: CandidatePlane[], vertices: BzVertex[]): { faces: BzFace[]; edges: BzEdge[] } {
  const verticesById = new Map(vertices.map((vertex) => [vertex.id, vertex]));
  const faces: BzFace[] = [];

  for (const plane of planes) {
    const faceVertices = vertices.filter((vertex) => vertex.planeIds.includes(plane.id));
    if (faceVertices.length < 3) {
      continue;
    }

    const sortedVertexIds = sortFaceVertexIds(
      faceVertices.map((vertex) => vertex.id),
      verticesById,
      normalizeVec3(plane.normal)
    );

    faces.push({
      id: `face-${faces.length}`,
      planeId: plane.id,
      vertexIds: sortedVertexIds,
      normal: normalizeVec3(plane.normal),
      centroid: averageVec3(sortedVertexIds.map((vertexId) => verticesById.get(vertexId)!.cart))
    });
  }

  const edgesByKey = new Map<string, BzEdge>();
  for (const face of faces) {
    for (let index = 0; index < face.vertexIds.length; index += 1) {
      const startId = face.vertexIds[index];
      const endId = face.vertexIds[(index + 1) % face.vertexIds.length];
      const [leftId, rightId] = [startId, endId].sort();
      const key = `${leftId}:${rightId}`;

      if (!edgesByKey.has(key)) {
        const start = verticesById.get(leftId)!;
        const end = verticesById.get(rightId)!;
        edgesByKey.set(key, {
          id: `edge-${edgesByKey.size}`,
          vertexIds: [leftId, rightId],
          midpoint: scaleVec3(addVec3(start.cart, end.cart), 0.5)
        });
      }
    }
  }

  return {
    faces,
    edges: [...edgesByKey.values()]
  };
}

function buildPolyhedronFromPlanes(planes: CandidatePlane[]): BzPolyhedron {
  const rawVertices = collectVertices(planes);
  if (rawVertices.length === 0) {
    throw new Error("Failed to intersect Brillouin zone half-spaces.");
  }

  const vertices: BzVertex[] = rawVertices.map((intersection, index) => ({
    id: `vertex-${index}`,
    cart: intersection.point,
    planeIds: [...intersection.planeIds]
  }));

  const { faces, edges } = buildFacesAndEdges(planes, vertices);
  if (faces.length === 0) {
    throw new Error("Failed to build Brillouin zone faces.");
  }

  const activePlaneIds = new Set(faces.map((face) => face.planeId));
  const activePlanes: BzPlane[] = planes
    .filter((plane) => activePlaneIds.has(plane.id))
    .map((plane) => ({
      id: plane.id,
      normal: normalizeVec3(plane.normal),
      offset: plane.offset,
      generator: plane.generator
    }));

  return {
    faces,
    vertices,
    edges,
    planes: activePlanes,
    center: [0, 0, 0]
  };
}

function signatureForPolyhedron(bz: BzPolyhedron): string {
  const faces = bz.faces.length;
  const vertices = bz.vertices
    .map((vertex) => vertex.cart.map((value) => value.toFixed(4)).join(","))
    .sort()
    .join("|");
  return `${faces}:${vertices}`;
}

export function buildFirstBrillouinZone(reciprocal: ReciprocalLattice): BzPolyhedron {
  let previousSignature = "";

  for (let shell = 1; shell <= MAX_SHELL; shell += 1) {
    const candidatePlanes = generateCandidatePlanes(reciprocal, shell);
    const bz = buildPolyhedronFromPlanes(candidatePlanes);
    const signature = signatureForPolyhedron(bz);
    if (signature === previousSignature) {
      return bz;
    }
    previousSignature = signature;
    if (shell === MAX_SHELL) {
      return bz;
    }
  }

  throw new Error("Failed to build the Brillouin zone.");
}

export function extractXcrysdenStyleSpecialPoints(
  bz: BzPolyhedron,
  reciprocal: ReciprocalLattice
): BzSpecialPoint[] {
  const points: BzSpecialPoint[] = [];

  function pushPoint(type: BzSpecialPoint["type"], cart: Vec3): void {
    const exists = points.find((point) => point.type === type && approxVec3(point.cart, cart, VERTEX_EPSILON));
    if (exists) {
      return;
    }

    points.push({
      id: `point-${points.length}`,
      type,
      cart,
      fractional: cartesianToFractional(reciprocal.reciprocalInverse, cart)
    });
  }

  pushPoint("center", [0, 0, 0]);

  for (const vertex of bz.vertices) {
    pushPoint("edge", vertex.cart);
  }

  for (const edge of bz.edges) {
    pushPoint("line", edge.midpoint);
  }

  for (const face of bz.faces) {
    pushPoint("poly", face.centroid);
  }

  return points;
}

export function computeBrillouinZone(source: string): BzComputation {
  const parsed = parsePoscar(source);
  const reciprocal = buildReciprocalLattice(parsed);
  const bz = buildFirstBrillouinZone(reciprocal);
  const points = extractXcrysdenStyleSpecialPoints(bz, reciprocal);
  return {
    parsed,
    reciprocal,
    bz,
    points
  };
}
