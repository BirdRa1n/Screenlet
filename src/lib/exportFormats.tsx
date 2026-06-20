import React from "react";
import { Camera, Music2, RectangleVertical, Tv2 } from "lucide-react";

export type ExportFormatId = "tv" | "instagram" | "stories" | "tiktok";

// Distinct shapes per format so they're tellable apart at a glance, even at
// the 12-20px sizes used in cards — Stories and TikTok used to share the
// exact same Smartphone icon, and Instagram a generic empty square.
export function formatIcon(id: ExportFormatId, size: number): React.ReactNode {
  switch (id) {
    case "tv": return <Tv2 size={size} />;
    case "instagram": return <Camera size={size} />;
    case "stories": return <RectangleVertical size={size} />;
    case "tiktok": return <Music2 size={size} />;
  }
}
