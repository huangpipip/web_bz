import { lengthVec3 } from "./math";
import type { BzComputation, BzSpecialPoint, Vec3 } from "./types";

export interface ViewerFacePolygon {
  id: string;
  centroid: Vec3;
  normal: Vec3;
  vertices: Vec3[];
}

export interface ViewerEdgeSegment {
  id: string;
  start: Vec3;
  end: Vec3;
}

export interface ViewerSpecialPoint extends BzSpecialPoint {}

export function buildBzFacePolygons(computation: BzComputation): ViewerFacePolygon[] {
  const verticesById = new Map(
    computation.bz.vertices.map((vertex) => [vertex.id, vertex.cart])
  );

  return computation.bz.faces.map((face) => ({
    id: face.id,
    centroid: face.centroid,
    normal: face.normal,
    vertices: face.vertexIds.map((vertexId) => {
      const vertex = verticesById.get(vertexId);
      if (!vertex) {
        throw new Error(`Missing Brillouin zone vertex for face ${face.id}.`);
      }
      return vertex;
    })
  }));
}

export function buildBzEdgeSegments(computation: BzComputation): ViewerEdgeSegment[] {
  const verticesById = new Map(
    computation.bz.vertices.map((vertex) => [vertex.id, vertex.cart])
  );

  return computation.bz.edges.map((edge) => {
    const start = verticesById.get(edge.vertexIds[0]);
    const end = verticesById.get(edge.vertexIds[1]);
    if (!start || !end) {
      throw new Error(`Missing Brillouin zone vertex for edge ${edge.id}.`);
    }

    return {
      id: edge.id,
      start,
      end
    };
  });
}

export function buildSpecialPointRenderData(computation: BzComputation): ViewerSpecialPoint[] {
  return computation.points.map((point) => ({ ...point }));
}

export function getBzExtent(computation: BzComputation): number {
  return Math.max(
    ...computation.bz.vertices.map((vertex) => lengthVec3(vertex.cart)),
    1
  );
}
