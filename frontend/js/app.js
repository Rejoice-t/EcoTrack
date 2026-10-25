// Single-page app: one HTML file, views switched by the URL hash (#/water, #/coach ...).
import { refreshIcons } from "./utils.js";

const routes = {
  dashboard: () => import("./views/dashboard.js"),
  water: () => import("./views/water.js"),
  electricity: () => import("./views/electricity.js"),
  analytics: () => import("./views/analytics.js"),
  coach: () => import("./views/coach.js"),
  goals: () => import("./views/goals.js"),
  tips: () => import("./views/tips.js"),
  settings: () => import("./views/settings.js"),
};

const titles = {
  dashboard: "Your household", water: "Track water", electricity: "Track electricity",
  analytics: "Analytics", coach: "Resource coach", goals: "Goals", tips: "Tips", settings: "Settings",
};

const view = document.getElementById("view");
const nav = document.getElementById("nav");
const menuToggle = document.querySelector(".menu-toggle");
let renderId = 0;

async function render() {
  const name = location.hash.replace(/^#\/?/, "").split("?")[0] || "dashboard";
  const route = routes[name] ? name : "dashboard";
  const id = ++renderId;

  for (const link of nav.querySelectorAll("a")) {
    const active = link.dataset.route === route;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  document.title = `${titles[route]} | EcoTrack`;
  nav.classList.remove("open");
  menuToggle.setAttribute("aria-expanded", "false");

  view.replaceChildren();
  const module = await routes[route]();
  if (id !== renderId) return;          // user already navigated elsewhere
  await module.render(view);
  refreshIcons();
  view.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

menuToggle.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  menuToggle.setAttribute("aria-expanded", String(open));
  menuToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
});

window.addEventListener("hashchange", render);
refreshIcons();
render();