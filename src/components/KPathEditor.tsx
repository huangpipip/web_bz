import { useState, type ChangeEvent, type JSX } from "react";
import { canFormatVaspKpoints, formatKPathExport, type KPathExportFormat } from "../lib/kpath";
import type { BzSpecialPoint, KPathPointDraft, KPathResolvedPoint } from "../lib/types";

interface KPathEditorProps {
  selectedPoint: BzSpecialPoint | null;
  kPath: KPathPointDraft[];
  resolvedKPath: KPathResolvedPoint[];
  onAddSelected: () => void;
  onAddCustom: () => void;
  onRemoveLast: () => void;
  onClear: () => void;
  onUpdatePoint: (id: string, updater: Partial<KPathPointDraft>) => void;
  onMovePoint: (id: string, direction: "up" | "down") => void;
  onRemovePoint: (id: string) => void;
}

function pointTypeLabel(type: BzSpecialPoint["type"]): string {
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

function handleCoordinateChange(
  draft: KPathPointDraft,
  axis: 0 | 1 | 2,
  value: string,
  onUpdatePoint: (id: string, updater: Partial<KPathPointDraft>) => void
): void {
  const next = [...draft.fractionalText] as [string, string, string];
  next[axis] = value;
  onUpdatePoint(draft.id, { fractionalText: next });
}

export default function KPathEditor({
  selectedPoint,
  kPath,
  resolvedKPath,
  onAddSelected,
  onAddCustom,
  onRemoveLast,
  onClear,
  onUpdatePoint,
  onMovePoint,
  onRemovePoint
}: KPathEditorProps): JSX.Element {
  const [exportFormat, setExportFormat] = useState<KPathExportFormat>("vasp");
  const [vaspLinePointsText, setVaspLinePointsText] = useState("50");
  const vaspLinePoints = Number(vaspLinePointsText);
  const normalizedVaspLinePoints = Number.isFinite(vaspLinePoints) && vaspLinePoints > 0 ? vaspLinePoints : 50;
  const canExportVasp = exportFormat !== "vasp" || canFormatVaspKpoints(kPath);
  const exportText = canExportVasp ? formatKPathExport(kPath, exportFormat, normalizedVaspLinePoints) : "";
  const validPointCount = resolvedKPath.filter((point) => !point.error).length;

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h2>K-Path Editor</h2>
          <p>Use the viewer + and - controls, or select table points and refine the route.</p>
        </div>
        <div className="panel-chip">{kPath.length} points</div>
      </div>

      <div className="kpath-toolbar">
        <button className="primary-button" type="button" disabled={!selectedPoint} onClick={onAddSelected}>
          Add selected point
        </button>
        <button className="ghost-button" type="button" onClick={onAddCustom}>
          Add custom point
        </button>
        <button className="ghost-button" type="button" disabled={kPath.length === 0} onClick={onRemoveLast}>
          Remove last
        </button>
        <button className="ghost-button" type="button" disabled={kPath.length === 0} onClick={onClear}>
          Clear route
        </button>
      </div>

      <div className="kpath-status">
        {selectedPoint ? (
          <span>
            Selected source: {pointTypeLabel(selectedPoint.type)} ({selectedPoint.fractional.map((value) => value.toFixed(4)).join(", ")})
          </span>
        ) : (
          <span>Click a viewer point, then use the + control beside its coordinates.</span>
        )}
        <span>{validPointCount} valid / {kPath.length} total</span>
      </div>

      {kPath.length === 0 ? (
        <div className="panel-empty">
          <p>No K-path points yet. Select a viewer point and use +, add the selected point, or create a custom row.</p>
        </div>
      ) : (
        <div className="kpath-list">
          {kPath.map((draft, index) => {
            const resolved = resolvedKPath.find((point) => point.id === draft.id);
            const rowClassName = resolved?.error ? "kpath-row kpath-row-invalid" : "kpath-row";

            return (
              <div className={rowClassName} key={draft.id}>
                <div className="kpath-row-head">
                  <span className="kpath-index">#{index + 1}</span>
                  {draft.sourcePointId ? <span className="kpath-badge">from BZ point</span> : <span className="kpath-badge">custom</span>}
                </div>

                <label className="kpath-field">
                  <span>Label</span>
                  <input
                    type="text"
                    value={draft.label}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => onUpdatePoint(draft.id, { label: event.target.value })}
                  />
                </label>

                <div className="kpath-coordinates">
                  {draft.fractionalText.map((value, axis) => (
                    <label className="kpath-field" key={`${draft.id}-${axis}`}>
                      <span>{(["kx", "ky", "kz"] as const)[axis]}</span>
                      <input
                        type="text"
                        value={value}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          handleCoordinateChange(draft, axis as 0 | 1 | 2, event.target.value, onUpdatePoint)
                        }
                      />
                    </label>
                  ))}
                </div>

                {resolved?.error ? <div className="kpath-error">{resolved.error}</div> : null}

                <div className="kpath-row-actions">
                  <button className="ghost-button" type="button" disabled={index === 0} onClick={() => onMovePoint(draft.id, "up")}>
                    Up
                  </button>
                  <button
                    className="ghost-button"
                    type="button"
                    disabled={index === kPath.length - 1}
                    onClick={() => onMovePoint(draft.id, "down")}
                  >
                    Down
                  </button>
                  <button className="ghost-button" type="button" onClick={() => onRemovePoint(draft.id)}>
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="kpath-export">
        <div className="panel-header">
          <div>
            <h2>K-Path Export</h2>
            <p>
              {exportFormat === "vasp"
                ? "Complete VASP KPOINTS Line-mode file with paired segment endpoints."
                : "wannier90-style fractional coordinates followed by labels."}
            </p>
          </div>
        </div>
        <div className="export-controls">
          <div className="export-format-control" aria-label="K-path export format">
            <button
              className={exportFormat === "vasp" ? "format-option format-option-active" : "format-option"}
              type="button"
              onClick={() => setExportFormat("vasp")}
            >
              VASP
            </button>
            <button
              className={exportFormat === "wannier90" ? "format-option format-option-active" : "format-option"}
              type="button"
              onClick={() => setExportFormat("wannier90")}
            >
              wannier90
            </button>
          </div>
          {exportFormat === "vasp" ? (
            <label className="export-grid-field">
              <span>Grid per segment</span>
              <input
                min="1"
                step="1"
                type="number"
                value={vaspLinePointsText}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setVaspLinePointsText(event.target.value)}
              />
            </label>
          ) : null}
        </div>
        {exportFormat === "vasp" && !canExportVasp ? (
          <div className="kpath-error">VASP Line-mode requires complete endpoint pairs. Add one more K-path point.</div>
        ) : null}
        <textarea className="kpath-export-textarea" readOnly value={exportText} />
      </div>
    </div>
  );
}
