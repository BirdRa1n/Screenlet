"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { Pencil } from "lucide-react";
import { DynamicAd } from "../remotion/DynamicAd";
import { useAdStore } from "../store/useAdStore";
import { totalDuration } from "../remotion/types";

export const PreviewPanel: React.FC = () => {
  const config = useAdStore((s) => s.config);
  const selectScene = useAdStore((s) => s.selectScene);
  const selectedSceneId = useAdStore((s) => s.selectedSceneId);
  const seekFrame = useAdStore((s) => s.seekFrame);
  const duration = useMemo(() => totalDuration(config.scenes), [config.scenes]);
  const playerRef = useRef<PlayerRef>(null);

  // Gate Player behind a mount flag so it never renders during the static-export
  // prerender (no browser APIs there).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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
        break;
      }
      elapsed += scene.durationInFrames;
    }
  }, [config.scenes, selectScene]);

  const selectedScene = config.scenes.find((s) => s.id === selectedSceneId);

  return (
    <main className="flex min-w-0 flex-1 items-center justify-center bg-muted/30 p-6">
      <div className="flex aspect-video w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border bg-black shadow-lg">
        {config.scenes.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Adicione uma cena para começar
          </div>
        ) : (
          <div className="relative flex-1">
            {mounted && (
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
                acknowledgeRemotionLicense
              />
            )}
            <button
              className="absolute left-3 top-3 flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white backdrop-blur transition-colors hover:bg-black/80"
              onClick={handleFrameClick}
            >
              <Pencil size={12} />
              {selectedScene
                ? `Editando: ${
                    selectedScene.type === "logo"
                      ? "Abertura/Encerramento"
                      : (selectedScene as { productName?: string }).productName || "Produto"
                  }`
                : "Clique para selecionar cena"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
};
