import type { LibraryProduct } from "../store/useLibraryStore";
import type { LibraryProductSnapshot, ProductSceneConfig } from "../remotion/types";

// The library data fields that flow into a product scene on import. Scene field
// names match the snapshot keys, so a snapshot doubles as a scene patch.
export function librarySnapshotOf(p: LibraryProduct): LibraryProductSnapshot {
  return {
    image: p.image,
    productName: p.name,
    priceMode: p.priceMode,
    oldPrice: p.oldPrice,
    newPrice: p.newPrice,
    priceSuffix: p.priceSuffix,
    badgeText: p.badgeText,
  };
}

// Human-readable labels for the drift summary shown to the user.
export const SNAPSHOT_FIELD_LABELS: Record<keyof LibraryProductSnapshot, string> = {
  image: "imagem",
  productName: "nome",
  priceMode: "modo de preço",
  oldPrice: "preço anterior",
  newPrice: "preço",
  priceSuffix: "sufixo",
  badgeText: "selo",
};

// Detects whether an imported scene is outdated relative to the current library
// product, returning the fields to update and friendly labels of what changed.
// Returns null when the scene is already up to date.
//
// When a snapshot exists, a field is "drifted" only if the LIBRARY changed it
// since import (current ≠ snapshot) — this preserves the user's own scene edits
// to fields the library didn't touch. Legacy imports without a snapshot fall
// back to comparing the scene value directly.
export function libraryDriftPatch(
  scene: ProductSceneConfig,
  product: LibraryProduct,
): { patch: Partial<ProductSceneConfig>; changed: string[] } | null {
  const current = librarySnapshotOf(product);
  const snap = scene.librarySnapshot;
  const keys = Object.keys(current) as (keyof LibraryProductSnapshot)[];

  const changedKeys = keys.filter((key) => {
    const baseline = snap ? snap[key] : (scene[key] as LibraryProductSnapshot[typeof key]);
    return current[key] !== baseline;
  });
  if (changedKeys.length === 0) return null;

  const patch: Partial<ProductSceneConfig> = {};
  for (const key of changedKeys) {
    (patch as Record<string, unknown>)[key] = current[key];
  }
  return { patch, changed: changedKeys.map((k) => SNAPSHOT_FIELD_LABELS[k]) };
}
