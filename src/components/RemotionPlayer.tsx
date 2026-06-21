"use client";

import { Player, type PlayerPropsWithoutZod } from "@remotion/player";
import { useEffect, useState } from "react";

/**
 * Renders the Remotion <Player> only on the client. Next's static export
 * prerenders client components to HTML at build time, where the Player's
 * browser APIs aren't available — so we gate rendering behind a mount flag.
 *
 * Generic over the composition's input props so `component` + `inputProps`
 * stay fully type-checked at call sites. For Players that need a ref, use the
 * Remotion <Player> directly behind a mount flag (see PreviewPanel).
 */
export function RemotionPlayer<Props extends Record<string, unknown>>(
  props: PlayerPropsWithoutZod<Props>,
) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return <Player {...props} />;
}
