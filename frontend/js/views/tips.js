import { api } from "../api.js";
import { el, errorBanner, fmt, icon, pageHead, refreshIcons, segmented } from "../utils.js";

let filter = "all";

export async function render(root) {
  let tips;
  try {
    tips = await api.get(filter === "all" ? "/tips" : `/tips?resource=${filter}`);
  } catch (err) {
    root.replaceChildren(pageHead("Tips"), errorBanner(err.message));
    return;
  }
  root.replaceChildren(
    pageHead("Tips and learning", "Low-cost habits that reduce water and electricity use.",
      segmented([["all", "All"], ["water", "Water"], ["electricity", "Electricity"]], filter,
        (v) => { filter = v; render(root).then(refreshIcons); }, "Filter tips")),
    el("div", { class: "tip-list" }, tips.map((t) =>
      el("article", { class: "card tip" },
        el("h3", {}, icon(t.resource === "water" ? "droplet" : "zap", t.resource === "water" ? "water" : "power"), t.title),
        el("p", { text: t.explanation }),
        el("dl", {},
          el("dt", { text: "Resource" }), el("dd", { text: fmt.label(t.resource) }),
          el("dt", { text: "Difficulty" }), el("dd", { text: fmt.label(t.difficulty) }),
          el("dt", { text: "Benefit" }), el("dd", { text: t.benefit })),
      ))),
    el("p", { class: "hint", style: "margin-top:16px",
      text: "Benefits are described in general terms. Your actual savings depend on your household. For geyser, wiring or plumbing work, use a qualified professional." }),
  );
}