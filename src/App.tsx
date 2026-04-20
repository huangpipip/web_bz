import { useState, type JSX } from "react";
import BzCanvas from "./components/BzCanvas";
import KPathEditor from "./components/KPathEditor";
import SpecialPointTable from "./components/SpecialPointTable";
import { computeBrillouinZone } from "./lib/bz";
import { createCustomKPathPoint, createKPathPointFromSpecialPoint, resolveKPathPoints } from "./lib/kpath";
import type { BzComputation, KPathPointDraft } from "./lib/types";
import { SILICON_SINGLE_CRYSTAL_SAMPLE } from "./lib/samples";

const INITIAL_POSCAR = SILICON_SINGLE_CRYSTAL_SAMPLE;

function countByType(computation: BzComputation | null, type: "center" | "edge" | "line" | "poly"): number {
  if (!computation) {
    return 0;
  }
  return computation.points.filter((point) => point.type === type).length;
}

export default function App(): JSX.Element {
  const [poscarText, setPoscarText] = useState(INITIAL_POSCAR);
  const [computation, setComputation] = useState<BzComputation | null>(() => {
    try {
      return computeBrillouinZone(INITIAL_POSCAR);
    } catch {
      return null;
    }
  });
  const [selectedPointId, setSelectedPointId] = useState<string | null>(() => {
    try {
      return computeBrillouinZone(INITIAL_POSCAR).points[0]?.id ?? null;
    } catch {
      return null;
    }
  });
  const [showVectors, setShowVectors] = useState(true);
  const [kPath, setKPath] = useState<KPathPointDraft[]>([]);
  const [error, setError] = useState<string | null>(null);

  const selectedPoint = computation?.points.find((point) => point.id === selectedPointId) ?? null;
  const resolvedKPath = computation ? resolveKPathPoints(kPath, computation.reciprocal) : [];

  const handleRender = (): void => {
    try {
      const result = computeBrillouinZone(poscarText);
      setComputation(result);
      setSelectedPointId(result.points[0]?.id ?? null);
      setKPath([]);
      setError(null);
    } catch (renderError) {
      setComputation(null);
      setSelectedPointId(null);
      setKPath([]);
      setError(renderError instanceof Error ? renderError.message : "Unknown Brillouin zone error.");
    }
  };

  const handleAddSelectedPointToKPath = (): void => {
    if (!selectedPoint) {
      return;
    }

    setKPath((current) => {
      const lastPoint = current[current.length - 1];
      if (lastPoint?.sourcePointId === selectedPoint.id) {
        return current.slice(0, -1);
      }
      return [...current, createKPathPointFromSpecialPoint(selectedPoint, current.length)];
    });
  };

  const handleAddCustomKPoint = (): void => {
    setKPath((current) => [...current, createCustomKPathPoint(current.length)]);
  };

  const handleUpdateKPathPoint = (id: string, updater: Partial<KPathPointDraft>): void => {
    setKPath((current) =>
      current.map((point) => (point.id === id ? { ...point, ...updater } : point))
    );
  };

  const handleMoveKPathPoint = (id: string, direction: "up" | "down"): void => {
    setKPath((current) => {
      const index = current.findIndex((point) => point.id === id);
      if (index === -1) {
        return current;
      }

      const nextIndex = direction === "up" ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  const handleRemoveKPathPoint = (id: string): void => {
    setKPath((current) => current.filter((point) => point.id !== id));
  };

  return (
    <div className="app-shell">
      <div className="app-backdrop" />
      <main className="app-layout">
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">POSCAR to Brillouin Zone</span>
            <h1>Interactive first-BZ viewer with XCrySDen-style special points.</h1>
            <p>
              Paste a POSCAR, compute the reciprocal lattice in-browser, build the first Brillouin zone,
              then inspect the center, vertices, edge midpoints, and face centers extracted from the final
              polyhedron.
            </p>
          </div>
          <div className="hero-stats">
            <div className="stat-card">
              <span>Faces</span>
              <strong>{computation?.bz.faces.length ?? 0}</strong>
            </div>
            <div className="stat-card">
              <span>Vertices</span>
              <strong>{countByType(computation, "edge")}</strong>
            </div>
            <div className="stat-card">
              <span>Edge Midpoints</span>
              <strong>{countByType(computation, "line")}</strong>
            </div>
            <div className="stat-card">
              <span>Face Centers</span>
              <strong>{countByType(computation, "poly")}</strong>
            </div>
          </div>
        </section>

        <section className="grid-layout">
          <div className="panel input-panel">
            <div className="panel-header">
              <h2>POSCAR Input</h2>
              <p>Directly parse a VASP POSCAR without any server round-trip.</p>
            </div>

            <textarea
              aria-label="POSCAR input"
              className="poscar-textarea"
              value={poscarText}
              onChange={(event) => setPoscarText(event.target.value)}
              spellCheck={false}
            />

            <div className="controls-row">
              <button className="primary-button" type="button" onClick={handleRender}>
                Render Brillouin Zone
              </button>
              <button className="ghost-button" type="button" onClick={() => setPoscarText(SILICON_SINGLE_CRYSTAL_SAMPLE)}>
                Load Si sample
              </button>
              <label className="toggle-row">
                <input
                  checked={showVectors}
                  onChange={(event) => setShowVectors(event.target.checked)}
                  type="checkbox"
                />
                <span>Show reciprocal vectors</span>
              </label>
            </div>

            {error ? <div className="error-banner">{error}</div> : null}

            {computation ? (
              <div className="details-grid">
                <div>
                  <span className="detail-label">Structure</span>
                  <strong>{computation.parsed.title}</strong>
                </div>
                <div>
                  <span className="detail-label">Species</span>
                  <strong>{computation.parsed.species.join(", ")}</strong>
                </div>
                <div>
                  <span className="detail-label">Coordinate mode</span>
                  <strong>{computation.parsed.coordinateMode}</strong>
                </div>
                <div>
                  <span className="detail-label">Total points</span>
                  <strong>{computation.points.length}</strong>
                </div>
              </div>
            ) : null}
          </div>

          <BzCanvas
            computation={computation}
            kPath={resolvedKPath}
            selectedPointId={selectedPointId}
            onSelectPoint={setSelectedPointId}
            showReciprocalVectors={showVectors}
          />
        </section>

        <section className="grid-layout lower-grid">
          <div className="stack-layout">
            <SpecialPointTable
              computation={computation}
              selectedPointId={selectedPointId}
              onSelectPoint={setSelectedPointId}
            />
            <KPathEditor
              selectedPoint={selectedPoint}
              kPath={kPath}
              resolvedKPath={resolvedKPath}
              onAddSelected={handleAddSelectedPointToKPath}
              onAddCustom={handleAddCustomKPoint}
              onRemoveLast={() => setKPath((current) => current.slice(0, -1))}
              onClear={() => setKPath([])}
              onUpdatePoint={handleUpdateKPathPoint}
              onMovePoint={handleMoveKPathPoint}
              onRemovePoint={handleRemoveKPathPoint}
            />
          </div>

          <div className="panel notes-panel">
            <div className="panel-header">
              <h2>Implementation Notes</h2>
              <p>Behavior is aligned to the XCrySDen flow where practical in a browser-only app.</p>
            </div>
            <ul className="notes-list">
              <li>The BZ is built as the Wigner-Seitz cell of the reciprocal lattice around Gamma.</li>
              <li>Special points follow the XCrySDen extraction categories from the final polyhedron.</li>
              <li>K-path editing follows the XCrySDen idea of selecting ordered BZ points and editing the resulting coordinates.</li>
              <li>No label lookup table is used in this version; labels stay fully user-editable.</li>
              <li>Only 3D periodic POSCAR inputs are supported in the current implementation.</li>
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}
