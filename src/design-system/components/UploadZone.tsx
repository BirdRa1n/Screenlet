"use client";

import * as React from "react";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";
import { assetUrl } from "@/lib/assetUrl";

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
  const [dragging, setDragging] = React.useState(false);

  // Click → Electron native dialog (no hidden <input> intercepting).
  const handleClick = async () => {
    const path = await window.adFrame.selectImage();
    if (path) onUpload(path);
  };

  // Drop → get native path from Electron File object.
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const nativePath = (file as File & { path?: string }).path;
    if (nativePath) {
      const uploaded = await window.adFrame.copyFile(nativePath);
      onUpload(uploaded);
    }
  };

  return (
    <div
      className={cn(
        "relative flex cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-muted/30 transition-colors hover:border-primary/60 hover:bg-muted/50",
        dragging && "border-primary bg-primary/5",
      )}
      style={{ height }}
      onClick={handleClick}
      onDragEnter={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setDragging(false);
      }}
      onDrop={handleDrop}
    >
      {value ? (
        <img
          src={assetUrl(value)}
          alt=""
          className={cn(
            "size-full",
            previewFit === "cover" ? "object-cover" : "object-contain",
          )}
        />
      ) : (
        <div className="flex flex-col items-center gap-1 text-center">
          <UploadCloud className="size-5 text-muted-foreground" />
          <span className="text-sm text-foreground">{label}</span>
          <span className="text-xs text-muted-foreground">{hint}</span>
        </div>
      )}

      {dragging ? (
        <div className="absolute inset-0 flex items-center justify-center bg-primary/10 backdrop-blur-sm">
          <span className="text-sm font-medium text-primary">
            Soltar arquivo
          </span>
        </div>
      ) : null}
    </div>
  );
};
