import { useState, type ChangeEvent, type JSX } from "react";
import {
  canFormatVaspHybridKpoints,
  canFormatVaspKpoints,
  formatKPathExport,
  type KPathExportFormat
} from "../lib/kpath";
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

function exportDescription(format: KPathExportFormat): string {
  switch (format) {
    case "vasp":
      return "Complete VASP KPOINTS Line-mode file with continuous adjacent path segments.";
    case "vasp-hybrid":
      return "Explicit VASP KPOINTS list for hybrid-functional band paths, with zero weights.";
    case "wannier90":
      return "wannier90-style fractional coordinates followed by labels.";
  }
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
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const vaspLinePoints = Number(vaspLinePointsText);
  const normalizedVaspLinePoints = Number.isFinite(vaspLinePoints) && vaspLinePoints > 0 ? vaspLinePoints : 50;
  const canExportVasp = exportFormat !== "vasp" || canFormatVaspKpoints(kPath);
  const canExportVaspHybrid = exportFormat !== "vasp-hybrid" || canFormatVaspHybridKpoints(kPath);
  const canExport = canExportVasp && canExportVaspHybrid;
  const exportText = canExport ? formatKPathExport(kPath, exportFormat, normalizedVaspLinePoints) : "";
  const validPointCount = resolvedKPath.filter((point) => !point.error).length;

  async function handleCopyExport(): Promise<void> {
    if (!exportText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(exportText);
      setCopyStatus("copied");
      window.setTimeout(() => setCopyStatus("idle"), 1600);
    } catch {
      setCopyStatus("failed");
      window.setTimeout(() => setCopyStatus("idle"), 2200);
    }
  }

  return (
    <div className="panel">
      <div className="panel-header kpath-editor-header">
        <div>
          <h2>K-Path Editor</h2>
        </div>
        <div className="panel-chip">{kPath.length} points</div>
      </div>

      <div className="kpath-toolbar">
        <button className="primary-button" type="button" disabled={!selectedPoint} onClick={onAddSelected}>
          Add selected
        </button>
        <button className="ghost-button" type="button" onClick={onAddCustom}>
          Add custom
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
            Selected: {pointTypeLabel(selectedPoint.type)} ({selectedPoint.fractional.map((value) => value.toFixed(3)).join(", ")})
          </span>
        ) : (
          <span>Select a viewer/table point to add it.</span>
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
                  <div className="kpath-row-title">
                    <span className="kpath-index">#{index + 1}</span>
                    {draft.sourcePointId ? <span className="kpath-badge">BZ</span> : <span className="kpath-badge">custom</span>}
                  </div>
                  <div className="kpath-row-actions">
                    <button
                      aria-label={`Move K-point ${index + 1} up`}
                      className="icon-button"
                      title="Move up"
                      type="button"
                      disabled={index === 0}
                      onClick={() => onMovePoint(draft.id, "up")}
                    >
                      ↑
                    </button>
                    <button
                      aria-label={`Move K-point ${index + 1} down`}
                      className="icon-button"
                      title="Move down"
                      type="button"
                      disabled={index === kPath.length - 1}
                      onClick={() => onMovePoint(draft.id, "down")}
                    >
                      ↓
                    </button>
                    <button
                      aria-label={`Delete K-point ${index + 1}`}
                      className="icon-button icon-button-danger"
                      title="Delete"
                      type="button"
                      onClick={() => onRemovePoint(draft.id)}
                    >
                      ×
                    </button>
                  </div>
                </div>

                <div className="kpath-row-fields">
                  <label className="kpath-field kpath-label-field">
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
                </div>

                {resolved?.error ? <div className="kpath-error">{resolved.error}</div> : null}
              </div>
            );
          })}
        </div>
      )}

      <div className="kpath-export">
        <div className="panel-header">
          <div>
            <h2>K-Path Export</h2>
            <p>{exportDescription(exportFormat)}</p>
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
              className={exportFormat === "vasp-hybrid" ? "format-option format-option-active" : "format-option"}
              type="button"
              onClick={() => setExportFormat("vasp-hybrid")}
            >
              VASP hybrid
            </button>
            <button
              className={exportFormat === "wannier90" ? "format-option format-option-active" : "format-option"}
              type="button"
              onClick={() => setExportFormat("wannier90")}
            >
              wannier90
            </button>
          </div>
          {exportFormat === "vasp" || exportFormat === "vasp-hybrid" ? (
            <label className="export-grid-field">
              <span>{exportFormat === "vasp-hybrid" ? "Points per segment" : "Grid per segment"}</span>
              <input
                min={exportFormat === "vasp-hybrid" ? "2" : "1"}
                step="1"
                type="number"
                value={vaspLinePointsText}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setVaspLinePointsText(event.target.value)}
              />
            </label>
          ) : null}
          <button className="ghost-button export-copy-button" type="button" disabled={!exportText} onClick={handleCopyExport}>
            {copyStatus === "copied" ? "Copied" : copyStatus === "failed" ? "Copy failed" : "Copy"}
          </button>
        </div>
        {exportFormat === "vasp" && !canExportVasp ? (
          <div className="kpath-error">VASP Line-mode requires at least two K-path points.</div>
        ) : null}
        {exportFormat === "vasp-hybrid" && !canExportVaspHybrid ? (
          <div className="kpath-error">VASP hybrid export requires at least two valid K-path points.</div>
        ) : null}
        <textarea className="kpath-export-textarea" readOnly value={exportText} />
      </div>
    </div>
  );
}
