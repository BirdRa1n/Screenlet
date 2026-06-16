import React, { useState } from "react";
import { UploadCloud } from "lucide-react";
import "../../styles/components/UploadZone.css";

type Props = {
  value?: string | null;
  onUpload: (uploadedPath: string) => void;
  label?: string;
  hint?: string;
  height?: number | string;
  previewFit?: "contain" | "cover";
};

export const UploadZone: React.FC<Props> = ({
  value,
  onUpload,
  label = "Clique ou arraste um arquivo",
  hint = "PNG, JPG, WEBP",
  height = 120,
  previewFit = "contain",
}) => {
  const [dragging, setDragging] = useState(false);

  // Click → Electron native dialog (no hidden <input> intercepting)
  const handleClick = async () => {
    const path = await window.vitrineTV.selectImage();
    if (path) onUpload(path);
  };

  // Drop → get native path from Electron File object
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const nativePath = (file as File & { path?: string }).path;
    if (nativePath) {
      const uploaded = await window.vitrineTV.copyFile(nativePath);
      onUpload(uploaded);
    }
  };

  const classes = [
    "ds-upload",
    dragging ? "ds-upload--dragging" : "",
    value ? "ds-upload--has-file" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Preview src: works in both dev (Vite serves public/) and Electron prod (relative path)
  const previewSrc = value ? value : null;

  return (
    <div
      className={classes}
      style={{ height }}
      onClick={handleClick}
      onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
      onDrop={handleDrop}
    >
      {previewSrc ? (
        <img
          src={previewSrc}
          alt=""
          className="ds-upload__preview"
          style={{ objectFit: previewFit }}
          onError={(e) => {
            // Fallback: try with leading slash (Vite dev)
            const img = e.currentTarget;
            if (!img.src.startsWith("/")) {
              img.src = "/" + previewSrc;
            }
          }}
        />
      ) : (
        <div className="ds-upload__empty">
          <span className="ds-upload__icon">
            <UploadCloud size={22} />
          </span>
          <span className="ds-upload__label">{label}</span>
          <span className="ds-upload__hint">{hint}</span>
        </div>
      )}

      {dragging && (
        <div className="ds-upload__overlay">
          <span className="ds-upload__overlay-text">Soltar arquivo</span>
        </div>
      )}
    </div>
  );
};
