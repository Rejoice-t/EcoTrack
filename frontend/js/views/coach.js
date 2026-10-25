import { api } from "../api.js";
import { badge, el, errorBanner, icon, pageHead, refreshIcons } from "../utils.js";

const SUGGESTIONS = [
  "Which activity contributes most to my estimated water usage?",
  "How can I reduce my electricity consumption?",
  "What changes could help me meet my monthly water goal?",
  "Which appliance appears to use the most electricity?",
  "Suggest three practical changes for my household.",
  "Explain my consumption data in simple language.",
];

const history = [];   // answers stay on this page only, newest first

export async function render(root) {
  const question = el("textarea", { id: "coach-q", maxlength: "500", required: true, rows: "3",
    placeholder: "Ask about your recorded water or electricity use" });
  const period = el("select", { id: "coach-period" },
    el("option", { value: "month", text: "Last 30 days" }), el("option", { value: "week", text: "Last 7 days" }));
  const submit = el("button", { class: "btn primary", type: "submit" }, icon("send"), "Ask the coach");
  const status = el("p", { class: "hint", "aria-live": "polite" });
  const answers = el("div", { class: "stack", id: "answers" });

  const form = el("form", { class: "stack", novalidate: true },
    el("div", { class: "field" }, el("label", { for: "coach-q", text: "Your question" }), question),
    el("div", { class: "chips", "aria-label": "Example questions" },
      SUGGESTIONS.map((s) => el("button", { type: "button", class: "chip", text: s, onclick: () => { question.value = s; question.focus(); } }))),
    el("div", { class: "row" },
      el("div", { class: "field", style: "min-width:180px" }, el("label", { for: "coach-period", text: "Based on" }), period)),
    el("div", { class: "form-actions" }, submit),
    status,
  );

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = question.value.trim();
    if (q.length < 3) { status.textContent = "Type a question first."; return; }
    submit.disabled = true;
    status.textContent = "Looking at your recorded data…";
    try {
      const res = await api.post("/coach", { question: q, period: period.value });
      history.unshift({ q, res });
      status.textContent = "";
      question.value = "";
    } catch (err) {
      history.unshift({ q, error: err.message });
      status.textContent = "";
    }
    submit.disabled = false;
    drawAnswers(answers);
  });

  root.replaceChildren(
    pageHead("Resource coach", "Practical advice based on your recorded data. The coach only sees totals and rankings, never your notes."),
    el("div", { class: "split" },
      el("section", { class: "card" }, form),
      answers),
  );
  drawAnswers(answers);
}

function drawAnswers(box) {
  if (!history.length) {
    box.replaceChildren(el("div", { class: "empty" }, icon("message-circle"),
      el("h2", { text: "Ask a question to get started" }),
      el("p", { text: "Try one of the example questions. Advice is based on estimates, so treat it as a starting point." })));
    refreshIcons();
    return;
  }
  box.replaceChildren(...history.map(answerCard));
  refreshIcons();
}

function answerCard({ q, res, error }) {
  if (error) {
    return el("section", { class: "card" }, el("p", { class: "question-echo", text: q }), errorBanner(error));
  }
  const sourceBadge = res.source === "ai" ? badge("ai") : badge("fallback");
  return el("section", { class: "card" },
    el("div", { class: "card-head" }, el("p", { class: "question-echo", text: q }), sourceBadge),
    el("div", { class: "answer stack" },
      el("p", { text: res.summary }),   // textContent only: AI text can never run as code
      el("div", {}, res.recommendations.map((r) =>
        el("div", { class: "rec" },
          el("h3", { text: r.title }),
          el("p", { class: "muted", text: r.why }),
          el("div", { class: "row", style: "margin-top:6px" },
            badge(r.resource === "both" ? "estimate" : r.resource, r.resource === "both" ? "Water and electricity" : undefined),
            el("span", { class: "badge", text: `Effort: ${r.effort}` })),
        ))),
      el("p", { class: "hint" }, icon("info"), " ", res.data_note),
      res.source === "fallback" && res.fallback_reason
        ? el("p", { class: "hint", text: `Built-in tips were used. Reason: ${res.fallback_reason}.` }) : null,
    ),
  );
}