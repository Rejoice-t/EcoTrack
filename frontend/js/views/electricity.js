import { api } from "../api.js";
import {
  badge, el, errorBanner, field, fmt, icon, isoDate, numberOrNull, pageHead, refreshIcons, toast,
} from "../utils.js";

// Illustrative starting values only (check the label on your appliance).
const DEFAULTS = {
  kettle: { name: "Kettle", watts: 2000, minutes: 3, uses: 4 },
  geyser: { name: "Geyser", watts: 3000, minutes: 120, uses: 1 },
  fridge: { name: "Fridge", method: "kwh", kwhPerDay: 1.1 },
  washing_machine: { name: "Washing machine", watts: 500, minutes: 60, uses: 1 },
  iron: { name: "Iron", watts: 1200, minutes: 30, uses: 1 },
  heater: { name: "Heater", watts: 2000, minutes: 120, uses: 1 },
  lighting: { name: "Lights", watts: 60, minutes: 300, uses: 1 },
  stove: { name: "Stove", watts: 2000, minutes: 45, uses: 1 },
  other: { name: "", watts: 100, minutes: 60, uses: 1 },
};

let editing = null;
let showAll = false;

export async function render(root) {
  root.replaceChildren(
    pageHead("Track electricity", "Log appliance use. EcoTrack estimates kWh from power and time, or uses kWh you already know."),
    el("div", { class: "split" }, formCard(root), el("div", { id: "power-list" })),
  );
  await loadList(root);
}

function formCard(root) {
  const v = editing;
  const category = el("select", { name: "category" },
    Object.keys(DEFAULTS).map((c) => el("option", { value: c, text: fmt.label(c), selected: v?.category === c })));
  const name = el("input", { type: "text", name: "appliance_name", maxlength: "60", required: true, value: v?.appliance_name ?? "" });

  const mPower = el("input", { type: "radio", name: "method", value: "power", id: "m-power" });
  const mKwh = el("input", { type: "radio", name: "method", value: "kwh", id: "m-kwh" });

  const watts = el("input", { type: "number", min: "0", max: "20000", step: "any", inputmode: "decimal" });
  const minutes = el("input", { type: "number", min: "0", max: "1440", step: "any", inputmode: "decimal" });
  const uses = el("input", { type: "number", min: "1", max: "100", step: "1", value: v?.uses_per_day ?? 1 });
  const kwh = el("input", { type: "number", min: "0", max: "100000", step: "any", inputmode: "decimal" });
  const start = el("input", { type: "date", required: true, value: v?.start_date ?? isoDate() });
  const days = el("input", { type: "number", min: "1", max: "366", step: "1", value: v?.days_covered ?? 1 });
  const notes = el("input", { type: "text", maxlength: "200", value: v?.notes ?? "" });

  const powerFields = el("div", { class: "fields full" },
    field("e-watts", "Rated power (watts)", watts, "On the appliance label. Illustrative default shown."),
    field("e-minutes", "Minutes per use", minutes),
    field("e-uses", "Uses per day", uses),
  );
  const kwhField = field("e-kwh", "Total kWh for the whole period", kwh,
    "For a fridge: take the yearly kWh on its energy label, divide by 365, and multiply by the days covered.", "full");
  const fridgeNote = el("div", { class: "banner full" }, icon("info"),
    el("span", { text: "Fridges switch on and off through the day, so rated power × 24 hours overestimates their use. The kWh on the energy label is a better estimate." }));
  const preview = el("p", { class: "estimate-preview num", "aria-live": "polite" });
  const error = el("div", { class: "form-error", role: "alert" });

  function setMethod(method) {
    mPower.checked = method === "power";
    mKwh.checked = method === "kwh";
    powerFields.hidden = method !== "power";
    kwhField.hidden = method !== "kwh";
    updatePreview();
  }

  function applyDefaults() {
    const d = DEFAULTS[category.value];
    if (!editing && (!name.value || Object.values(DEFAULTS).some((x) => x.name === name.value))) name.value = d.name;
    watts.value = d.watts ?? "";
    minutes.value = d.minutes ?? "";
    uses.value = d.uses ?? 1;
    kwh.value = d.kwhPerDay ? (d.kwhPerDay * (Number(days.value) || 1)).toFixed(2) : "";
    setMethod(d.method || "power");
  }

  function updatePreview() {
    const d = Number(days.value) || 0;
    const total = mPower.checked
      ? (Number(watts.value) || 0) * ((Number(minutes.value) || 0) / 60) * (Number(uses.value) || 0) * d / 1000
      : Number(kwh.value) || 0;
    preview.textContent = `Estimated: ${fmt.kwh(total)} over ${d} day${d === 1 ? "" : "s"}`;
    fridgeNote.hidden = !(category.value === "fridge" && mPower.checked);
  }

  const form = el("form", { class: "stack", novalidate: true },
    el("div", { class: "fields" },
      field("e-cat", "Appliance type", category),
      field("e-name", "Name", name, "e.g. Kitchen kettle"),
      el("fieldset", { class: "full" },
        el("legend", { text: "How do you want to estimate it?" }),
        el("div", { class: "row" },
          el("label", { class: "check", for: "m-power" }, mPower, "Power × time"),
          el("label", { class: "check", for: "m-kwh" }, mKwh, "I know the kWh"))),
      powerFields,
      kwhField,
      fridgeNote,
      field("e-start", "First day", start),
      field("e-days", "Number of days", days, "A whole week of kettle use = 7"),
      field("e-notes", "Notes (optional)", notes, "Notes are never sent to the AI coach.", "full"),
    ),
    preview,
    error,
    el("div", { class: "form-actions" },
      el("button", { class: "btn primary", type: "submit" }, icon(v ? "check" : "plus"), v ? "Save changes" : "Add appliance use"),
      v ? el("button", { class: "btn", type: "button", onclick: () => { editing = null; render(root).then(refreshIcons); } }, "Cancel") : null,
    ),
  );

  category.addEventListener("change", applyDefaults);
  mPower.addEventListener("change", () => setMethod("power"));
  mKwh.addEventListener("change", () => setMethod("kwh"));
  form.addEventListener("input", updatePreview);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    error.replaceChildren();
    const usePower = mPower.checked;
    const mins = numberOrNull(minutes.value);
    const body = {
      appliance_name: name.value.trim(),
      category: category.value,
      rated_watts: usePower ? numberOrNull(watts.value) : null,
      hours_per_use: usePower && mins !== null ? mins / 60 : null,
      uses_per_day: Number(uses.value) || 1,
      start_date: start.value,
      days_covered: Number(days.value) || 1,
      direct_kwh: usePower ? null : numberOrNull(kwh.value),
      notes: notes.value.trim() || null,
    };
    if (!body.appliance_name) { error.replaceChildren(errorBanner("Give the appliance a name.")); refreshIcons(); return; }
    try {
      if (editing) await api.put(`/electricity/${editing.id}`, body);
      else await api.post("/electricity", body);
      toast(editing ? "Record updated" : "Appliance use added");
      editing = null;
      await render(root);
      refreshIcons();
    } catch (err) {
      error.replaceChildren(errorBanner(err.message));
      refreshIcons();
    }
  });

  if (v) {
    watts.value = v.rated_watts ?? "";
    minutes.value = v.hours_per_use !== null ? +(v.hours_per_use * 60).toFixed(2) : "";
    kwh.value = v.rated_watts === null ? v.estimated_kwh : "";
    setMethod(v.rated_watts === null ? "kwh" : "power");
  } else {
    applyDefaults();
  }

  return el("section", { class: "card", "aria-labelledby": "power-form-title" },
    el("div", { class: "card-head" }, el("h2", { id: "power-form-title" }, icon("zap"), v ? "Edit record" : "Log appliance use")),
    form,
  );
}

async function loadList(root) {
  const box = root.querySelector("#power-list");
  let rows;
  try {
    rows = await api.get("/electricity");
  } catch (err) {
    box.replaceChildren(errorBanner(err.message));
    return;
  }
  if (!rows.length) {
    box.replaceChildren(el("div", { class: "empty" }, icon("zap"),
      el("h2", { text: "No appliance use yet" }),
      el("p", { text: "Start with the appliances you use most: geyser, kettle, stove." })));
    return;
  }
  const shown = showAll ? rows : rows.slice(0, 25);
  box.replaceChildren(el("section", { class: "card" },
    el("div", { class: "card-head" },
      el("h2", { text: "Recorded appliance use" }),
      el("span", { class: "muted small", text: rows.length > shown.length ? `Latest ${shown.length} of ${rows.length}` : `${rows.length} records` })),
    el("div", { class: "table-wrap" }, el("table", {},
      el("thead", {}, el("tr", {},
        el("th", { text: "Period" }), el("th", { text: "Appliance" }),
        el("th", { class: "num", text: "kWh" }), el("th", { class: "hide-sm", text: "Source" }),
        el("th", {}, el("span", { class: "visually-hidden", text: "Actions" })))),
      el("tbody", {}, shown.map((r) => row(root, r))),
    )),
    rows.length > shown.length
      ? el("button", { class: "btn small", type: "button", style: "margin-top:12px",
          onclick: () => { showAll = true; loadList(root).then(refreshIcons); } }, `Show all ${rows.length}`)
      : null,
  ));
}

function row(root, r) {
  const end = new Date(`${r.start_date}T00:00:00`);
  end.setDate(end.getDate() + r.days_covered - 1);
  const period = r.days_covered === 1 ? fmt.date(r.start_date) : `${fmt.date(r.start_date)} – ${fmt.date(isoDate(end))}`;
  const details = r.rated_watts === null
    ? "kWh entered directly"
    : `${fmt.num(r.rated_watts)} W × ${fmt.num(r.hours_per_use * 60)} min × ${r.uses_per_day}/day × ${r.days_covered} d`;
  return el("tr", {},
    el("td", { class: "num", text: period }),
    el("td", {}, r.appliance_name, el("div", { class: "hint num", text: details })),
    el("td", { class: "num", text: fmt.kwhNum(r.estimated_kwh) }),
    el("td", { class: "hide-sm" }, r.is_demo ? badge("demo") : badge("estimate")),
    el("td", { class: "actions" },
      el("button", { class: "btn ghost icon", type: "button", "aria-label": `Edit ${r.appliance_name}`,
        onclick: () => { editing = r; render(root).then(refreshIcons); } }, icon("pencil")),
      el("button", { class: "btn ghost icon danger", type: "button", "aria-label": `Delete ${r.appliance_name}`,
        onclick: async () => {
          if (!window.confirm("Delete this record?")) return;
          try { await api.del(`/electricity/${r.id}`); toast("Record deleted"); if (editing?.id === r.id) editing = null; }
          catch (err) { toast(err.message, "error"); }
          await render(root); refreshIcons();
        } }, icon("trash-2")),
    ),
  );
}