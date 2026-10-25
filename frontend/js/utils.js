// Shared helpers. All text goes in with textContent, never innerHTML,
// so user-entered and AI-written text can never run as code.

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2), value);
    else if (key === "dataset") Object.assign(node.dataset, value);
    else if (value === true) node.setAttribute(key, "");
    else node.setAttribute(key, value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function icon(name, cls) {
  return el("i", { "data-lucide": name, class: cls, "aria-hidden": "true" });
}

export function refreshIcons() {
  if (window.lucide) window.lucide.createIcons({ attrs: { "stroke-width": 1.75 } });
}

const nf0 = new Intl.NumberFormat("en-NA", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("en-NA", { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("en-NA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmt = {
  litres: (n) => `${nf0.format(n)} L`,
  litresNum: (n) => nf0.format(n),
  kwh: (n) => `${nf1.format(n)} kWh`,
  kwhNum: (n) => nf1.format(n),
  money: (n) => (n === null || n === undefined ? "—" : `N$ ${nf2.format(n)}`),
  percent: (n) => `${nf1.format(n)}%`,
  num: (n) => nf1.format(n),
  date: (iso) => new Date(iso.length === 10 ? `${iso}T00:00:00` : iso)
    .toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
  dateTime: (iso) => new Date(iso).toLocaleString("en-GB", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  }),
  label: (s) => s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()),
};

const BADGES = {
  estimate: ["Estimate", ""],
  demo: ["Demo data", "demo"],
  ai: ["AI suggestion", "ai"],
  fallback: ["Built-in tip", ""],
  illustrative: ["Illustrative rate", "demo"],
  water: ["Water", "water"],
  electricity: ["Electricity", "power"],
};

export function badge(kind, text) {
  const [label, cls] = BADGES[kind] || [kind, ""];
  return el("span", { class: `badge ${cls}`.trim(), text: text || label });
}

let toastTimer;
export function toast(message, type = "info") {
  const box = document.getElementById("toast");
  box.textContent = message;
  box.className = `toast ${type === "error" ? "error" : ""}`;
  box.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { box.hidden = true; }, 3500);
}

export function pageHead(title, subtitle, ...actions) {
  return el("div", { class: "page-head" },
    el("div", {}, el("h1", { text: title }), subtitle ? el("p", { text: subtitle }) : null),
    actions.length ? el("div", { class: "row" }, ...actions) : null,
  );
}

export function segmented(options, current, onChange, label) {
  const group = el("div", { class: "segmented", role: "group", "aria-label": label });
  for (const [value, text] of options) {
    group.append(el("button", {
      type: "button", "aria-pressed": String(value === current), text,
      onclick: () => onChange(value),
    }));
  }
  return group;
}

export function errorBanner(message) {
  return el("div", { class: "banner error", role: "alert" }, icon("triangle-alert"), el("span", { text: message }));
}

// Date helpers (local time, YYYY-MM-DD)
export function isoDate(d = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function isoDateTimeLocal(d = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${isoDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function numberOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function field(id, labelText, input, hint, extraClass) {
  input.id = id;
  if (hint) input.setAttribute("aria-describedby", `${id}-hint`);
  return el("div", { class: `field ${extraClass || ""}`.trim() },
    el("label", { for: id, text: labelText }),
    input,
    hint ? el("span", { class: "hint", id: `${id}-hint`, text: hint }) : null,
  );
}

export function rankedList(items, { valueText, share, barClass }) {
  return el("ol", { class: "ranked" }, items.map((item) =>
    el("li", {},
      el("span", { class: "name", text: item.label }),
      el("span", { class: "value num" }, valueText(item), el("span", { class: "share", text: fmt.percent(share(item)) })),
      el("div", { class: `bar ${barClass}`, role: "presentation" },
        el("span", { style: `width:${Math.max(2, Math.min(100, share(item)))}%` })),
    )));
}