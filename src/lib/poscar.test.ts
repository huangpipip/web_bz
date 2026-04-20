import { describe, expect, it } from "vitest";
import { parsePoscar } from "./poscar";

describe("parsePoscar", () => {
  it("parses a standard POSCAR with species labels", () => {
    const parsed = parsePoscar(`Silicon
1.0
5.43 0.0 0.0
0.0 5.43 0.0
0.0 0.0 5.43
Si
2
Direct
0.0 0.0 0.0
0.25 0.25 0.25`);

    expect(parsed.title).toBe("Silicon");
    expect(parsed.species).toEqual(["Si"]);
    expect(parsed.counts).toEqual([2]);
    expect(parsed.coordinateMode).toBe("direct");
    expect(parsed.positions).toHaveLength(2);
    expect(parsed.lattice[0][0]).toBeCloseTo(5.43);
  });

  it("supports negative scale interpreted as target volume", () => {
    const parsed = parsePoscar(`Target volume
-8
1 0 0
0 1 0
0 0 1
H
1
Cartesian
0 0 0`);

    expect(parsed.lattice[0][0]).toBeCloseTo(2);
    expect(parsed.lattice[1][1]).toBeCloseTo(2);
    expect(parsed.lattice[2][2]).toBeCloseTo(2);
  });
});
