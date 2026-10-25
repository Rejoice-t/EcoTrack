import { api } from "../api.js";
import { householdScene } from "../iso.js";
import {
  badge, el, errorBanner, fmt, icon, pageHead, rankedList, refreshIcons, segmented, toast,
} from "../utils.js";

let period = "week";
const PERIOD_WORDS = { week: "the last 7 days", month: "the last 30 days" };

export async function render(root) {
  root.replaceChildren(el("p", { class: "loading", text: "Loading your summary…" }));
  let data, goals;
  try {
    [data, goals] = await Promise.all([api.get(`/dashboard?period=${period}`), api.get("/goals")]);
  } catch (err) {
    root.replaceChildren(pageHead("Your household"), errorBanner(err.message));
    return;
  }

  const periodControl = segmented(
    [["week", "Last 7 days"], ["month", "Last 30 days"]], period,
    (value) => { period = value; render(root).then(refreshIcons); }, "Period",
  );

  const hasData = data.water.record_count > 0 || data.electricity.record_count > 0;
  root.replaceChildren(
    pageHead("Your household", `Estimated from the activities you recorded, ${fmt.date(data.start)} to ${fmt.date(data.end)}.`, periodControl),
    hasData ? dashboardBody(data, goals) : emptyState(root),
  );
}

function emptyState(root) {
  return el("div", { class: "empty" },
    icon("droplet"),
    el("h2", { text: `Nothing recorded in ${PERIOD_WORDS[period]}` }),
    el("p", { text: "Log a shower or an appliance to see where your water and electricity go, or explore a fictional demo household first." }),
    el("div", { class: "row" },
      el("a", { class: "btn primary", href: "#/water" }, icon("plus"), "Log water use"),
      el("a", { class: "btn", href: "#/electricity" }, icon("plus"), "Log appliance use"),
      el("button", {
        class: "btn", type: "button",
        onclick: async (e) => {
          e.currentTarget.disabled = true;
          try { await api.post("/demo"); toast("Demo household loaded"); }
          catch (err) { toast(err.message, "error"); }
          await render(root); refreshIcons();
        },
      }, icon("database"), "Load demo household"),
    ),
  );
}

function dashboardBody(data, goals) {
  const { water, electricity } = data;
  const parts = [];

  if (data.contains_demo_data) {
    parts.push(el("div", { class: "banner demo" }, icon("info"),
      el("span", { text: "You are looking at a fictional demo household. Remove it in Settings when you start logging your own data." })));
  }

  parts.push(hero(data));

  parts.push(el("div", { class: "grid-2" },
    topCard("Largest water uses", "droplet", water.by_activity.slice(0, 5).map((a) => ({ ...a, label: fmt.label(a.name) })),
      (a) => fmt.litres(a.litres), "water", "#/water"),
    topCard("Largest electricity uses", "zap", electricity.by_appliance.slice(0, 5).map((a) => ({ ...a, label: a.name })),
      (a) => fmt.kwh(a.kwh), "power", "#/electricity"),
  ));

  parts.push(goalsCard(goals));
  return el("div", { class: "stack" }, parts);
}

function hero(data) {
  const { water, electricity, tariffs, comparison } = data;
  const { node: scene, capacity } = householdScene({ litres: water.total_litres, appliances: electricity.by_appliance });
  const tankShare = Math.round((water.total_litres / capacity) * 100);

  const totalCost = water.cost === null && electricity.cost === null
    ? null : (water.cost || 0) + (electricity.cost || 0);

  const cost = totalCost === null
    ? el("div", { class: "hero-cost" },
        el("span", { class: "muted", text: "No tariff set, so costs are hidden." }),
        el("a", { href: "#/settings", text: "Add your tariffs" }))
    : el("div", { class: "hero-cost" },
        el("div", { class: "row" },
          el("strong", { class: "num", text: fmt.money(totalCost) }),
          tariffs.rates_are_illustrative ? badge("illustrative") : badge("estimate")),
        el("span", { class: "hero-note num", text: `Water ${fmt.money(water.cost)}, electricity ${fmt.money(electricity.cost)}. Usage only: your bill may add fixed charges and levies.` }));

  return el("section", { class: "hero", "aria-labelledby": "hero-intro" },
    scene,
    el("div", { class: "hero-copy" },
      el("p", { class: "hero-intro", id: "hero-intro", text: `In ${PERIOD_WORDS[period]} your household used about` }),
      el("div", {},
        el("p", { class: "hero-figure water" }, icon("droplet"), el("strong", { class: "num", text: fmt.litresNum(water.total_litres) }), el("span", { text: "litres of water" })),
        el("p", { class: "hero-note", text: `Enough to fill ${tankShare}% of a ${fmt.litresNum(capacity)} litre tank, or ${fmt.litres(water.daily_average_litres)} a day.` }),
        changeNote(comparison.water)),
      el("div", {},
        el("p", { class: "hero-figure power" }, icon("zap"), el("strong", { class: "num", text: fmt.kwhNum(electricity.total_kwh) }), el("span", { text: "kWh of electricity" })),
        el("p", { class: "hero-note", text: `About ${fmt.kwh(electricity.daily_average_kwh)} a day.` }),
        changeNote(comparison.electricity)),
      cost,
    ),
  );
}

function changeNote(comp) {
  if (!comp.available) return el("p", { class: "hero-note", text: "Not enough earlier data to compare yet." });
  const pct = comp.change_percent;
  if (pct === 0) return el("p", { class: "change muted", text: "The same as the period before." });
  const up = pct > 0;
  return el("p", { class: `change ${up ? "up" : "down"}` },
    icon(up ? "arrow-up" : "arrow-down"),
    `${Math.abs(pct)}% ${up ? "more" : "less"} than the period before`);
}

function topCard(title, iconName, items, valueText, barClass, link) {
  return el("section", { class: "card" },
    el("div", { class: "card-head" },
      el("h2", {}, icon(iconName), title),
      el("a", { href: link, class: "small", text: "See records" })),
    items.length
      ? rankedList(items, { valueText, share: (a) => a.share, barClass })
      : el("p", { class: "muted", text: "Nothing recorded in this period." }),
  );
}

function goalsCard(goals) {
  const current = goals.filter((g) => g.status !== "not_started").slice(0, 4);
  return el("section", { class: "card" },
    el("div", { class: "card-head" },
      el("h2", {}, icon("target"), "Budget goals"),
      el("a", { href: "#/goals", class: "small", text: current.length ? "Manage goals" : "Set a goal" })),
    current.length
      ? el("ol", { class: "ranked" }, current.map(goalRow))
      : el("p", { class: "muted", text: "No active goals. A budget goal helps you stay under a monthly amount of water or electricity." }),
  );
}

export function goalRow(g) {
  const statusText = { on_track: "On track", close: "Close to budget", over: "Over budget", not_started: "Not started" }[g.status];
  const statusClass = { on_track: "success", close: "demo", over: "danger", not_started: "" }[g.status];
  const used = g.unit === "L" ? fmt.litres(g.used) : fmt.kwh(g.used);
  const target = g.unit === "L" ? fmt.litres(g.target_value) : fmt.kwh(g.target_value);
  return el("li", {},
    el("span", { class: "name" }, `${g.title} `, el("span", { class: `badge ${statusClass}`, text: statusText })),
    el("span", { class: "value num", text: `${used} of ${target}` }),
    el("div", { class: `bar goal ${g.status}`, role: "progressbar", "aria-label": g.title,
      "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": String(Math.round(Math.min(g.percent_used, 100))) },
      el("span", { style: `width:${Math.max(2, Math.min(100, g.percent_used))}%` })),
    el("span", { class: "hint", text: `${fmt.percent(g.percent_used)} used, day ${g.days_elapsed} of ${g.days_total}` }),
  );
}