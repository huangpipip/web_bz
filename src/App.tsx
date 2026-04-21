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

function pointTypeLabel(type: "center" | "edge" | "line" | "poly"): string {
  switch (type) {
    case "center":
      return "Center";
    case "edge":
      return "Vertex";
    case "line":
      return "Edge midpoint";
    case "poly":
      return "Face center";
  }
}

function formatVector(values: [number, number, number], digits = 4): string {
  return values.map((value) => value.toFixed(digits)).join(", ");
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
  const [viewResetToken, setViewResetToken] = useState(0);

  const selectedPoint = computation?.points.find((point) => point.id === selectedPointId) ?? null;
  const resolvedKPath = computation ? resolveKPathPoints(kPath, computation.reciprocal) : [];
  const validKPathCount = resolvedKPath.filter((point) => !point.error).length;

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

    setKPath((current) => [...current, createKPathPointFromSpecialPoint(selectedPoint, current.length)]);
  };

  const handleAddPointToKPath = (pointId: string): void => {
    const point = computation?.points.find((candidate) => candidate.id === pointId);
    if (!point) {
      return;
    }

    setKPath((current) => [...current, createKPathPointFromSpecialPoint(point, current.length)]);
  };

  const handleRemovePointFromKPath = (pointId: string): void => {
    setKPath((current) => {
      let index = -1;
      for (let currentIndex = current.length - 1; currentIndex >= 0; currentIndex -= 1) {
        if (current[currentIndex].sourcePointId === pointId) {
          index = currentIndex;
          break;
        }
      }
      if (index === -1) {
        return current;
      }
      return current.filter((_, currentIndex) => currentIndex !== index);
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
      <aside className="control-panel">
        <section className="panel toolbar-header">
          <span className="eyebrow">POSCAR to Brillouin Zone</span>
          <h1>Brillouin Zone Workbench</h1>
          <p>
            Parse a POSCAR locally, compute the first Brillouin zone in-browser, inspect XCrySDen-style
            special points, and assemble an editable reciprocal-space K path.
          </p>
        </section>

        <section className="panel input-panel">
          <div className="panel-header">
            <div>
              <h2>POSCAR Input</h2>
              <p>All controls stay on the left so the viewer can use the full right-side workspace.</p>
            </div>
            <div className="panel-chip">{computation ? computation.parsed.title : "Not rendered"}</div>
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
            <button className="ghost-button" type="button" onClick={() => setViewResetToken((current) => current + 1)}>
              Reset view
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
          ) : (
            <div className="panel-empty compact-empty">
              <p>Render the POSCAR to unlock the special-point table, K-path editor, and right-side viewer.</p>
            </div>
          )}
        </section>

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

        <section className="panel summary-panel">
          <div className="panel-header">
            <div>
              <h2>Workspace Summary</h2>
              <p>Current model status, selection, and K-path progress.</p>
            </div>
          </div>

          <div className="summary-grid">
            <div className="summary-card">
              <span>Faces</span>
              <strong>{computation?.bz.faces.length ?? 0}</strong>
            </div>
            <div className="summary-card">
              <span>Vertices</span>
              <strong>{countByType(computation, "edge")}</strong>
            </div>
            <div className="summary-card">
              <span>Edge Midpoints</span>
              <strong>{countByType(computation, "line")}</strong>
            </div>
            <div className="summary-card">
              <span>Face Centers</span>
              <strong>{countByType(computation, "poly")}</strong>
            </div>
          </div>

          <div className="detail-stack">
            <div className="detail-card">
              <span className="detail-label">Selected point</span>
              <strong>{selectedPoint ? pointTypeLabel(selectedPoint.type) : "None"}</strong>
              <p>{selectedPoint ? formatVector(selectedPoint.fractional) : "Click any point in the table or viewer."}</p>
            </div>
            <div className="detail-card">
              <span className="detail-label">K-path</span>
              <strong>
                {validKPathCount} valid / {kPath.length} total
              </strong>
              <p>{kPath.length > 0 ? "Ordered reciprocal-space route is ready for editing and export." : "No K-path points added yet."}</p>
            </div>
          </div>
        </section>

        <SpecialPointTable
          computation={computation}
          selectedPointId={selectedPointId}
          onSelectPoint={setSelectedPointId}
        />

        <section className="panel notes-panel">
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
        </section>
      </aside>

      <main className="workspace-panel">
        <div className="workspace-header">
          <div className="workspace-copy">
            <span className="workspace-label">Visualization</span>
            <h2>First Brillouin Zone Viewer</h2>
            <p>Drag to rotate, scroll to zoom, and click points to synchronize the left-side tool panels.</p>
          </div>

          <div className="workspace-meta">
            <div className="workspace-chip">
              <span>Structure</span>
              <strong>{computation?.parsed.title ?? "Waiting for render"}</strong>
            </div>
            <div className="workspace-chip">
              <span>Selected</span>
              <strong>{selectedPoint ? pointTypeLabel(selectedPoint.type) : "None"}</strong>
            </div>
            <div className="workspace-chip">
              <span>Points</span>
              <strong>{computation?.points.length ?? 0}</strong>
            </div>
            <div className="workspace-chip">
              <span>K-path</span>
              <strong>{kPath.length}</strong>
            </div>
          </div>
        </div>

        <div className="workspace-stage">
          <BzCanvas
            computation={computation}
            kPath={resolvedKPath}
            selectedPointId={selectedPointId}
            onAddPointToKPath={handleAddPointToKPath}
            onRemovePointFromKPath={handleRemovePointFromKPath}
            onSelectPoint={setSelectedPointId}
            showReciprocalVectors={showVectors}
            viewResetToken={viewResetToken}
          />
        </div>
      </main>
    </div>
  );
}
