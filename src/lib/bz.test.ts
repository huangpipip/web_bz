import { describe, expect, it } from "vitest";
import { computeBrillouinZone } from "./bz";
import { SIMPLE_CUBIC_SAMPLE } from "./samples";

describe("Brillouin zone construction", () => {
  it("builds the simple cubic first BZ with XCrySDen-style special point counts", () => {
    const computation = computeBrillouinZone(SIMPLE_CUBIC_SAMPLE);

    expect(computation.bz.faces).toHaveLength(6);
    expect(computation.bz.vertices).toHaveLength(8);
    expect(computation.bz.edges).toHaveLength(12);
    expect(computation.points.filter((point) => point.type === "center")).toHaveLength(1);
    expect(computation.points.filter((point) => point.type === "edge")).toHaveLength(8);
    expect(computation.points.filter((point) => point.type === "line")).toHaveLength(12);
    expect(computation.points.filter((point) => point.type === "poly")).toHaveLength(6);
  });

  it("places simple cubic face centers at +/- pi along the reciprocal axes", () => {
    const computation = computeBrillouinZone(SIMPLE_CUBIC_SAMPLE);
    const faceCenters = computation.points
      .filter((point) => point.type === "poly")
      .map((point) => point.cart.map((value) => Number(value.toFixed(5))));

    expect(faceCenters).toEqual(
      expect.arrayContaining([
        [Math.PI, 0, 0].map((value) => Number(value.toFixed(5))),
        [-Math.PI, 0, 0].map((value) => Number(value.toFixed(5))),
        [0, Math.PI, 0].map((value) => Number(value.toFixed(5))),
        [0, -Math.PI, 0].map((value) => Number(value.toFixed(5))),
        [0, 0, Math.PI].map((value) => Number(value.toFixed(5))),
        [0, 0, -Math.PI].map((value) => Number(value.toFixed(5)))
      ])
    );
  });
});
