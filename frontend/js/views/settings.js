import { api } from "../api.js";
import { el, errorBanner, field, icon, numberOrNull, pageHead, refreshIcons, toast } from "../utils.js";

export async function render(root) {
  let s;
  try {
    s = await api.get("/settings");
  } catch (err) {
    root.replaceChildren(pageHead("Settings"), errorBanner(err.message));
    return;
  }

  const water = el("input", { type: "number", min: "0", step: "any", inputmode: "decimal", value: s.water_rate_per_m3 ?? "" });
  const power = el("input", { type: "number", min: "0", step: "any", inputmode: "decimal", value: s.electricity_rate_per_kwh ?? "" });
  const illustrative = el("input", { type: "checkbox", id: "s-illus", checked: s.rates_are_illustrative });
  const household = el("input", { type: "number", min: "1", max: "50", step: "1", value: s.household_size ?? "" });
  const error = el("div", { class: "form-error", role: "alert" });

  const form = el("form", { class: "stack", novalidate: true },
    el("div", { class: "fields" },
      field("s-water", "Water tariff (N$ per m³)", water, "1 m³ = 1,000 litres = 1 kℓ. Find it on your municipal water bill."),
      field("s-power", "Electricity rate (N$ per kWh)", power, "Prepaid: divide the N$ you paid by the kWh you received."),
      el("label", { class: "check full", for: "s-illus" }, illustrative, "These are illustrative rates, not my actual tariff"),
      field("s-house", "People in household (optional)", household),
    ),
    el("p", { class: "hint", text: "Leave a tariff empty to hide costs. EcoTrack uses a simple flat rate. Real bills can include block tariffs, fixed charges, levies and VAT, so treat costs as a usage estimate, not a bill." }),
    error,
    el("div", { class: "form-actions" }, el("button", { class: "btn primary", type: "submit" }, icon("check"), "Save settings")),
  );

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api.put("/settings", {
        water_rate_per_m3: numberOrNull(water.value),
        electricity_rate_per_kwh: numberOrNull(power.value),
        rates_are_illustrative: illustrative.checked,
        household_size: numberOrNull(household.value),
      });
      toast("Settings saved");
    } catch (err) {
      error.replaceChildren(errorBanner(err.message));
      refreshIcons();
    }
  });

  const demoActions = el("div", { class: "row" },
    el("button", { class: "btn", type: "button", onclick: async () => {
      try { const r = await api.post("/demo"); toast(`Demo household loaded (${r.loaded.water + r.loaded.electricity} records)`); }
      catch (err) { toast(err.message, "error"); }
      await render(root); refreshIcons();
    } }, icon("database"), "Load demo household"),
    el("button", { class: "btn danger", type: "button", onclick: async () => {
      if (!window.confirm("Remove all demo records and demo goals? Your own records are kept.")) return;
      try { await api.del("/demo"); toast("Demo data removed"); } catch (err) { toast(err.message, "error"); }
      await render(root); refreshIcons();
    } }, icon("trash-2"), "Remove demo data"));

  root.replaceChildren(
    pageHead("Settings", "Tariffs, household details and how EcoTrack calculates."),
    el("div", { class: "grid-2" },
      el("section", { class: "card" }, el("div", { class: "card-head" }, el("h2", {}, icon("receipt"), "Tariffs")), form),
      el("div", { class: "stack" },
        el("section", { class: "card stack" },
          el("h2", {}, icon("database"), " Demo data"),
          el("p", { class: "muted", text: "A fictional household with 9 weeks of records and illustrative rates. Every demo record is labelled and can be removed without touching your own data." }),
          demoActions),
        el("section", { class: "card stack" },
          el("h2", {}, icon("info"), " How EcoTrack calculates"),
          el("p", { class: "muted small", text: "Every figure is an estimate from the activities you record. EcoTrack is not connected to a meter." }),
          el("p", { class: "formula", text: "Water (L) = flow rate (L/min) × minutes × times" }),
          el("p", { class: "formula", text: "Energy (kWh) = watts × hours × uses per day × days ÷ 1000" }),
          el("p", { class: "formula", text: "Water cost = litres ÷ 1000 × N$ per m³" }),
          el("p", { class: "formula", text: "Electricity cost = kWh × N$ per kWh" }),
          el("p", { class: "muted small", text: "Records that cover several days, like a month of fridge use, are spread evenly across those days, so weekly and monthly views never count the same energy twice." })),
      ),
    ),
  );
}