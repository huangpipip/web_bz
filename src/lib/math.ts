import type { Mat3, Vec3 } from "./types";

export const EPSILON = 1e-7;

export function addVec3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function subVec3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function scaleVec3(v: Vec3, scalar: number): Vec3 {
  return [v[0] * scalar, v[1] * scalar, v[2] * scalar];
}

export function dotVec3(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function crossVec3(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

export function lengthSqVec3(v: Vec3): number {
  return dotVec3(v, v);
}

export function lengthVec3(v: Vec3): number {
  return Math.sqrt(lengthSqVec3(v));
}

export function normalizeVec3(v: Vec3): Vec3 {
  const length = lengthVec3(v);
  if (length < EPSILON) {
    return [0, 0, 0];
  }
  return scaleVec3(v, 1 / length);
}

export function midpointVec3(a: Vec3, b: Vec3): Vec3 {
  return scaleVec3(addVec3(a, b), 0.5);
}

export function averageVec3(points: Vec3[]): Vec3 {
  if (points.length === 0) {
    return [0, 0, 0];
  }
  const total = points.reduce<Vec3>(
    (accumulator, point) => addVec3(accumulator, point),
    [0, 0, 0]
  );
  return scaleVec3(total, 1 / points.length);
}

export function detMat3(matrix: Mat3): number {
  const [a, b, c] = matrix;
  return dotVec3(a, crossVec3(b, c));
}

export function invertMat3(matrix: Mat3): Mat3 {
  const [a, b, c] = matrix;
  const determinant = detMat3(matrix);
  if (Math.abs(determinant) < EPSILON) {
    throw new Error("Matrix is singular and cannot be inverted.");
  }

  const cofactor0 = crossVec3(b, c);
  const cofactor1 = crossVec3(c, a);
  const cofactor2 = crossVec3(a, b);

  return transposeMat3([
    scaleVec3(cofactor0, 1 / determinant),
    scaleVec3(cofactor1, 1 / determinant),
    scaleVec3(cofactor2, 1 / determinant)
  ]);
}

export function transposeMat3(matrix: Mat3): Mat3 {
  return [
    [matrix[0][0], matrix[1][0], matrix[2][0]],
    [matrix[0][1], matrix[1][1], matrix[2][1]],
    [matrix[0][2], matrix[1][2], matrix[2][2]]
  ];
}

export function multiplyMat3Vec3(matrix: Mat3, vector: Vec3): Vec3 {
  return [
    dotVec3(matrix[0], vector),
    dotVec3(matrix[1], vector),
    dotVec3(matrix[2], vector)
  ];
}

export function multiplyBasisVec3(basis: Mat3, coefficients: Vec3): Vec3 {
  return addVec3(
    addVec3(scaleVec3(basis[0], coefficients[0]), scaleVec3(basis[1], coefficients[1])),
    scaleVec3(basis[2], coefficients[2])
  );
}

export function approxEqual(a: number, b: number, epsilon = EPSILON): boolean {
  return Math.abs(a - b) <= epsilon;
}

export function approxVec3(a: Vec3, b: Vec3, epsilon = EPSILON): boolean {
  return (
    approxEqual(a[0], b[0], epsilon) &&
    approxEqual(a[1], b[1], epsilon) &&
    approxEqual(a[2], b[2], epsilon)
  );
}

export function formatVec3(vector: Vec3, digits = 5): string {
  return vector.map((value) => value.toFixed(digits)).join(" ");
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x;
}

export function gcd3(a: number, b: number, c: number): number {
  return gcd(gcd(a, b), c);
}
