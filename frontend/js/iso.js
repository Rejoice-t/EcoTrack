// Isometric "household" scene for the dashboard, drawn as flat-shaded SVG.
// No gradients, no shadows: each 3D face is a single flat colour.
const NS = "http://www.w3.org/2000/svg";

function svg(tag, attrs = {}, ...children) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) node.setAttribute(k, v);
  for (const c of children) if (c) node.append(c);
  return node;
}

const TANK_SIZES = [1000, 2500, 5000, 10000, 20000, 50000];

export function tankCapacity(litres) {
  return TANK_SIZES.find((size) => litres <= size) || Math.ceil(litres / 10000) * 10000;
}

const fmt0 = new Intl.NumberFormat("en-NA", { maximumFractionDigits: 0 });
const fmt1 = new Intl.NumberFormat("en-NA", { maximumFractionDigits: 1 });

// A corrugated water tank whose water level = litres / capacity
function tank(litres, capacity) {
  const cx = 130, top = 70, bottom = 270, R = 78, ry = R * 0.5;
  const level = capacity ? Math.min(litres / capacity, 1) : 0;
  const inner = R - 7, innerRy = inner * 0.5;
  const waterTop = bottom - (bottom - top - 12) * level;
  const g = svg("g", { class: "iso-tank" });

  // Ground ellipse
  g.append(svg("ellipse", { cx, cy: bottom + 4, rx: R + 18, ry: ry + 9, class: "iso-ground" }));
  // Back wall (inside of the tank)
  g.append(svg("path", {
    d: `M${cx - R},${top} L${cx - R},${bottom} A${R},${ry} 0 0 0 ${cx + R},${bottom} L${cx + R},${top} Z`,
    class: "tank-inside",
  }));
  g.append(svg("ellipse", { cx, cy: top, rx: R, ry, class: "tank-inside-top" }));

  // Water
  if (level > 0) {
    const water = svg("g", { class: "tank-water" });
    water.append(svg("path", {
      d: `M${cx - inner},${waterTop} L${cx - inner},${bottom - 2} A${inner},${innerRy} 0 0 0 ${cx + inner},${bottom - 2} L${cx + inner},${waterTop} Z`,
      class: "water-side",
    }));
    water.append(svg("ellipse", { cx, cy: waterTop, rx: inner, ry: innerRy, class: "water-top" }));
    g.append(water);
  }

  // Front shell (see-through) with horizontal ribs
  g.append(svg("path", {
    d: `M${cx - R},${top} L${cx - R},${bottom} A${R},${ry} 0 0 0 ${cx + R},${bottom} L${cx + R},${top} A${R},${ry} 0 0 1 ${cx - R},${top} Z`,
    class: "tank-shell",
  }));
  for (let i = 1; i <= 6; i++) {
    const y = top + ((bottom - top) / 7) * i;
    g.append(svg("path", { d: `M${cx - R},${y} A${R},${ry} 0 0 0 ${cx + R},${y}`, class: "tank-rib" }));
  }
  // Rim and lid
  g.append(svg("ellipse", { cx, cy: top, rx: R, ry, class: "tank-rim" }));
  g.append(svg("ellipse", { cx, cy: top - 4, rx: 22, ry: 11, class: "tank-lid" }));
  g.append(svg("rect", { x: cx - 22, y: top - 10, width: 44, height: 6, class: "tank-lid-side" }));
  g.append(svg("ellipse", { cx, cy: top - 10, rx: 22, ry: 11, class: "tank-lid" }));

  // Level marker on the right
  if (level > 0) {
    const mx = cx + R + 10;
    g.append(svg("line", { x1: cx + R - 2, y1: waterTop, x2: mx + 6, y2: waterTop, class: "tank-marker" }));
    g.append(svg("text", { x: mx + 10, y: waterTop + 4, class: "iso-label strong" }, document.createTextNode(`${Math.round(level * 100)}%`)));
  }
  return g;
}

// Stacked isometric blocks, one per appliance, height proportional to kWh
function energyStack(appliances) {
  const g = svg("g", { class: "iso-stack" });
  const ox = 372, baseY = 270, w = 62;       // w = half-width of the block's top diamond
  const maxHeight = 190;
  const total = appliances.reduce((s, a) => s + a.kwh, 0);
  const point = (x, y) => `${x},${y}`;

  g.append(svg("path", {
    d: `M${ox},${baseY + 8 + w / 2} L${ox + w + 18},${baseY + 8} L${ox},${baseY + 8 - w / 2 - 9} L${ox - w - 18},${baseY + 8} Z`,
    class: "iso-ground",
  }));

  if (!total) return g;

  let y = baseY;
  const labels = [];
  appliances.forEach((a, i) => {
    const h = Math.max(6, (a.kwh / total) * maxHeight);
    const yTop = y - h;
    const tone = i % 2 ? "b" : "a";
    // left face, right face, top face
    g.append(svg("polygon", { class: `block-left ${tone}`,
      points: [point(ox - w, y), point(ox, y + w / 2), point(ox, yTop + w / 2), point(ox - w, yTop)].join(" ") }));
    g.append(svg("polygon", { class: `block-right ${tone}`,
      points: [point(ox, y + w / 2), point(ox + w, y), point(ox + w, yTop), point(ox, yTop + w / 2)].join(" ") }));
    if (i === appliances.length - 1) {
      g.append(svg("polygon", { class: "block-top",
        points: [point(ox - w, yTop), point(ox, yTop + w / 2), point(ox + w, yTop), point(ox, yTop - w / 2)].join(" ") }));
    }
    labels.push({ y: yTop + h / 2 + w / 4, name: a.label.length > 16 ? `${a.label.slice(0, 15)}…` : a.label, kwh: a.kwh, edgeY: yTop + h / 2 });
    y = yTop;
  });

  // Labels to the right, spaced so they never overlap
  let lastY = Infinity;
  labels.forEach((l) => {
    const ly = Math.min(l.y, lastY - 20);
    lastY = ly;
    g.append(svg("line", { x1: ox + w + 4, y1: l.edgeY, x2: ox + w + 22, y2: ly - 4, class: "tank-marker" }));
    const t = svg("text", { x: ox + w + 26, y: ly, class: "iso-label" });
    t.append(document.createTextNode(`${l.name} `));
    t.append(svg("tspan", { class: "strong" }, document.createTextNode(`${fmt1.format(l.kwh)} kWh`)));
    g.append(t);
  });
  return g;
}

export function householdScene({ litres, appliances }) {
  const capacity = tankCapacity(litres);
  const top = appliances.slice(0, 5).map((a) => ({ label: a.name, kwh: a.kwh }));
  const rest = appliances.slice(5).reduce((s, a) => s + a.kwh, 0);
  if (rest > 0) top.push({ label: "Other", kwh: rest });

  const root = svg("svg", {
    viewBox: "24 34 616 316", class: "iso-scene", role: "img",
    "aria-label": `Water used: ${fmt0.format(litres)} litres, ${Math.round((litres / capacity) * 100)}% of a ${fmt0.format(capacity)} litre tank. ` +
      `Electricity by appliance: ${top.map((a) => `${a.label} ${fmt1.format(a.kwh)} kWh`).join(", ")}.`,
  });
  root.append(tank(litres, capacity), energyStack(top));
  root.append(svg("text", { x: 130, y: 342, class: "iso-caption", "text-anchor": "middle" },
    document.createTextNode(`${fmt0.format(capacity)} L tank`)));
  return { node: root, capacity };
}