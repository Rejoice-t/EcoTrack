import { api } from "../api.js";
import {
  badge, el, errorBanner, fmt, icon, isoDate, pageHead, refreshIcons, segmented,
} from "../utils.js";

let range = { period: "month", start: null, end: null };
let charts = [];

const COLORS = { water: "#2A73C9", power: "#B8730C", grid: "#E1DCF0", text: "#5D5874" };

export async function render(root) {
  charts.forEach((c) => c.destroy());
  charts = [];
  root.replaceChildren(el("p", { class: "loading", text: "Loading analytics…" }));

  const query = range.period === "custom"
    ? `start=${range.start}&end=${range.end}` : `period=${range.period}`;
  let data;
  try {
    data = await api.get(`/dashboard?${query}`);
  } catch (err) {
    root.replaceChildren(pageHead("Analytics"), controls(root), errorBanner(err.message));
    return;
  }

  const hasData = data.water.record_count > 0 || data.electricity.record_count > 0;
  root.replaceChildren(
    pageHead("Analytics", `${fmt.date(data.start)} to ${fmt.date(data.end)}, ${data.days} days. All figures are estimates from recorded activities.`),
    controls(root),
    hasData ? body(data) : el("div", { class: "empty" }, icon("chart-column"),
      el("h2", { text: "No data in this range" }),
      el("p", { text: "Pick a different range, or log some activities first." })),
  );
  if (hasData) drawCharts(root, data);
}

function controls(root) {
  const start = el("input", { type: "date", value: range.start || isoDate(new Date(Date.now() - 13 * 864e5)), "aria-label": "Start date" });
  const end = el("input", { type: "date", value: range.end || isoDate(), "aria-label": "End date" });
  const custom = el("form", { class: "row", hidden: range.period !== "custom",
    onsubmit: (e) => {
      e.preventDefault();
      range = { period: "custom", start: start.value, end: end.value };
      render(root).then(refreshIcons);
    } },
    start, el("span", { class: "muted", text: "to" }), end,
    el("button", { class: "btn small", type: "submit", text: "Apply" }));

  return el("div", { class: "row", style: "margin-bottom:20px" },
    segmented([["week", "Last 7 days"], ["month", "Last 30 days"], ["custom", "Custom range"]], range.period, (value) => {
      if (value === "custom") { range.period = "custom"; custom.hidden = false; return; }
      range = { period: value, start: null, end: null };
      render(root).then(refreshIcons);
    }, "Date range"),
    custom,
  );
}

function body(data) {
  const { water, electricity } = data;
  const hasCosts = water.cost !== null || electricity.cost !== null;

  return el("div", { class: "stack" },
    whereGoing(data),
    el("div", { class: "grid-2" },
      chartCard("Water per day", "droplet", "chart-water-daily", `Daily estimated water use. Total ${fmt.litres(water.total_litres)}.`),
      chartCard("Electricity per day", "zap", "chart-power-daily", `Daily estimated electricity use. Total ${fmt.kwh(electricity.total_kwh)}.`),
    ),
    el("div", { class: "grid-2" },
      chartCard("Water by activity", "droplet", "chart-water-cat", "Estimated litres by activity."),
      chartCard("Electricity by appliance", "zap", "chart-power-cat", "Estimated kWh by appliance."),
    ),
    hasCosts
      ? chartCard("Estimated cost by category", "receipt", "chart-cost",
          "Estimated usage cost in N$ by activity and appliance.",
          data.tariffs.rates_are_illustrative ? badge("illustrative") : badge("estimate"), true)
      : el("div", { class: "banner" }, icon("info"),
          el("span", {}, "Costs are hidden because no tariff is set. ", el("a", { href: "#/settings", text: "Add your tariffs" }), " to see estimated costs.")),
  );
}

function whereGoing(data) {
  const items = [
    ...data.water.by_activity.slice(0, 3).map((a) => ({
      resource: "water", title: fmt.label(a.name), share: a.share,
      amount: fmt.litres(a.litres), cost: a.cost,
      text: `${fmt.label(a.name)} makes up ${fmt.percent(a.share)} of your estimated water use, about ${fmt.litres(a.litres / data.days)} a day.`,
    })),
    ...data.electricity.by_appliance.slice(0, 3).map((a) => ({
      resource: "electricity", title: a.name, share: a.share,
      amount: fmt.kwh(a.kwh), cost: a.cost,
      text: `${a.name} makes up ${fmt.percent(a.share)} of your estimated electricity use, about ${fmt.kwh(a.kwh / data.days)} a day.`,
    })),
  ].sort((a, b) => b.share - a.share);

  return el("section", { class: "card", "aria-labelledby": "where-title" },
    el("div", { class: "card-head" },
      el("h2", { id: "where-title" }, icon("target"), "Where are my resources going?"),
      badge("estimate")),
    el("p", { class: "muted small", style: "margin-bottom:12px",
      text: "Your largest estimated uses, ranked by their share of each resource. The biggest shares are usually where a change makes the most difference." }),
    el("div", { class: "table-wrap" }, el("table", {},
      el("thead", {}, el("tr", {},
        el("th", { text: "Rank" }), el("th", { text: "Use" }), el("th", { class: "num", text: "Share" }),
        el("th", { class: "num", text: "Amount" }), el("th", { class: "num hide-sm", text: "Est. cost" }),
        el("th", { class: "hide-sm", text: "Why it matters" }))),
      el("tbody", {}, items.map((it, i) => el("tr", {},
        el("td", { class: "num", text: String(i + 1) }),
        el("td", {}, it.title, " ", badge(it.resource)),
        el("td", { class: "num", text: fmt.percent(it.share) }),
        el("td", { class: "num", text: it.amount }),
        el("td", { class: "num hide-sm", text: fmt.money(it.cost) }),
        el("td", { class: "muted hide-sm", text: it.text }),
      ))),
    )),
  );
}

function chartCard(title, iconName, id, description, extra, tall) {
  return el("section", { class: "card" },
    el("div", { class: "card-head" }, el("h2", {}, icon(iconName), title), extra || null),
    el("div", { class: `chart-box ${tall ? "tall" : ""}` },
      el("canvas", { id, role: "img", "aria-label": description })),
  );
}

function baseOptions(unit, horizontal = false) {
  const valueAxis = {
    beginAtZero: true,
    grid: { color: COLORS.grid },
    border: { display: false },
    ticks: { color: COLORS.text, callback: (v) => `${fmt.num(v)} ${unit}` },
  };
  const labelAxis = { grid: { display: false }, border: { color: COLORS.grid }, ticks: { color: COLORS.text } };
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    indexAxis: horizontal ? "y" : "x",
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx) => `${fmt.num(ctx.parsed[horizontal ? "x" : "y"])} ${unit}` } },
    },
    scales: horizontal ? { x: valueAxis, y: labelAxis } : { x: labelAxis, y: valueAxis },
  };
}

function bar(root, id, labels, values, color, unit, horizontal = false) {
  const canvas = root.querySelector(`#${id}`);
  if (!canvas || !window.Chart) return;
  charts.push(new window.Chart(canvas, {
    type: "bar",
    data: { labels, datasets: [{ data: values, backgroundColor: color, borderRadius: 3, maxBarThickness: 28 }] },
    options: baseOptions(unit, horizontal),
  }));
}

function drawCharts(root, data) {
  if (window.Chart) window.Chart.defaults.font.family = "'Atkinson Hyperlegible', 'Segoe UI', system-ui, sans-serif";
  const { water, electricity } = data;
  bar(root, "chart-water-daily", water.daily.map((d) => fmt.date(d.date)), water.daily.map((d) => d.litres), COLORS.water, "L");
  bar(root, "chart-power-daily", electricity.daily.map((d) => fmt.date(d.date)), electricity.daily.map((d) => d.kwh), COLORS.power, "kWh");
  bar(root, "chart-water-cat", water.by_activity.map((a) => fmt.label(a.name)), water.by_activity.map((a) => a.litres), COLORS.water, "L", true);
  bar(root, "chart-power-cat", electricity.by_appliance.map((a) => a.name), electricity.by_appliance.map((a) => a.kwh), COLORS.power, "kWh", true);

  const costs = [
    ...water.by_activity.filter((a) => a.cost !== null).map((a) => ({ label: `${fmt.label(a.name)} (water)`, value: a.cost, color: COLORS.water })),
    ...electricity.by_appliance.filter((a) => a.cost !== null).map((a) => ({ label: a.name, value: a.cost, color: COLORS.power })),
  ].sort((a, b) => b.value - a.value);
  if (costs.length) {
    const canvas = root.querySelector("#chart-cost");
    if (canvas && window.Chart) {
      const options = baseOptions("", true);
      options.scales.x.ticks.callback = (v) => `N$ ${v}`;
      options.plugins.tooltip.callbacks.label = (ctx) => fmt.money(ctx.parsed.x);
      charts.push(new window.Chart(canvas, {
        type: "bar",
        data: { labels: costs.map((c) => c.label), datasets: [{ data: costs.map((c) => c.value), backgroundColor: costs.map((c) => c.color), borderRadius: 3, maxBarThickness: 22 }] },
        options,
      }));
    }
  }
}