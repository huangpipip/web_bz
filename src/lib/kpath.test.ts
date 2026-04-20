import { describe, expect, it } from "vitest";
import { buildReciprocalLattice } from "./bz";
import { formatKPathExport, resolveKPathPoints } from "./kpath";
import { parsePoscar } from "./poscar";
import type { KPathPointDraft } from "./types";
import { SIMPLE_CUBIC_SAMPLE } from "./samples";

describe("kpath utilities", () => {
  const reciprocal = buildReciprocalLattice(parsePoscar(SIMPLE_CUBIC_SAMPLE));

  it("resolves valid fractional K points into cartesian coordinates", () => {
    const drafts: KPathPointDraft[] = [
      {
        id: "a",
        label: "GAMMA",
        fractionalText: ["0.00000", "0.00000", "0.00000"]
      },
      {
        id: "b",
        label: "X",
        fractionalText: ["0.50000", "0.00000", "0.00000"]
      }
    ];

    const resolved = resolveKPathPoints(drafts, reciprocal);

    expect(resolved[0].error).toBeNull();
    expect(resolved[0].cart).toEqual([0, 0, 0]);
    expect(resolved[1].error).toBeNull();
    expect(resolved[1].cart?.[0]).toBeCloseTo(Math.PI);
  });

  it("flags invalid fractional K points", () => {
    const drafts: KPathPointDraft[] = [
      {
        id: "bad",
        label: "bad",
        fractionalText: ["0.5", "", "0.0"]
      }
    ];

    const resolved = resolveKPathPoints(drafts, reciprocal);

    expect(resolved[0].error).toMatch(/three valid numbers/i);
    expect(resolved[0].cart).toBeNull();
  });

  it("formats K-path export lines", () => {
    const text = formatKPathExport([
      {
        id: "1",
        label: "GAMMA",
        fractionalText: ["0.00000", "0.00000", "0.00000"]
      },
      {
        id: "2",
        label: "X",
        fractionalText: ["0.50000", "0.00000", "0.00000"]
      }
    ]);

    expect(text).toContain("0.00000 0.00000 0.00000 GAMMA");
    expect(text).toContain("0.50000 0.00000 0.00000 X");
  });
});
