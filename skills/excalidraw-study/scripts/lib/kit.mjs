// Slide DSL. A slide module receives this kit, describes slides with
// slide(spec, draw), and build.mjs turns them into Excalidraw frames.
// Coordinates inside draw() are frame-local: (0,0) is the top-left of a
// 1600x900 frame. Every primitive returns what later layout needs.
import { base } from "./scene.mjs";
import { estWidth, fitText, lineCount, maxLineWidth, textHeight, wrapParagraph, wrapText } from "./text.mjs";

const REF = /\{\{#([a-z0-9][a-z0-9-]*)\}\}/g;

export function slide(spec, draw = () => {}) {
  return { spec, draw };
}

export function rect(x, y, w, h) {
  return { x, y, w, h };
}

export function inset(r, dx, dy = dx) {
  return { x: r.x + dx, y: r.y + dy, w: r.w - dx * 2, h: r.h - dy * 2 };
}

// Split a rect along one axis. `parts` is a count or an array of weights.
export function split(r, parts, { dir = "h", gap = 24 } = {}) {
  const weights = Array.isArray(parts) ? parts : Array.from({ length: parts }, () => 1);
  const total = weights.reduce((a, b) => a + b, 0);
  const span = (dir === "h" ? r.w : r.h) - gap * (weights.length - 1);
  const out = [];
  let at = dir === "h" ? r.x : r.y;
  for (const wgt of weights) {
    const size = Math.round((span * wgt) / total);
    out.push(dir === "h" ? { x: at, y: r.y, w: size, h: r.h } : { x: r.x, y: at, w: r.w, h: size });
    at += size + gap;
  }
  const last = out[out.length - 1];
  if (dir === "h") last.w = r.x + r.w - last.x;
  else last.h = r.y + r.h - last.y;
  return out;
}

export class Slide {
  constructor(ctx, spec, index) {
    this.ctx = ctx;
    this.theme = ctx.theme;
    this.config = ctx.config;
    this.spec = spec;
    this.index = index;
    this.number = index + 1;
    this.nn = String(this.number).padStart(2, "0");
    const cv = this.theme.canvas;
    this.W = cv.width;
    this.H = cv.height;
    this.ox = (index % cv.columns) * (cv.width + cv.gapX);
    this.oy = Math.floor(index / cv.columns) * (cv.height + cv.gapY);
    this.frameId = `${spec.id}-frame`;
    this.counter = 0;
    this.groups = [];
    this.elements = [];
    this.centered = [];
    this.C = this.theme.colors;
    const steps = ctx.steps;
    this.stepTheme = steps.find((s) => s.name === spec.step) ?? this.theme.neutral;
    this.addFrame();
    this.addChrome();
  }

  // Called after draw(). Centred boxes with a title and a body, of the same
  // size in one row, start their content where the fullest box starts, so
  // their titles line up.
  finish() {
    const rows = new Map();
    for (const b of this.centered) {
      const key = `${Math.round(b.y)}:${Math.round(b.h)}`;
      rows.set(key, [...(rows.get(key) ?? []), b]);
    }
    const byId = new Map(this.elements.map((el) => [el.id, el]));
    for (const row of rows.values()) {
      if (row.length < 2) continue;
      const top = Math.min(...row.map((b) => b.top));
      for (const b of row) {
        for (const ref of b.ids) {
          const el = byId.get(ref.id);
          if (el) el.y -= b.top - top;
        }
      }
    }
  }

  // bookkeeping
  id(hint) {
    this.counter += 1;
    return `${this.spec.id}-${String(this.counter).padStart(3, "0")}-${hint}`;
  }

  meta(opts, role) {
    const m = { role: opts.role ?? role };
    if (opts.lint) m.lint = opts.lint;
    return m;
  }

  push(el) {
    el.groupIds = [...this.groups].reverse();
    this.elements.push(el);
    return el.id;
  }

  resolve(value) {
    return String(value).replace(REF, (_, key) => {
      const n = this.ctx.refs.get(key);
      if (!n) throw new Error(`${this.spec.id}: unknown slide reference {{#${key}}}`);
      return String(n);
    });
  }

  // Elements drawn inside fn move together in the Excalidraw app.
  group(fn) {
    const gid = this.id("group");
    this.groups.push(gid);
    try {
      return fn(gid);
    } finally {
      this.groups.pop();
    }
  }

  get body() {
    const L = this.theme.layout;
    return { x: L.margin, y: L.headerBottom, w: L.contentWidth, h: this.bodyBottom - L.headerBottom };
  }

  cols(r, parts, gap = 24) {
    return split(r, parts, { dir: "h", gap });
  }

  rows(r, parts, gap = 24) {
    return split(r, parts, { dir: "v", gap });
  }

  inset(r, dx, dy) {
    return inset(r, dx, dy);
  }

  // primitives
  addFrame() {
    this.elements.push({
      type: "frame",
      x: this.ox,
      y: this.oy,
      width: this.W,
      height: this.H,
      name: `${this.nn}. ${this.spec.title}`,
      backgroundColor: "transparent",
      fillStyle: "solid",
      strokeColor: this.C.line,
      strokeWidth: 2,
      strokeStyle: "solid",
      roughness: 0,
      roundness: null,
      opacity: 100,
      ...base(this.frameId, null, { role: "frame", slide: this.spec.id }, this.ctx.updated),
    });
  }

  rect(x, y, width, height, opts = {}) {
    const id = this.id(opts.hint || "rect");
    return this.push({
      type: "rectangle",
      x: this.ox + x,
      y: this.oy + y,
      width,
      height,
      backgroundColor: opts.fill ?? this.C.white,
      fillStyle: opts.fillStyle ?? "solid",
      strokeColor: opts.stroke ?? this.C.line,
      strokeWidth: opts.strokeWidth ?? 2,
      strokeStyle: opts.strokeStyle ?? "solid",
      roughness: 0,
      roundness: opts.radius === 0 ? null : { type: 3, value: opts.radius ?? 8 },
      opacity: opts.opacity ?? 100,
      ...base(id, this.frameId, this.meta(opts, "shape"), this.ctx.updated),
    });
  }

  ellipse(x, y, width, height, opts = {}) {
    const id = this.id(opts.hint || "ellipse");
    return this.push({
      type: "ellipse",
      x: this.ox + x,
      y: this.oy + y,
      width,
      height,
      backgroundColor: opts.fill ?? this.C.white,
      fillStyle: "solid",
      strokeColor: opts.stroke ?? opts.fill ?? this.C.line,
      strokeWidth: opts.strokeWidth ?? 2,
      strokeStyle: opts.strokeStyle ?? "solid",
      roughness: 0,
      roundness: { type: 3 },
      opacity: opts.opacity ?? 100,
      ...base(id, this.frameId, this.meta(opts, "shape"), this.ctx.updated),
    });
  }

  text(value, x, y, width, opts = {}) {
    const size = opts.size ?? 24;
    const lineHeight = opts.lineHeight ?? 1.25;
    const family = opts.family ?? this.theme.font.sans;
    let str = this.resolve(value);
    if (opts.wrap) str = wrapText(str, size, width, family);
    const id = this.id(opts.hint || "text");
    this.push({
      type: "text",
      x: this.ox + x,
      y: this.oy + y,
      width,
      height: textHeight(str, size, lineHeight),
      fontSize: size,
      fontFamily: family,
      textAlign: opts.align ?? "left",
      verticalAlign: opts.verticalAlign ?? "top",
      containerId: null,
      lineHeight,
      autoResize: false,
      strokeColor: opts.color ?? this.C.ink,
      backgroundColor: "transparent",
      fillStyle: "solid",
      strokeWidth: 1,
      strokeStyle: "solid",
      roughness: 0,
      opacity: opts.opacity ?? 100,
      text: str,
      originalText: str,
      ...base(id, this.frameId, this.meta(opts, family === this.theme.font.mono ? "code" : "text"), this.ctx.updated),
    });
    return { id, x, y, w: width, h: textHeight(str, size, lineHeight), text: str };
  }

  // Straight arrow from (x1,y1) to (x2,y2). opts.via adds bend points
  // (frame-local) for an orthogonal route.
  arrow(x1, y1, x2, y2, opts = {}) {
    const id = this.id(opts.hint || "arrow");
    const pts = [[x1, y1], ...(opts.via ?? []), [x2, y2]].map(([px, py]) => [px - x1, py - y1]);
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    return this.push({
      type: opts.type ?? "arrow",
      x: this.ox + x1,
      y: this.oy + y1,
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
      points: pts,
      strokeColor: opts.color ?? this.C.slate,
      strokeWidth: opts.width ?? 3,
      strokeStyle: opts.style ?? "solid",
      roughness: 0,
      startArrowhead: opts.start ?? null,
      endArrowhead: opts.end === undefined ? "arrow" : opts.end,
      opacity: opts.opacity ?? 100,
      startBinding: null,
      endBinding: null,
      lastCommittedPoint: null,
      backgroundColor: "transparent",
      fillStyle: "solid",
      roundness: opts.via ? null : { type: 2 },
      ...base(id, this.frameId, this.meta(opts, opts.type === "line" ? "rule" : "connector"), this.ctx.updated),
    });
  }

  line(x1, y1, x2, y2, opts = {}) {
    return this.arrow(x1, y1, x2, y2, { ...opts, end: null, type: "line", hint: opts.hint || "line", color: opts.color ?? this.C.line });
  }

  // small composites
  pill(label, x, y, width, opts = {}) {
    const height = opts.height ?? 42;
    const size = opts.size ?? 18;
    return this.group(() => {
      this.rect(x, y, width, height, {
        fill: opts.fill ?? this.C.slateSoft,
        stroke: opts.stroke ?? opts.fill ?? this.C.slateSoft,
        strokeWidth: 1,
        radius: opts.radius ?? 10,
        hint: opts.hint ? `${opts.hint}-box` : "pill",
        role: opts.role ? `${opts.role}.box` : "pill.box",
        lint: opts.lint,
      });
      this.text(label, x, y + (height - size * 1.25) / 2, width, {
        size,
        color: opts.color ?? this.C.slate,
        align: "center",
        hint: opts.hint ? `${opts.hint}-label` : "pill-label",
        role: opts.role ? `${opts.role}.label` : "pill.label",
        lint: opts.lint,
      });
      return { x, y, w: width, h: height };
    });
  }

  // A pill sized to its label. anchor "center" or "right" moves x.
  chip(label, x, y, opts = {}) {
    const size = opts.size ?? this.theme.type.chip;
    const width = Math.ceil(estWidth(this.resolve(label), size) + (opts.padX ?? 18) * 2);
    const left = opts.anchor === "center" ? x - width / 2 : opts.anchor === "right" ? x - width : x;
    this.pill(label, left, y, width, { ...opts, size, height: opts.height ?? 34, role: opts.role ?? "chip" });
    return width;
  }

  // Titled box. Content is centred vertically unless valign is "top".
  // Lines wider than the box are wrapped at spaces.
  box(x, y, width, height, title, body, opts = {}) {
    const t = this.theme.tones[opts.tone ?? "plain"];
    if (!t) throw new Error(`${this.spec.id}: unknown tone ${opts.tone}`);
    const titleSize = opts.titleSize ?? this.theme.type.cardTitle;
    const bodySize = opts.bodySize ?? this.theme.type.body;
    const bodyLH = opts.bodyLineHeight ?? 1.4;
    const pad = opts.pad ?? 22;
    const inner = width - pad * 2;
    const family = opts.family ?? this.theme.font.sans;
    const titleFamily = opts.titleFamily ?? this.theme.font.sans;
    const titleStr = title ? (opts.wrap === false ? this.resolve(title) : wrapText(this.resolve(title), titleSize, inner, titleFamily)) : "";
    const bodyStr = body ? (opts.wrap === false ? this.resolve(body) : wrapText(this.resolve(body), bodySize, inner, family)) : "";
    return this.group(() => {
      this.rect(x, y, width, height, {
        fill: opts.fill ?? t.fill,
        stroke: opts.stroke ?? t.stroke,
        strokeWidth: opts.strokeWidth ?? 2,
        strokeStyle: opts.strokeStyle,
        radius: opts.radius ?? 8,
        hint: "box",
        role: "card.box",
        lint: opts.lint,
      });
      const titleH = lineCount(titleStr) * titleSize * 1.2;
      const bodyH = lineCount(bodyStr) * bodySize * bodyLH;
      const gap = titleStr && bodyStr ? (opts.gap ?? 12) : 0;
      const total = titleH + gap + bodyH;
      const top = opts.valign === "top" ? y + (opts.padTop ?? 18) : y + (height - total) / 2;
      const align = opts.align ?? "center";
      const ids = [];
      if (titleStr) {
        ids.push(this.text(titleStr, x + pad, top, inner, {
          size: titleSize, color: opts.titleColor ?? t.title, align, lineHeight: 1.2,
          family: titleFamily, hint: "box-title", role: "card.title", lint: opts.lint,
        }));
      }
      if (bodyStr) {
        ids.push(this.text(bodyStr, x + pad, top + titleH + gap, inner, {
          size: bodySize, color: opts.bodyColor ?? this.C.ink, align, lineHeight: bodyLH,
          family, hint: "box-body", role: family === this.theme.font.mono ? "code" : "card.body", lint: opts.lint,
        }));
      }
      if (opts.valign !== "top" && titleStr && bodyStr) this.centered.push({ y, h: height, top, ids });
      return { x, y, w: width, h: height };
    });
  }

  // Height a card needs for its title and body at width w.
  cardHeight(w, { title = "", body = "", ...opts } = {}) {
    const pad = opts.pad ?? 22;
    const titleSize = opts.titleSize ?? this.theme.type.cardTitle;
    const bodySize = opts.bodySize ?? this.theme.type.body;
    const inner = w - pad * 2;
    const titleStr = title ? wrapText(this.resolve(title), titleSize, inner, opts.titleFamily ?? this.theme.font.sans) : "";
    const bodyStr = body ? wrapText(this.resolve(body), bodySize, inner, opts.family ?? this.theme.font.sans) : "";
    const gap = titleStr && bodyStr ? (opts.gap ?? 12) : 0;
    return Math.ceil(lineCount(titleStr) * titleSize * 1.2 + gap + lineCount(bodyStr) * bodySize * (opts.bodyLineHeight ?? 1.4) + (opts.padY ?? 26) * 2);
  }

  // box() on a rect, shrinking the body text (down to opts.min) until it fits.
  card(r, { title = "", body = "", ...opts } = {}) {
    const pad = opts.pad ?? 22;
    const titleSize = opts.titleSize ?? this.theme.type.cardTitle;
    const titleFamily = opts.titleFamily ?? this.theme.font.sans;
    const family = opts.family ?? this.theme.font.sans;
    const bodyLH = opts.bodyLineHeight ?? 1.4;
    const titleStr = title ? wrapText(this.resolve(title), titleSize, r.w - pad * 2, titleFamily) : "";
    const titleH = lineCount(titleStr) * titleSize * 1.2 + (titleStr && body ? (opts.gap ?? 12) : 0);
    const fit = body
      ? fitText(this.resolve(body), {
        size: opts.bodySize ?? this.theme.type.body,
        min: opts.min ?? this.theme.minSize.body,
        maxWidth: r.w - pad * 2,
        maxHeight: r.h - titleH - (opts.valign === "top" ? 36 : 28),
        lineHeight: bodyLH,
        family,
      })
      : { size: opts.bodySize ?? this.theme.type.body, text: "" };
    return this.box(r.x, r.y, r.w, r.h, titleStr, fit.text, { ...opts, bodySize: fit.size, wrap: false });
  }

  code(value, x, y, width, height, opts = {}) {
    const size = opts.size ?? this.theme.type.code;
    const lh = opts.lineHeight ?? 1.35;
    const str = this.resolve(value);
    return this.group(() => {
      this.rect(x, y, width, height, {
        fill: opts.fill ?? this.C.slate,
        stroke: opts.stroke ?? opts.fill ?? this.C.slate,
        strokeWidth: 1,
        radius: 8,
        hint: "code-box",
        role: "code.box",
      });
      const textH = lineCount(str) * size * lh;
      const ty = opts.valign === "top" ? y + (opts.padTop ?? 18) : y + (height - textH) / 2;
      const marks = [...new Set(opts.highlight ?? [])].sort((a, b) => a - b);
      const runs = [];
      for (const i of marks) {
        const last = runs[runs.length - 1];
        if (last && i === last[1] + 1) last[1] = i;
        else runs.push([i, i]);
      }
      for (const [from, to] of runs) {
        this.rect(x + 10, ty + from * size * lh - 2, width - 20, (to - from + 1) * size * lh + 4, {
          fill: opts.highlightFill ?? "#3B82F6", stroke: opts.highlightFill ?? "#3B82F6",
          strokeWidth: 1, radius: 4, opacity: 40, hint: "code-mark", role: "code.mark",
        });
      }
      this.text(str, x + 24, ty, width - 48, {
        size, color: opts.color ?? this.C.white, align: opts.align ?? "left",
        family: this.theme.font.mono, lineHeight: lh, hint: "code", role: "code", lint: opts.lint,
      });
      return { x, y, w: width, h: height };
    });
  }

  page(x, y, label, opts = {}) {
    const width = opts.width ?? 92;
    const height = opts.height ?? 60;
    const size = opts.size ?? 16;
    return this.group(() => {
      this.rect(x, y, width, height, {
        fill: opts.fill ?? this.C.white, stroke: opts.stroke ?? this.C.line,
        strokeWidth: opts.strokeWidth ?? 2, radius: 5, hint: "page", role: "page.box",
      });
      if (label) {
        this.text(label, x + 4, y + (height - size * 1.25 * lineCount(label)) / 2, width - 8, {
          size, color: opts.color ?? this.C.ink, align: "center", hint: "page-label", role: "page.label",
        });
      }
      return { x, y, w: width, h: height };
    });
  }

  label(value, x, y, width, opts = {}) {
    return this.text(value, x, y, width, { size: this.theme.type.label, color: this.C.muted, role: "label", ...opts });
  }

  // Numbered circle for sequences where the order itself is the content.
  marker(n, x, y, opts = {}) {
    const d = opts.d ?? 40;
    const color = opts.color ?? this.stepTheme.color;
    return this.group(() => {
      this.ellipse(x, y, d, d, { fill: color, stroke: color, strokeWidth: 1, hint: "marker", role: "marker.box" });
      this.text(String(n), x, y + (d - 18 * 1.25) / 2, d, { size: 18, color: this.C.white, align: "center", hint: "marker-label", role: "marker.label" });
      return { x, y, w: d, h: d };
    });
  }

  // layout components
  // Arrow between two rects, leaving from the facing edges.
  connect(a, b, opts = {}) {
    const gap = opts.gap ?? 8;
    const ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
    const bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    const horizontal = opts.dir ? opts.dir === "h" : Math.abs(bc.x - ac.x) >= Math.abs(bc.y - ac.y);
    let p1;
    let p2;
    if (horizontal) {
      const right = bc.x > ac.x;
      const y = opts.y ?? (Math.max(a.y, b.y) + Math.min(a.y + a.h, b.y + b.h)) / 2;
      const yy = Number.isFinite(y) && y > Math.max(a.y, b.y) && y < Math.min(a.y + a.h, b.y + b.h) ? y : ac.y;
      p1 = [right ? a.x + a.w + gap : a.x - gap, yy];
      p2 = [right ? b.x - gap : b.x + b.w + gap, opts.y ?? (yy >= b.y && yy <= b.y + b.h ? yy : bc.y)];
    } else {
      const down = bc.y > ac.y;
      const x = opts.x ?? (Math.max(a.x, b.x) + Math.min(a.x + a.w, b.x + b.w)) / 2;
      const xx = x > Math.max(a.x, b.x) && x < Math.min(a.x + a.w, b.x + b.w) ? x : ac.x;
      p1 = [xx, down ? a.y + a.h + gap : a.y - gap];
      p2 = [opts.x ?? (xx >= b.x && xx <= b.x + b.w ? xx : bc.x), down ? b.y - gap : b.y + b.h + gap];
    }
    const id = this.arrow(p1[0], p1[1], p2[0], p2[1], { color: opts.color, width: opts.width ?? 2, style: opts.style, start: opts.start, end: opts.end });
    if (opts.label) {
      const size = opts.labelSize ?? this.theme.type.caption;
      const mx = (p1[0] + p2[0]) / 2;
      const my = (p1[1] + p2[1]) / 2;
      const w = Math.ceil(maxLineWidth(opts.label, size)) + 8;
      if (horizontal) this.text(opts.label, mx - w / 2, my - size * 1.25 - 6, w, { size, color: opts.labelColor ?? this.C.muted, align: "center", role: "connector.label" });
      else this.text(opts.label, mx + 12, my - (size * 1.25) / 2, w, { size, color: opts.labelColor ?? this.C.muted, role: "connector.label" });
    }
    return id;
  }

  // Nodes and edges: commit graphs, trees, state machines. Node positions are
  // centres. nodes: [{ id, x, y, label, sub, shape: "circle" | "box", w, h, d, tone }]
  // edges: [{ from, to, label, route: "straight" | "hv" | "vh", style, color, arrow }]
  // ("hv" goes across then down/up, "vh" the other way). Returns { nodes, edges }
  // with each node's rect ({ x, y, w, h, cx, cy }) so other elements can be placed.
  graph(nodes, edges = [], opts = {}) {
    const gap = opts.gap ?? 6;
    const rects = {};
    return this.group(() => {
      for (const n of nodes) {
        const tone = this.theme.tones[n.tone ?? opts.tone ?? "plain"];
        if (!tone) throw new Error(`${this.spec.id}: unknown tone ${n.tone}`);
        const circle = (n.shape ?? opts.shape ?? "circle") === "circle";
        const w = circle ? (n.d ?? opts.d ?? 44) : (n.w ?? opts.w ?? 120);
        const h = circle ? w : (n.h ?? opts.h ?? 44);
        const x = n.x - w / 2;
        const y = n.y - h / 2;
        const style = { fill: n.fill ?? tone.fill, stroke: n.stroke ?? tone.stroke, strokeWidth: n.strokeWidth ?? 2, strokeStyle: n.strokeStyle, hint: "node", role: "graph.node" };
        if (circle) this.ellipse(x, y, w, h, style);
        else this.rect(x, y, w, h, { ...style, radius: n.radius ?? 8 });
        if (n.label) {
          const size = n.size ?? opts.size ?? 15;
          const lw = Math.max(w, Math.ceil(maxLineWidth(this.resolve(n.label), size)) + 8);
          this.text(n.label, n.x - lw / 2, n.y - (lineCount(n.label) * size * 1.25) / 2, lw, { size, color: n.color ?? tone.title, align: "center", hint: "node-label", role: "graph.label" });
        }
        if (n.sub) {
          const size = opts.subSize ?? 14;
          const sw = Math.max(w, Math.ceil(maxLineWidth(this.resolve(n.sub), size)) + 8);
          this.text(n.sub, n.x - sw / 2, y + h + 6, sw, { size, color: this.C.muted, align: "center", hint: "node-sub", role: "graph.sub" });
        }
        rects[n.id] = { x, y, w, h, cx: n.x, cy: n.y, circle };
      }
      const exit = (r, dx, dy) => {
        const len = Math.hypot(dx, dy) || 1;
        if (r.circle) return [r.cx + (dx / len) * (r.w / 2 + gap), r.cy + (dy / len) * (r.w / 2 + gap)];
        const sx = dx ? (r.w / 2 + gap) / Math.abs(dx) : Infinity;
        const sy = dy ? (r.h / 2 + gap) / Math.abs(dy) : Infinity;
        const k = Math.min(sx, sy);
        return [r.cx + dx * k, r.cy + dy * k];
      };
      const ids = edges.map((e) => {
        const a = rects[e.from];
        const b = rects[e.to];
        if (!a || !b) throw new Error(`${this.spec.id}: graph edge ${e.from} -> ${e.to} names an unknown node`);
        const route = e.route ?? opts.route ?? "straight";
        const draw = { color: e.color ?? opts.edgeColor ?? this.C.slate, width: e.width ?? 2, style: e.style, end: e.arrow === false ? null : (e.end ?? "arrow"), hint: "edge", role: "graph.edge" };
        let p1;
        let p2;
        let via;
        if (route === "hv" || route === "vh") {
          const corner = route === "hv" ? [b.cx, a.cy] : [a.cx, b.cy];
          p1 = exit(a, corner[0] - a.cx, corner[1] - a.cy);
          p2 = exit(b, corner[0] - b.cx, corner[1] - b.cy);
          via = [corner];
        } else {
          p1 = exit(a, b.cx - a.cx, b.cy - a.cy);
          p2 = exit(b, a.cx - b.cx, a.cy - b.cy);
        }
        const id = this.arrow(p1[0], p1[1], p2[0], p2[1], { ...draw, via });
        if (e.label) {
          const size = opts.labelSize ?? this.theme.type.caption;
          const lw = Math.ceil(maxLineWidth(this.resolve(e.label), size)) + 8;
          const lh = size * 1.25;
          if (via) {
            this.text(e.label, via[0][0] + 8, via[0][1] - lh - 4, lw, { size, color: this.C.muted, hint: "edge-label", role: "graph.edge-label" });
          } else if (Math.abs(p2[0] - p1[0]) >= Math.abs(p2[1] - p1[1])) {
            const mx = (p1[0] + p2[0]) / 2;
            const top = Math.min(p1[1], p2[1]);
            this.text(e.label, mx - lw / 2, top - lh - 8, lw, { size, color: this.C.muted, align: "center", hint: "edge-label", role: "graph.edge-label" });
          } else {
            const my = (p1[1] + p2[1]) / 2;
            this.text(e.label, Math.max(p1[0], p2[0]) + 10, my - lh / 2, lw, { size, color: this.C.muted, hint: "edge-label", role: "graph.edge-label" });
          }
        }
        return id;
      });
      return { nodes: rects, edges: ids };
    });
  }

  // Cards in a row (dir "h") or column (dir "v") joined by arrows. In a row,
  // cards take the height their content needs (opts.height overrides) and sit
  // at the top of r (opts.valign "center" | "bottom"). Returns the card rects.
  flow(r, items, opts = {}) {
    const dir = opts.dir ?? "h";
    const gap = opts.gap ?? 56;
    const list = items.map((it) => (typeof it === "string" ? { title: it } : it));
    let area = r;
    if (dir === "h") {
      const cellsW = split(r, list.map((it) => it.weight || 1), { dir, gap });
      const need = Math.max(...list.map((it, i) => this.cardHeight(cellsW[i].w, { title: it.title, body: it.body, titleSize: opts.titleSize, bodySize: opts.bodySize })));
      const h = Math.min(r.h, opts.height ?? Math.max(need, opts.minHeight ?? 120));
      const y = opts.valign === "center" ? r.y + (r.h - h) / 2 : opts.valign === "bottom" ? r.y + r.h - h : r.y;
      area = { x: r.x, y, w: r.w, h };
    }
    const cells = split(area, list.map((it) => it.weight || 1), { dir, gap });
    list.forEach((item, i) => {
      this.card(cells[i], { title: item.title, body: item.body, tone: item.tone ?? opts.tone ?? "plain", titleSize: opts.titleSize, bodySize: opts.bodySize, align: opts.align, min: opts.min });
      if (i > 0) this.connect(cells[i - 1], cells[i], { dir, gap: 6, color: opts.arrowColor, label: item.via });
    });
    return cells;
  }

  // Table. rows[0] is the header unless opts.header === false. A cell is a
  // string or { t, color, size, family, fill }.
  table(r, rows, opts = {}) {
    const size = opts.size ?? 17;
    const headSize = opts.headSize ?? size;
    const lh = opts.lineHeight ?? 1.3;
    const pad = opts.pad ?? 14;
    const header = opts.header !== false;
    const cols = split({ x: r.x, y: r.y, w: r.w, h: 0 }, opts.weights ?? rows[0].length, { dir: "h", gap: 0 });
    const cellText = (cell, ci, isHead) => {
      const c = typeof cell === "object" && cell !== null ? cell : { t: String(cell ?? "") };
      const s = c.size ?? (isHead ? headSize : size);
      const family = c.family ?? this.theme.font.sans;
      return { ...c, s, family, t: wrapText(this.resolve(c.t), s, cols[ci].w - pad * 2, family) };
    };
    const prepared = rows.map((row, ri) => row.map((cell, ci) => cellText(cell, ci, header && ri === 0)));
    const natural = prepared.map((row) => Math.max(...row.map((c) => lineCount(c.t) * c.s * lh)) + pad * 2);
    const extra = Math.max(0, r.h - natural.reduce((a, b) => a + b, 0));
    const heights = opts.fill ? natural.map((h) => h + extra / natural.length) : natural;
    return this.group(() => {
      let y = r.y;
      prepared.forEach((row, ri) => {
        const isHead = header && ri === 0;
        const h = heights[ri];
        this.rect(r.x, y, r.w, h, {
          fill: isHead ? (opts.headFill ?? this.C.slateSoft) : (opts.rowFills?.[ri] ?? this.C.white),
          stroke: this.C.line, strokeWidth: 1, radius: 0, hint: "table-row", role: "table.row",
        });
        row.forEach((c, ci) => {
          const col = cols[ci];
          if (ci > 0) this.line(col.x, y, col.x, y + h, { color: this.C.line, width: 1, hint: "table-sep" });
          if (c.fill) this.rect(col.x + 1, y + 1, col.w - 2, h - 2, { fill: c.fill, stroke: c.fill, strokeWidth: 1, radius: 0, hint: "table-cell-fill", role: "table.fill" });
          const th = lineCount(c.t) * c.s * lh;
          this.text(c.t, col.x + pad, y + (h - th) / 2, col.w - pad * 2, {
            size: c.s, color: c.color ?? (isHead ? this.C.slate : this.C.ink),
            align: c.align ?? opts.align?.[ci] ?? "left", lineHeight: lh, family: c.family,
            hint: isHead ? "table-head" : "table-cell", role: isHead ? "table.head" : "table.cell",
          });
        });
        y += h;
      });
      return { x: r.x, y: r.y, w: r.w, h: y - r.y };
    });
  }

  // Events on a horizontal axis. event: { at, title, body, tone, pos (0..1) }.
  timeline(r, events, opts = {}) {
    const color = opts.color ?? this.C.slate;
    const axisY = r.y + (opts.axisOffset ?? 44);
    this.line(r.x, axisY, r.x + r.w, axisY, { color, width: 2, hint: "axis" });
    const n = events.length;
    const cardW = opts.cardWidth ?? Math.min(320, (r.w - (n - 1) * 24) / n);
    events.forEach((ev, i) => {
      const pos = ev.pos ?? (n === 1 ? 0.5 : i / (n - 1));
      const cx = r.x + cardW / 2 + pos * (r.w - cardW);
      const tone = this.theme.tones[ev.tone ?? "plain"];
      this.ellipse(cx - 9, axisY - 9, 18, 18, { fill: tone.stroke, stroke: tone.stroke, hint: "tick" });
      if (ev.at) this.text(ev.at, cx - cardW / 2, axisY - 44, cardW, { size: opts.atSize ?? 17, color: this.C.muted, align: "center", role: "timeline.at" });
      const top = axisY + 26;
      const cardOpts = { titleSize: opts.titleSize ?? 20, bodySize: opts.bodySize ?? 17, pad: 18 };
      const need = Math.max(...events.map((e) => this.cardHeight(cardW, { title: e.title, body: e.body, ...cardOpts })));
      const h = Math.min(r.y + r.h - top, opts.cardHeight ?? need);
      this.card({ x: cx - cardW / 2, y: top, w: cardW, h }, {
        title: ev.title, body: ev.body, tone: ev.tone ?? "plain", valign: "top", align: "left", ...cardOpts,
      });
    });
  }

  // Horizontal bars. data: [{ label, value, note, tone }].
  bars(r, data, opts = {}) {
    const max = opts.max ?? Math.max(...data.map((d) => d.value));
    const labelW = opts.labelWidth ?? 260;
    const valueW = opts.valueWidth ?? 180;
    const rowH = r.h / data.length;
    const barH = Math.min(opts.barHeight ?? 34, rowH * 0.6);
    data.forEach((d, i) => {
      const y = r.y + i * rowH + (rowH - barH) / 2;
      const tone = this.theme.tones[d.tone ?? opts.tone ?? "info"];
      const size = opts.size ?? 18;
      this.text(d.label, r.x, y + (barH - size * 1.25) / 2, labelW - 16, { size, color: this.C.ink, align: "right", role: "chart.label" });
      const span = r.w - labelW - valueW;
      const w = Math.max(2, Math.round((span * d.value) / max));
      this.rect(r.x + labelW, y, w, barH, { fill: tone.fill, stroke: tone.stroke, strokeWidth: 2, radius: 4, hint: "bar", role: "chart.bar" });
      const shown = d.display ?? (opts.format ? opts.format(d.value) : String(d.value));
      this.text(shown, r.x + labelW + w + 12, y + (barH - size * 1.25) / 2, valueW + span - w - 12, { size, color: tone.title, role: "chart.value" });
    });
  }

  // Muted explanatory text that wraps to width.
  note(value, x, y, width, opts = {}) {
    return this.text(value, x, y, width, { size: opts.size ?? 17, color: opts.color ?? this.C.muted, align: opts.align ?? "left", wrap: true, role: "note", lineHeight: opts.lineHeight ?? 1.35, ...opts });
  }

  // chrome
  addChrome() {
    const T = this.theme;
    const L = T.layout;
    const C = this.C;
    const spec = this.spec;
    const labels = this.ctx.labels;
    const variant = spec.chrome ?? "full";
    this.rect(0, 0, this.W, this.H, { fill: C.surface, stroke: C.surface, strokeWidth: 1, radius: 0, hint: "background", role: "chrome.background" });

    if (variant === "cover") {
      this.bodyBottom = L.footerBottom;
      const items = spec.items ?? [];
      const textW = items.length ? 820 : L.contentWidth;
      if (this.config.series) this.text(this.config.series, L.margin, 96, textW, { size: 22, color: C.muted, hint: "series", role: "chrome.series" });
      this.rect(L.margin, 250, 88, 8, { fill: C.blue, stroke: C.blue, strokeWidth: 1, radius: 4, hint: "accent", role: "chrome.accent" });
      const fit = fitText(this.resolve(spec.title), { size: 64, min: 40, maxWidth: textW, maxHeight: 240, lineHeight: 1.2 });
      this.text(fit.text, L.margin, 290, textW, { size: fit.size, lineHeight: 1.2, color: C.ink, hint: "title", role: "chrome.title" });
      const titleH = textHeight(fit.text, fit.size, 1.2);
      if (spec.subtitle) this.text(spec.subtitle, L.margin + 2, 290 + titleH + 28, textW, { size: 26, color: C.muted, wrap: true, lineHeight: 1.35, hint: "subtitle", role: "chrome.subtitle" });
      if (spec.meta) this.text(spec.meta, L.margin, 800, textW, { size: 18, color: C.muted, hint: "meta", role: "chrome.meta" });
      if (items.length) {
        const x = 1000;
        const w = L.margin + L.contentWidth - x;
        const rowH = Math.min(64, 560 / items.length);
        const top = 450 - (rowH * items.length) / 2;
        this.line(x - 40, top, x - 40, top + rowH * items.length, { color: C.line, width: 2, hint: "toc-rule", role: "chrome.toc" });
        items.forEach((it, i) => {
          const y = top + i * rowH;
          const item = typeof it === "string" ? { text: it } : it;
          const n = item.ref ? this.ctx.refs.get(item.ref) : i + 1;
          if (!n) throw new Error(`${this.spec.id}: unknown slide reference "${item.ref}" in items`);
          this.text(String(n).padStart(2, "0"), x, y + (rowH - 22) / 2, 44, { size: 18, color: C.blueText, family: this.theme.font.mono, hint: "toc-n", role: "chrome.toc" });
          this.text(item.text, x + 56, y + (rowH - 26) / 2, w - 56, { size: 21, color: C.ink, hint: "toc", role: "chrome.toc" });
        });
      }
      return;
    }

    const part = this.ctx.parts[spec.part] ?? (spec.part ? { label: spec.part } : null);
    const badge = spec.badge ?? `${this.nn}${part ? `  ${part.label}${part.topic ? ` · ${part.topic}` : ""}` : ""}`;
    const badgeW = Math.ceil(estWidth(badge, 18) + 48);
    this.pill(badge, L.margin, 45, badgeW, { fill: this.stepTheme.soft, color: this.stepTheme.color, size: 18, height: 40, hint: "badge", role: "chrome.badge" });

    const steps = this.ctx.steps;
    const right = L.margin + L.contentWidth;
    if (spec.step && steps.length) {
      const chipW = Math.max(62, ...steps.map((s) => Math.ceil(estWidth(s.name, T.type.step) + 30)));
      const gap = 6;
      const startX = right - (chipW * steps.length + gap * (steps.length - 1));
      steps.forEach((step, i) => {
        const active = step.name === spec.step;
        this.pill(step.name, startX + i * (chipW + gap), 48, chipW, {
          fill: active ? step.color : C.slateSoft, color: active ? C.white : C.mutedStrong,
          size: T.type.step, height: 30, hint: "step", role: "chrome.step",
        });
      });
    }
    if (this.config.series) this.text(this.config.series, right - 600, 88, 600, { size: 15, color: C.muted, align: "right", hint: "series", role: "chrome.series" });

    let titleSize = T.type.title;
    const title = this.resolve(spec.title);
    while (titleSize > T.type.titleMin && estWidth(title, titleSize) > L.contentWidth) titleSize -= 2;
    this.text(title, L.margin, 112, L.contentWidth, { size: titleSize, color: C.ink, hint: "title", role: "chrome.title" });

    // The source is a footnote under the takeaway bar when it fits on one line there.
    const source = spec.source ? this.resolve(spec.source) : "";
    const footSize = !source || !spec.takeaway ? null
      : [T.type.meta, T.minSize.meta].find((size) => estWidth(source, size) <= L.contentWidth) ?? null;
    const sourceOnTop = Boolean(source) && footSize === null;
    const subW = sourceOnTop ? L.contentWidth - 90 : L.contentWidth;
    let subSize = T.type.subtitle;
    const subtitle = this.resolve(spec.subtitle ?? "");
    while (subSize > T.type.subtitleMin && estWidth(subtitle, subSize) > subW) subSize -= 1;
    if (subtitle) this.text(subtitle, L.margin + 2, 178, subW, { size: subSize, color: C.muted, hint: "subtitle", role: "chrome.subtitle" });
    if (sourceOnTop) {
      const srcW = 830;
      const srcLines = wrapParagraph(source, T.type.meta, srcW);
      const srcY = 208 - (srcLines.length - 1) * 16;
      this.text(srcLines.join("\n"), right - srcW, srcY, srcW, { size: T.type.meta, color: C.muted, align: "right", lineHeight: 1.25, hint: "source", role: "chrome.source" });
    } else if (footSize) {
      const footY = L.footerBottom + Math.round((T.canvas.height - L.footerBottom - footSize * 1.25) / 2);
      this.text(source, L.margin, footY, L.contentWidth, { size: footSize, color: C.muted, align: "right", lineHeight: 1.25, hint: "source", role: "chrome.source" });
    }

    if (!spec.takeaway) {
      this.bodyBottom = L.footerBottom;
      return;
    }
    const hasLeft = Boolean(spec.left);
    const labelW = Math.max(64, Math.ceil(Math.max(estWidth(labels.takeaway, 17), hasLeft ? estWidth(labels.left, 15) : 0)) + 6);
    const textX = L.margin + 22 + labelW + 9;
    const textW = right - textX - 30;
    const takeLines = wrapParagraph(this.resolve(spec.takeaway), T.type.takeaway, textW);
    const takeH = takeLines.length * Math.ceil(T.type.takeaway * 1.25);
    let leftSize = T.type.left;
    let leftLines = hasLeft ? wrapParagraph(this.resolve(spec.left), leftSize, textW) : [];
    if (leftLines.length > 1) {
      leftSize -= 1;
      leftLines = wrapParagraph(this.resolve(spec.left), leftSize, textW);
    }
    const leftH = leftLines.length * Math.ceil(leftSize * 1.25);
    const barH = hasLeft ? Math.max(80, 10 + takeH + 4 + 11 + leftH + 10) : Math.max(54, 12 + takeH + 18);
    const barY = L.footerBottom - barH;
    this.barY = barY;
    this.bodyBottom = barY - L.footerGap;
    this.rect(L.margin, barY, L.contentWidth, barH, { fill: this.stepTheme.soft, stroke: this.stepTheme.color, strokeWidth: 1, radius: 8, hint: "takeaway", role: "chrome.footer" });
    this.text(labels.takeaway, L.margin + 22, barY + (hasLeft ? 13 : 15), labelW, { size: 17, color: this.stepTheme.color, hint: "takeaway-label", role: "chrome.footer.label" });
    this.text(takeLines.join("\n"), textX, barY + (hasLeft ? 10 : 12), textW, { size: T.type.takeaway, color: C.ink, lineHeight: 1.25, hint: "takeaway-text", role: "chrome.takeaway" });
    if (hasLeft) {
      const ruleY = barY + 10 + takeH + 4;
      this.line(L.margin + 22, ruleY, right - 22, ruleY, { color: this.stepTheme.color, width: 1, hint: "left-rule", role: "chrome.footer.rule" });
      this.text(labels.left, L.margin + 22, ruleY + 11, labelW, { size: 15, color: C.yellowText, hint: "left-label", role: "chrome.footer.label" });
      this.text(leftLines.join("\n"), textX, ruleY + 10, textW, { size: leftSize, color: C.slate, lineHeight: 1.25, hint: "left-text", role: "chrome.left" });
    }
  }
}
