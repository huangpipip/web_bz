import { describe, expect, it } from "vitest";
import { computeBrillouinZone } from "./bz";
import { SIMPLE_CUBIC_SAMPLE } from "./samples";
import {
  buildBzEdgeSegments,
  buildBzFacePolygons,
  buildSpecialPointRenderData,
  getBzExtent
} from "./viewerGeometry";

describe("viewer geometry helpers", () => {
  it("builds one face polygon per Brillouin-zone face", () => {
    const computation = computeBrillouinZone(SIMPLE_CUBIC_SAMPLE);
    const polygons = buildBzFacePolygons(computation);

    expect(polygons).toHaveLength(computation.bz.faces.length);
    expect(polygons.every((polygon) => polygon.vertices.length >= 4)).toBe(true);
  });

  it("builds edge segments from Brillouin-zone vertices", () => {
    const computation = computeBrillouinZone(SIMPLE_CUBIC_SAMPLE);
    const segments = buildBzEdgeSegments(computation);

    expect(segments).toHaveLength(computation.bz.edges.length);
    expect(segments[0]?.start).toHaveLength(3);
    expect(segments[0]?.end).toHaveLength(3);
  });

  it("preserves special point counts and extent for the viewer", () => {
    const computation = computeBrillouinZone(SIMPLE_CUBIC_SAMPLE);
    const points = buildSpecialPointRenderData(computation);

    expect(points).toHaveLength(computation.points.length);
    expect(getBzExtent(computation)).toBeCloseTo(Math.sqrt(3) * Math.PI, 5);
  });
});
