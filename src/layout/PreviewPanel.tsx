import React, { useMemo } from "react";
import { Player } from "@remotion/player";
import { DynamicAd } from "../remotion/DynamicAd";
import { useAdStore } from "../store/useAdStore";
import { totalDuration } from "../remotion/types";
import "./PreviewPanel.css";

export const PreviewPanel: React.FC = () => {
  const config = useAdStore((s) => s.config);
  const duration = useMemo(
    () => totalDuration(config.scenes),
    [config.scenes]
  );

  return (
    <main className="vt-preview">
      <div className="vt-preview__frame">
        {config.scenes.length === 0 ? (
          <div className="vt-preview__empty">
            Adicione uma cena para começar
          </div>
        ) : (
          <Player
            component={DynamicAd}
            inputProps={config}
            durationInFrames={Math.max(duration, 1)}
            fps={config.fps}
            compositionWidth={config.width}
            compositionHeight={config.height}
            style={{ width: "100%", height: "100%" }}
            controls
            loop
          />
        )}
      </div>
    </main>
  );
};
