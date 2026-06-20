import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { Pencil } from "lucide-react";
import { DynamicAd } from "../remotion/DynamicAd";
import { useAdStore } from "../store/useAdStore";
import { totalDuration } from "../remotion/types";
import "../styles/layout/PreviewPanel.css";

export const PreviewPanel: React.FC = () => {
  const config = useAdStore((s) => s.config);
  const selectScene = useAdStore((s) => s.selectScene);
  const selectedSceneId = useAdStore((s) => s.selectedSceneId);
  const seekFrame = useAdStore((s) => s.seekFrame);
  const duration = useMemo(
    () => totalDuration(config.scenes),
    [config.scenes]
  );
  const playerRef = useRef<PlayerRef>(null);

  useEffect(() => {
    if (seekFrame !== null && playerRef.current) {
      playerRef.current.seekTo(seekFrame);
    }
  }, [seekFrame]);

  const handleFrameClick = useCallback(() => {
    if (!playerRef.current || config.scenes.length === 0) return;
    const frame = playerRef.current.getCurrentFrame();
    let elapsed = 0;
    for (const scene of config.scenes) {
      if (frame < elapsed + scene.durationInFrames) {
        selectScene(scene.id);
        // Scroll inspector into view
        setTimeout(() => {
          document.querySelector(".vt-inspector")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 50);
        break;
      }
      elapsed += scene.durationInFrames;
    }
  }, [config.scenes, selectScene]);

  const selectedScene = config.scenes.find((s) => s.id === selectedSceneId);

  return (
    <main className="vt-preview">
      <div className="vt-preview__frame">
        {config.scenes.length === 0 ? (
          <div className="vt-preview__empty">
            Adicione uma cena para começar
          </div>
        ) : (
          <>
            <Player
              ref={playerRef}
              component={DynamicAd}
              inputProps={config}
              durationInFrames={Math.max(duration, 1)}
              fps={config.fps}
              compositionWidth={config.width}
              compositionHeight={config.height}
              style={{ width: "100%", height: "100%" }}
              controls
              loop
              autoPlay
            />
            <div className="vt-preview__edit-hint" onClick={handleFrameClick}>
              <Pencil size={12} />
              {selectedScene
                ? `Editando: ${selectedScene.type === "logo" ? "Abertura/Encerramento" : (selectedScene as { productName?: string }).productName || "Produto"}`
                : "Clique para selecionar cena"}
            </div>
          </>
        )}
      </div>
    </main>
  );
};
