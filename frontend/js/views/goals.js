import { api } from "../api.js";
import {
  badge, el, errorBanner, field, fmt, icon, isoDate, pageHead, refreshIcons, toast,
} from "../utils.js";
import { goalRow } from "./dashboard.js";

let editing = null;

export async function render(root) {
  let goals;
  try {
    goals = await api.get("/goals");
  } catch (err) {
    root.replaceChildren(pageHead("Goals"), errorBanner(err.message));
    return;
  }
  root.replaceChildren(
    pageHead("Goals", "Set a budget for a period and track progress from your recorded activities."),
    el("div", { class: "split" }, formCard(root), listCard(root, goals)),
  );
}

function formCard(root) {
  const v = editing;
  const now = new Date();
  const monthStart = isoDate(new Date(now.getFullYear(), now.getMonth(), 1));
  const monthEnd = isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  const resource = el("select", {},
    el("option", { value: "water", text: "Water (litres)", selected: v?.resource === "water" }),
    el("option", { value: "electricity", text: "Electricity (kWh)", selected: v?.resource === "electricity" }));
  const title = el("input", { type: "text", maxlength: "80", value: v?.title ?? "Monthly water budget" });
  const target = el("input", { type: "number", min: "1", step: "any", value: v?.target_value ?? "", inputmode: "decimal" });
  const start = el("input", { type: "date", value: v?.period_start ?? monthStart });
  const end = el("input", { type: "date", value: v?.period_end ?? monthEnd });
  const error = el("div", { class: "form-error", role: "alert" });

  resource.addEventListener("change", () => {
    if (!v) title.value = resource.value === "water" ? "Monthly water budget" : "Monthly electricity budget";
  });

  const form = el("form", { class: "stack", novalidate: true },
    el("div", { class: "fields" },
      field("g-res", "Resource", resource, null, "full"),
      field("g-title", "Goal name", title, null, "full"),
      field("g-target", "Budget for the period", target, "In litres for water, kWh for electricity. Tip: look at your last 30 days in Analytics, then aim a little lower.", "full"),
      field("g-start", "Start", start),
      field("g-end", "End", end),
    ),
    error,
    el("div", { class: "form-actions" },
      el("button", { class: "btn primary", type: "submit" }, icon(v ? "check" : "plus"), v ? "Save goal" : "Add goal"),
      v ? el("button", { class: "btn", type: "button", onclick: () => { editing = null; render(root).then(refreshIcons); } }, "Cancel") : null),
  );

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = { resource: resource.value, title: title.value.trim(), target_value: Number(target.value),
      period_start: start.value, period_end: end.value };
    try {
      if (editing) await api.put(`/goals/${editing.id}`, body);
      else await api.post("/goals", body);
      toast(editing ? "Goal updated" : "Goal added");
      editing = null;
      await render(root);
      refreshIcons();
    } catch (err) {
      error.replaceChildren(errorBanner(err.message));
      refreshIcons();
    }
  });

  return el("section", { class: "card" },
    el("div", { class: "card-head" }, el("h2", {}, icon("target"), v ? "Edit goal" : "New budget goal")), form);
}

function listCard(root, goals) {
  if (!goals.length) {
    return el("div", { class: "empty" }, icon("target"),
      el("h2", { text: "No goals yet" }),
      el("p", { text: "A budget goal shows how much of your monthly allowance you have used so far." }));
  }
  return el("section", { class: "card" },
    el("div", { class: "card-head" }, el("h2", { text: "Your goals" })),
    el("p", { class: "muted small", style: "margin-bottom:12px", text: "Progress is calculated from recorded activities only. It is not a prediction." }),
    el("ol", { class: "ranked" }, goals.map((g) => {
      const item = goalRow(g);
      item.append(el("div", { class: "row", style: "grid-column:1/-1" },
        el("span", { class: "hint", text: `${fmt.date(g.period_start)} to ${fmt.date(g.period_end)}` }),
        g.is_demo ? badge("demo") : null,
        el("button", { class: "btn small", type: "button", onclick: () => { editing = g; render(root).then(refreshIcons); } }, icon("pencil"), "Edit"),
        el("button", { class: "btn small danger", type: "button", onclick: async () => {
          if (!window.confirm("Remove this goal?")) return;
          try { await api.del(`/goals/${g.id}`); toast("Goal removed"); } catch (err) { toast(err.message, "error"); }
          await render(root); refreshIcons();
        } }, icon("trash-2"), "Remove")));
      return item;
    })),
  );
}