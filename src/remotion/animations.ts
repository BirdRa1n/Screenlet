import { interpolate, Easing } from "remotion";
import type { LayerAnimation, AnimationEasing } from "./template-types";

type Interpolatable = number;

function getEasing(easing?: AnimationEasing): (t: number) => number {
  switch (easing) {
    case "easeIn":    return Easing.in(Easing.ease);
    case "easeOut":   return Easing.out(Easing.ease);
    case "easeInOut": return Easing.inOut(Easing.ease);
    default:          return Easing.linear;
  }
}

function progress(frame: number, anim: LayerAnimation): Interpolatable {
  return interpolate(
    frame,
    [anim.startFrame, anim.startFrame + anim.durationInFrames],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: getEasing(anim.easing) }
  );
}

type AnimResult = {
  opacity?: number;
  translateX?: number;
  translateY?: number;
  scale?: number;
  rotate?: number;
};

export function applyAnimation(frame: number, anim: LayerAnimation): AnimResult {
  const p = progress(frame, anim);

  switch (anim.type) {
    case "fadeIn":
      return { opacity: p };

    case "fadeOut":
      return { opacity: 1 - p };

    case "slideLeft":
      return { translateX: interpolate(p, [0, 1], [120, 0]), opacity: p };

    case "slideRight":
      return { translateX: interpolate(p, [0, 1], [-120, 0]), opacity: p };

    case "slideUp":
      return { translateY: interpolate(p, [0, 1], [80, 0]), opacity: p };

    case "slideDown":
      return { translateY: interpolate(p, [0, 1], [-80, 0]), opacity: p };

    case "zoomIn":
      return { scale: interpolate(p, [0, 1], [0.4, 1]), opacity: p };

    case "zoomOut":
      return { scale: interpolate(p, [0, 1], [1, 0.4]), opacity: 1 - p };

    case "scale":
      return { scale: interpolate(p, [0, 1], [0.7, 1]) };

    case "slideOut":
      return { translateX: interpolate(p, [0, 1], [0, 200]), opacity: 1 - p };

    case "pulse": {
      const s = 1 + 0.06 * Math.sin(p * Math.PI * 4);
      return { scale: s };
    }

    case "bounce": {
      const bounced = Math.abs(Math.sin(p * Math.PI * 3)) * interpolate(p, [0, 1], [1, 0]);
      return { translateY: -bounced * 40 };
    }

    case "rotate":
      return { rotate: interpolate(p, [0, 1], [0, 360]) };

    case "shake": {
      // Oscillate translateX rapidly while active
      const shakeFrame = frame - anim.startFrame;
      const tx = Math.sin(shakeFrame * 1.8) * interpolate(p, [0, 0.7, 1], [8, 8, 0]);
      return { translateX: tx };
    }

    case "glow":
      // glow is handled via filter in the renderer; here we just pulse scale slightly
      return { scale: 1 + 0.04 * Math.sin(p * Math.PI * 6) };

    case "typewriter":
      // No transform — handled by LayerRenderer clipping text character count
      return { opacity: 1 };

    default:
      return {};
  }
}

/** Merge all animations for a layer at a given frame into a single CSS transform + opacity. */
export function resolveLayerAnimations(
  frame: number,
  animations: LayerAnimation[],
  baseOpacity: number
): React.CSSProperties {
  let opacity = baseOpacity;
  let translateX = 0;
  let translateY = 0;
  let scale = 1;
  let rotate = 0;

  for (const anim of animations) {
    if (frame < anim.startFrame || frame > anim.startFrame + anim.durationInFrames) continue;
    const r = applyAnimation(frame, anim);
    if (r.opacity !== undefined) opacity *= r.opacity;
    if (r.translateX !== undefined) translateX += r.translateX;
    if (r.translateY !== undefined) translateY += r.translateY;
    if (r.scale !== undefined) scale *= r.scale;
    if (r.rotate !== undefined) rotate += r.rotate;
  }

  const transform = [
    translateX !== 0 || translateY !== 0 ? `translate(${translateX}px, ${translateY}px)` : "",
    scale !== 1 ? `scale(${scale})` : "",
    rotate !== 0 ? `rotate(${rotate}deg)` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return { opacity, transform: transform || undefined };
}

// Import React for the return type
import type React from "react";
