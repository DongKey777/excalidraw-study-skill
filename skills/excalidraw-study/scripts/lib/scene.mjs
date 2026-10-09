// Excalidraw element factory. Every id, seed and nonce is derived from a
// stable string, and `updated` is a constant, so the same input always
// produces a byte-identical file.

export const UPDATED = 1790208000000;

export function hash(value) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 1;
}

export function base(id, frameId, meta, updated = UPDATED) {
  const el = {
    id,
    version: 1,
    versionNonce: hash(`nonce:${id}`),
    isDeleted: false,
    angle: 0,
    seed: hash(`seed:${id}`),
    groupIds: [],
    frameId,
    boundElements: [],
    updated,
    link: null,
    locked: false,
  };
  if (meta) el.customData = { study: meta };
  return el;
}

export function sceneFile(elements, { background = "#FFFFFF" } = {}) {
  return {
    type: "excalidraw",
    version: 2,
    source: "https://excalidraw.com",
    elements,
    appState: { gridSize: null, viewBackgroundColor: background },
    files: {},
  };
}

export function elementBounds(el) {
  if (el.type === "arrow" || el.type === "line") {
    const xs = el.points.map((p) => el.x + p[0]);
    const ys = el.points.map((p) => el.y + p[1]);
    return { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
  }
  return { x1: el.x, y1: el.y, x2: el.x + el.width, y2: el.y + el.height };
}

export function roleOf(el) {
  return el.customData?.study?.role ?? "body";
}

export function metaOf(el) {
  return el.customData?.study ?? {};
}
