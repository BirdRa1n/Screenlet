export type MediaAssetType = "image" | "video";

export type MediaAsset = {
  id: string;
  filename: string;      // "uploads/timestamp-name.ext" — same format as copyIntoUploads()
  originalName: string;
  type: MediaAssetType;
  size: number;          // bytes
  sha256?: string;       // SHA-256 hex digest for dedup detection
  importedAt: string;    // ISO timestamp
};
