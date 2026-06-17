import type { Template, TemplateScene, TemplateLayer, TemplateValues } from "./template-types";

const VAR_REGEX = /\{\{([A-Z0-9_]+)\}\}/g;

/** Replace {{VARIABLE}} tokens in a string with values from the map. */
export function resolveString(text: string, values: TemplateValues): string {
  return text.replace(VAR_REGEX, (_, key) => values[key] ?? "");
}

/** Deep-resolve all string fields in a layer. */
function resolveLayer(layer: TemplateLayer, values: TemplateValues): TemplateLayer {
  switch (layer.type) {
    case "text":
      return { ...layer, text: resolveString(layer.text, values) };
    case "image":
      return { ...layer, src: resolveString(layer.src, values) };
    case "logo":
      return layer;
    case "price":
      return {
        ...layer,
        oldPrice: resolveString(layer.oldPrice, values),
        newPrice: resolveString(layer.newPrice, values),
        suffix:   resolveString(layer.suffix,   values),
      };
    case "badge":
      return { ...layer, text: resolveString(layer.text, values) };
    default:
      return layer;
  }
}

function resolveScene(scene: TemplateScene, values: TemplateValues): TemplateScene {
  return {
    ...scene,
    layers: scene.layers.map((l) => resolveLayer(l, values)),
  };
}

/** Returns a template with all {{VAR}} tokens replaced by values. */
export function resolveTemplate(template: Template, values: TemplateValues): Template {
  const merged: TemplateValues = {};
  for (const v of template.variables) {
    merged[v.key] = values[v.key] ?? v.defaultValue;
  }
  return {
    ...template,
    scenes: template.scenes.map((s) => resolveScene(s, merged)),
  };
}

/** Build a TemplateValues map pre-filled with variable default values. */
export function defaultValues(template: Template): TemplateValues {
  return Object.fromEntries(template.variables.map((v) => [v.key, v.defaultValue]));
}

/** Total duration in frames. */
export function templateTotalFrames(template: Template): number {
  return template.scenes.reduce((acc, s) => acc + s.durationInFrames, 0);
}
