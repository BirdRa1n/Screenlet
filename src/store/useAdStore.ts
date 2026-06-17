import { create } from "zustand";
import { buildPreset } from "../remotion/presets";
import {
  defaultLogoScene,
  defaultProductScene,
  type AdConfig,
  type SceneConfig,
} from "../remotion/types";

type AdStore = {
  config: AdConfig;
  selectedSceneId: string | null;
  seekFrame: number | null;

  selectScene: (id: string) => void;
  seekToScene: (id: string) => void;
  setLogoImage: (path: string) => void;
  updateScene: (id: string, scene: SceneConfig) => void;
  removeScene: (id: string) => void;
  moveScene: (id: string, direction: -1 | 1) => void;
  reorderScenes: (orderedIds: string[]) => void;
  addProductScene: () => void;
  addLogoScene: () => void;
  loadConfig: (config: AdConfig) => void;
};

const initialConfig = buildPreset("generico");

export const useAdStore = create<AdStore>((set) => ({
  config: initialConfig,
  selectedSceneId: initialConfig.scenes[0]?.id ?? null,
  seekFrame: null,

  selectScene: (id) => set({ selectedSceneId: id }),

  seekToScene: (id) =>
    set((state) => {
      let frame = 0;
      for (const scene of state.config.scenes) {
        if (scene.id === id) break;
        frame += scene.durationInFrames;
      }
      const scene = state.config.scenes.find((s) => s.id === id);
      const offset = Math.min(30, Math.floor((scene?.durationInFrames ?? 0) * 0.35));
      return { selectedSceneId: id, seekFrame: frame + offset };
    }),

  setLogoImage: (path) =>
    set((state) => ({ config: { ...state.config, logoImage: path } })),

  updateScene: (id, scene) =>
    set((state) => ({
      config: {
        ...state.config,
        scenes: state.config.scenes.map((s) => (s.id === id ? scene : s)),
      },
    })),

  removeScene: (id) =>
    set((state) => {
      const scenes = state.config.scenes.filter((s) => s.id !== id);
      const wasSelected = state.selectedSceneId === id;
      return {
        config: { ...state.config, scenes },
        selectedSceneId: wasSelected
          ? scenes[0]?.id ?? null
          : state.selectedSceneId,
      };
    }),

  moveScene: (id, direction) =>
    set((state) => {
      const scenes = [...state.config.scenes];
      const idx = scenes.findIndex((s) => s.id === id);
      const newIdx = idx + direction;
      if (idx === -1 || newIdx < 0 || newIdx >= scenes.length) return state;
      [scenes[idx], scenes[newIdx]] = [scenes[newIdx], scenes[idx]];
      return { config: { ...state.config, scenes } };
    }),

  reorderScenes: (orderedIds) =>
    set((state) => {
      const map = new Map(state.config.scenes.map((s) => [s.id, s]));
      const scenes = orderedIds.map((id) => map.get(id)!).filter(Boolean);
      return { config: { ...state.config, scenes } };
    }),

  addProductScene: () => {
    const scene = defaultProductScene();
    set((state) => ({
      config: { ...state.config, scenes: [...state.config.scenes, scene] },
      selectedSceneId: scene.id,
    }));
  },

  addLogoScene: () => {
    const scene = defaultLogoScene();
    set((state) => ({
      config: { ...state.config, scenes: [...state.config.scenes, scene] },
      selectedSceneId: scene.id,
    }));
  },

  loadConfig: (config) =>
    set({
      config,
      selectedSceneId: config.scenes[0]?.id ?? null,
      seekFrame: null,
    }),
}));

export function useSelectedScene(): SceneConfig | null {
  const scenes = useAdStore((s) => s.config.scenes);
  const selectedSceneId = useAdStore((s) => s.selectedSceneId);
  return scenes.find((s) => s.id === selectedSceneId) ?? null;
}
