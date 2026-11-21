/**
 * Přepínač světlého / tmavého režimu. Volba se pamatuje v prohlížeči;
 * bez volby platí nastavení systému. Nový režim se odhalí kruhem od přepínače
 * (View Transitions API), jinde se přepne okamžitě.
 */
const root = document.documentElement;
const toggle = document.querySelector("#theme-toggle");
const themeColor = document.querySelector('meta[name="theme-color"]');

function apply(theme) {
  root.dataset.theme = theme;
  toggle.setAttribute("aria-checked", String(theme === "dark"));
  themeColor?.setAttribute("content", theme === "dark" ? "#0a0907" : "#fbf8f1");
}

function save(theme) {
  try {
    localStorage.setItem("serp-theme", theme);
  } catch {
    /* úložiště nemusí být dostupné – nevadí */
  }
}

apply(root.dataset.theme === "dark" ? "dark" : "light");

toggle.addEventListener("click", async () => {
  const next = root.dataset.theme === "dark" ? "light" : "dark";
  save(next);

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!document.startViewTransition || reduceMotion) {
    apply(next);
    return;
  }

  const rect = toggle.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));

  root.classList.add("theme-switching");
  const transition = document.startViewTransition(() => apply(next));
  try {
    await transition.ready;
    root.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: 800, easing: "cubic-bezier(0.16, 1, 0.3, 1)", pseudoElement: "::view-transition-new(root)" },
    );
    await transition.finished;
  } finally {
    root.classList.remove("theme-switching");
  }
});
