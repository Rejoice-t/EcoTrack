import { api } from "../api.js";
import {
  badge, el, errorBanner, field, fmt, icon, isoDateTimeLocal, numberOrNull, pageHead, refreshIcons, toast,
} from "../utils.js";

// Illustrative starting values only. Users should replace them with their own.
const DEFAULTS = {
  shower: { method: "flow", flow: 9, duration: 8 },
  bath: { method: "litres", litres: 100 },
  dishes: { method: "flow", flow: 6, duration: 5 },
  laundry: { method: "litres", litres: 70 },
  cleaning: { method: "litres", litres: 10 },
  handwashing: { method: "flow", flow: 6, duration: 0.5 },
  gardening: { method: "flow", flow: 12, duration: 15 },
  other: { method: "litres", litres: 10 },
};

let editing = null;    // the record being edited, or null
let showAll = false;  // show every record instead of the latest 25

export async function render(root) {
  root.replaceChildren(
    pageHead("Track water", "Log water activities. EcoTrack estimates the litres from what you enter."),
    el("div", { class: "split" }, formCard(root), el("div", { id: "water-list" })),
  );
  await loadList(root);
}

function formCard(root) {
  const v = editing;
  const type = el("select", { name: "activity_type", required: true },
    Object.keys(DEFAULTS).map((t) => el("option", { value: t, text: fmt.label(t), selected: v?.activity_type === t })));

  const methodFlow = el("input", { type: "radio", name: "method", value: "flow", id: "m-flow" });
  const methodLitres = el("input", { type: "radio", name: "method", value: "litres", id: "m-litres" });

  const duration = el("input", { type: "number", name: "duration_min", min: "0", max: "1440", step: "any", inputmode: "decimal" });
  const flow = el("input", { type: "number", name: "flow_rate_lpm", min: "0", max: "100", step: "any", inputmode: "decimal" });
  const litres = el("input", { type: "number", name: "direct_litres", min: "0", max: "100000", step: "any", inputmode: "decimal" });
  const occurrences = el("input", { type: "number", name: "occurrences", min: "1", max: "100", step: "1", value: v?.occurrences ?? 1, required: true });
  const when = el("input", { type: "datetime-local", name: "occurred_at", required: true,
    value: v ? v.occurred_at.slice(0, 16) : isoDateTimeLocal() });
  const notes = el("input", { type: "text", name: "notes", maxlength: "200", value: v?.notes ?? "" });

  const flowFields = el("div", { class: "fields full" },
    field("w-duration", "Duration (minutes)", duration),
    field("w-flow", "Flow rate (litres per minute)", flow,
      "Illustrative default. To measure yours, time how long it takes to fill a 10 L bucket."),
  );
  const litresField = field("w-litres", "Litres each time", litres, "For example a 10 L bucket, or the litres on your washing machine's label.", "full");
  const preview = el("p", { class: "estimate-preview num", "aria-live": "polite" });
  const error = el("div", { class: "form-error", role: "alert" });

  function setMethod(method) {
    methodFlow.checked = method === "flow";
    methodLitres.checked = method === "litres";
    flowFields.hidden = method !== "flow";
    litresField.hidden = method !== "litres";
    updatePreview();
  }

  function applyDefaults() {
    const d = DEFAULTS[type.value];
    duration.value = d.duration ?? "";
    flow.value = d.flow ?? "";
    litres.value = d.litres ?? "";
    setMethod(d.method);
  }

  function updatePreview() {
    const n = Number(occurrences.value) || 0;
    const total = methodFlow.checked
      ? (Number(duration.value) || 0) * (Number(flow.value) || 0) * n
      : (Number(litres.value) || 0) * n;
    preview.textContent = `Estimated: ${fmt.litres(total)}`;
  }

  const form = el("form", { class: "stack", novalidate: true },
    el("div", { class: "fields" },
      field("w-type", "Activity", type, null, "full"),
      el("fieldset", { class: "full" },
        el("legend", { text: "How do you want to estimate it?" }),
        el("div", { class: "row" },
          el("label", { class: "check", for: "m-flow" }, methodFlow, "Time × flow rate"),
          el("label", { class: "check", for: "m-litres" }, methodLitres, "I know the litres"))),
      flowFields,
      litresField,
      field("w-occ", "Number of times", occurrences, "e.g. 3 showers"),
      field("w-when", "Date and time", when),
      field("w-notes", "Notes (optional)", notes, "Notes stay on this device and are never sent to the AI coach.", "full"),
    ),
    preview,
    error,
    el("div", { class: "form-actions" },
      el("button", { class: "btn primary", type: "submit" }, icon(v ? "check" : "plus"), v ? "Save changes" : "Add activity"),
      v ? el("button", { class: "btn", type: "button", onclick: () => { editing = null; render(root).then(refreshIcons); } }, "Cancel") : null,
    ),
  );

  type.addEventListener("change", applyDefaults);
  methodFlow.addEventListener("change", () => setMethod("flow"));
  methodLitres.addEventListener("change", () => setMethod("litres"));
  form.addEventListener("input", updatePreview);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    error.replaceChildren();
    if (!when.value) { error.replaceChildren(errorBanner("Choose a date and time.")); return; }
    const useFlow = methodFlow.checked;
    const body = {
      activity_type: type.value,
      occurred_at: `${when.value}:00`,
      occurrences: Number(occurrences.value),
      duration_min: useFlow ? numberOrNull(duration.value) : null,
      flow_rate_lpm: useFlow ? numberOrNull(flow.value) : null,
      direct_litres: useFlow ? null : numberOrNull(litres.value),
      notes: notes.value.trim() || null,
    };
    try {
      if (editing) await api.put(`/water/${editing.id}`, body);
      else await api.post("/water", body);
      toast(editing ? "Activity updated" : "Activity added");
      editing = null;
      await render(root);
      refreshIcons();
    } catch (err) {
      error.replaceChildren(errorBanner(err.message));
      refreshIcons();
    }
  });

  // Fill the form
  if (v) {
    duration.value = v.duration_min ?? "";
    flow.value = v.flow_rate_lpm ?? "";
    litres.value = v.direct_litres ?? "";
    setMethod(v.direct_litres !== null ? "litres" : "flow");
  } else {
    applyDefaults();
  }

  return el("section", { class: "card", "aria-labelledby": "water-form-title" },
    el("div", { class: "card-head" }, el("h2", { id: "water-form-title" }, icon("droplet"), v ? "Edit activity" : "Log a water activity")),
    form,
  );
}

async function loadList(root) {
  const box = root.querySelector("#water-list");
  let rows;
  try {
    rows = await api.get("/water");
  } catch (err) {
    box.replaceChildren(errorBanner(err.message));
    return;
  }

  if (!rows.length) {
    box.replaceChildren(el("div", { class: "empty" }, icon("droplet"),
      el("h2", { text: "No water activities yet" }),
      el("p", { text: "Add your first activity with the form." })));
    return;
  }

  const shown = showAll ? rows : rows.slice(0, 25);
  box.replaceChildren(el("section", { class: "card" },
    el("div", { class: "card-head" },
      el("h2", { text: "Recorded activities" }),
      el("span", { class: "muted small", text: rows.length > shown.length ? `Latest ${shown.length} of ${rows.length}` : `${rows.length} records` })),
    el("div", { class: "table-wrap" }, el("table", {},
      el("thead", {}, el("tr", {},
        el("th", { text: "When" }), el("th", { text: "Activity" }),
        el("th", { class: "num", text: "Litres" }), el("th", { class: "hide-sm", text: "Source" }),
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
  const details = r.direct_litres !== null
    ? `${fmt.num(r.direct_litres)} L × ${r.occurrences}`
    : `${fmt.num(r.duration_min)} min × ${fmt.num(r.flow_rate_lpm)} L/min × ${r.occurrences}`;
  return el("tr", {},
    el("td", { class: "num", text: fmt.dateTime(r.occurred_at) }),
    el("td", {}, fmt.label(r.activity_type), el("div", { class: "hint num", text: details })),
    el("td", { class: "num", text: fmt.litresNum(r.estimated_litres) }),
    el("td", { class: "hide-sm" }, r.is_demo ? badge("demo") : badge("estimate")),
    el("td", { class: "actions" },
      el("button", { class: "btn ghost icon", type: "button", "aria-label": `Edit ${r.activity_type} on ${fmt.dateTime(r.occurred_at)}`,
        onclick: () => { editing = r; render(root).then(refreshIcons); } }, icon("pencil")),
      el("button", { class: "btn ghost icon danger", type: "button", "aria-label": `Delete ${r.activity_type} on ${fmt.dateTime(r.occurred_at)}`,
        onclick: async () => {
          if (!window.confirm("Delete this activity?")) return;
          try { await api.del(`/water/${r.id}`); toast("Activity deleted"); if (editing?.id === r.id) editing = null; }
          catch (err) { toast(err.message, "error"); }
          await render(root); refreshIcons();
        } }, icon("trash-2")),
    ),
  );
}