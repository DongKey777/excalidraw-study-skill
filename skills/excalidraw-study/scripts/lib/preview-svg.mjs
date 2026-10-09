// Fallback preview used only when no browser is available. It draws the
// element types the kit emits with system fonts; it is not Excalidraw's
// renderer, and render-report.json says so.

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const SANS = "Apple SD Gothic Neo, Noto Sans CJK KR, Noto Sans KR, Malgun Gothic, Helvetica, Arial, sans-serif";
const MONO = "Menlo, Consolas, DejaVu Sans Mono, monospace";

function head(x, y, angle, color, width) {
  const len = 10 + width * 2;
  const a1 = angle + Math.PI - 0.45;
  const a2 = angle + Math.PI + 0.45;
  return `<polyline points="${x + len * Math.cos(a1)},${y + len * Math.sin(a1)} ${x},${y} ${x + len * Math.cos(a2)},${y + len * Math.sin(a2)}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

export function frameToSvg(frame, elements) {
  const ox = frame.x;
  const oy = frame.y;
  const parts = [];
  for (const el of elements) {
    if (el.type === "frame" || el.isDeleted) continue;
    const x = el.x - ox;
    const y = el.y - oy;
    const op = ((el.opacity ?? 100) / 100).toFixed(2);
    const dash = el.strokeStyle === "dashed" ? ` stroke-dasharray="10 8"` : el.strokeStyle === "dotted" ? ` stroke-dasharray="2 6"` : "";
    const fill = el.backgroundColor === "transparent" ? "none" : el.backgroundColor;
    if (el.type === "rectangle") {
      const r = el.roundness ? (el.roundness.value ?? 8) : 0;
      parts.push(`<rect x="${x}" y="${y}" width="${el.width}" height="${el.height}" rx="${r}" fill="${fill}" stroke="${el.strokeColor}" stroke-width="${el.strokeWidth}" opacity="${op}"${dash}/>`);
    } else if (el.type === "ellipse") {
      parts.push(`<ellipse cx="${x + el.width / 2}" cy="${y + el.height / 2}" rx="${el.width / 2}" ry="${el.height / 2}" fill="${fill}" stroke="${el.strokeColor}" stroke-width="${el.strokeWidth}" opacity="${op}"${dash}/>`);
    } else if (el.type === "arrow" || el.type === "line") {
      const pts = el.points.map(([px, py]) => [x + px, y + py]);
      parts.push(`<polyline points="${pts.map((p) => p.join(",")).join(" ")}" fill="none" stroke="${el.strokeColor}" stroke-width="${el.strokeWidth}" stroke-linecap="round" opacity="${op}"${dash}/>`);
      if (el.endArrowhead) {
        const [a, b] = [pts[pts.length - 2], pts[pts.length - 1]];
        parts.push(head(b[0], b[1], Math.atan2(b[1] - a[1], b[0] - a[0]), el.strokeColor, el.strokeWidth));
      }
      if (el.startArrowhead) {
        const [a, b] = [pts[1], pts[0]];
        parts.push(head(b[0], b[1], Math.atan2(b[1] - a[1], b[0] - a[0]), el.strokeColor, el.strokeWidth));
      }
    } else if (el.type === "text") {
      const fam = [3, 8].includes(el.fontFamily ?? 2) ? MONO : SANS;
      const anchor = el.textAlign === "center" ? "middle" : el.textAlign === "right" ? "end" : "start";
      const tx = el.textAlign === "center" ? x + el.width / 2 : el.textAlign === "right" ? x + el.width : x;
      const lh = el.fontSize * (el.lineHeight ?? 1.25);
      const spans = el.text.split("\n").map((l, i) => `<tspan x="${tx}" y="${(y + lh * i + el.fontSize * 0.92).toFixed(1)}">${esc(l) || " "}</tspan>`).join("");
      parts.push(`<text font-family="${fam}" font-size="${el.fontSize}" fill="${el.strokeColor}" opacity="${op}" text-anchor="${anchor}" xml:space="preserve">${spans}</text>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${frame.width}" height="${frame.height}" viewBox="0 0 ${frame.width} ${frame.height}">
<rect width="${frame.width}" height="${frame.height}" fill="#FFFFFF"/>
${parts.join("\n")}
</svg>`;
}
