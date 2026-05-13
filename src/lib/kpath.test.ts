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

  it("formats wannier90 K-path export lines by default", () => {
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

  it("formats VASP KPOINTS line-mode files from continuous adjacent path segments", () => {
    const text = formatKPathExport(
      [
        {
          id: "1",
          label: "L",
          fractionalText: ["0.00000", "0.50000", "0.00000"]
        },
        {
          id: "2",
          label: "Γ",
          fractionalText: ["0.00000", "0.00000", "0.00000"]
        },
        {
          id: "3",
          label: "F",
          fractionalText: ["0.50000", "0.00000", "0.00000"]
        }
      ],
      "vasp",
      50
    );

    expect(text).toContain("KPOINTS\n50 !50 grid\nLine-mode\nreciprocal");
    expect(text).toContain("0.00000 0.50000 0.00000 ! L");
    expect(text).toContain("0.00000 0.00000 0.00000 ! Γ");
    expect(text).toContain("\n\n0.00000 0.00000 0.00000 ! Γ");
    expect(text).toContain("0.50000 0.00000 0.00000 ! F");
  });

  it("does not format incomplete VASP line-mode segments", () => {
    const text = formatKPathExport(
      [
        {
          id: "1",
          label: "Γ",
          fractionalText: ["0.00000", "0.00000", "0.00000"]
        }
      ],
      "vasp"
    );

    expect(text).toBe("");
  });

  it("formats VASP hybrid KPOINTS as explicit zero-weight points", () => {
    const text = formatKPathExport(
      [
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
      ],
      "vasp-hybrid",
      4
    );
    const lines = text.split("\n");

    expect(lines.slice(0, 3)).toEqual(["KPOINTS", "4", "Reciprocal"]);
    expect(lines[3]).toBe("0.00000000 0.00000000 0.00000000 0 ! GAMMA");
    expect(lines[4]).toBe("0.16666667 0.00000000 0.00000000 0 ! GAMMA-X");
    expect(lines[6]).toBe("0.50000000 0.00000000 0.00000000 0 ! X");
    expect(lines.slice(3)).toHaveLength(4);
    expect(lines.slice(3).every((line) => line.includes(" 0 ! "))).toBe(true);
  });

  it("formats VASP hybrid KPOINTS without duplicate segment junctions", () => {
    const text = formatKPathExport(
      [
        {
          id: "1",
          label: "L",
          fractionalText: ["0.00000", "0.50000", "0.00000"]
        },
        {
          id: "2",
          label: "GAMMA",
          fractionalText: ["0.00000", "0.00000", "0.00000"]
        },
        {
          id: "3",
          label: "F",
          fractionalText: ["0.50000", "0.00000", "0.00000"]
        }
      ],
      "vasp-hybrid",
      4
    );
    const lines = text.split("\n");
    const dataLines = lines.slice(3);

    expect(lines[1]).toBe("7");
    expect(dataLines).toHaveLength(7);
    expect(dataLines.filter((line) => line === "0.00000000 0.00000000 0.00000000 0 ! GAMMA")).toHaveLength(1);
    expect(dataLines.every((line) => line.includes(" 0 ! "))).toBe(true);
  });

  it("does not format VASP hybrid KPOINTS from invalid coordinates", () => {
    const text = formatKPathExport(
      [
        {
          id: "1",
          label: "GAMMA",
          fractionalText: ["0.00000", "0.00000", "0.00000"]
        },
        {
          id: "2",
          label: "X",
          fractionalText: ["", "0.00000", "0.00000"]
        }
      ],
      "vasp-hybrid",
      4
    );

    expect(text).toBe("");
  });
});
