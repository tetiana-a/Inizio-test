/**
 * Živé pozadí: zlaté vlnící se stuhy a drobný zlatý prach (Canvas 2D).
 * Když hraje rádio, částice se plynule zvětší a pulzují podle hudby
 * (úroveň z window.serpMusicLevel, viz radio.js).
 * Respektuje prefers-reduced-motion a zastaví se, když je karta na pozadí.
 */
const canvas = document.querySelector("#gold-canvas");
const glow = document.querySelector(".cursor-glow");
const root = document.documentElement;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

if (canvas && !reduceMotion.matches) {
  const ctx = canvas.getContext("2d");
  let width = 0;
  let height = 0;
  let frame = 0;
  let boost = 1;
  let music = 0; // 0 = ticho, 1 = hraje (plynulý přechod)
  let level = 0; // okamžitá hlasitost 0–1

  // Stuhy: svazek tenkých sinusových vláken, jako na hlavním obrázku.
  const ribbons = [
    { y: 0.86, amp: 46, freq: 0.0021, speed: 0.00022, strands: 18, spread: 2.4, alpha: 0.16, phase: 0 },
    { y: 0.9, amp: 34, freq: 0.0016, speed: -0.00017, strands: 14, spread: 3, alpha: 0.12, phase: 2.1 },
    { y: 0.34, amp: 28, freq: 0.0013, speed: 0.00012, strands: 12, spread: 2.2, alpha: 0.08, phase: 4.2 },
  ];

  // Zlatá paleta pro světlý a tmavý režim: [jádro, záře].
  const GOLD = {
    light: ["176,124,28", "212,165,64"],
    dark: ["255,226,150", "214,163,62"],
  };

  let particles = [];

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    width = innerWidth;
    height = innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.round(Math.min(110, (width * height) / 15000));
    particles = Array.from({ length: count }, () => spawn(true));
  }

  function spawn(anywhere = false) {
    return {
      x: Math.random() * width,
      y: anywhere ? Math.random() * height : height + 10,
      r: 0.35 + Math.random() ** 2 * 1.1, // většinou drobné, jen pár větších
      vy: 0.06 + Math.random() * 0.22,
      vx: (Math.random() - 0.5) * 0.1,
      twinkle: 0.0015 + Math.random() * 0.003,
      phase: Math.random() * Math.PI * 2,
      react: 0.5 + Math.random(), // jak silně částice reaguje na hudbu
    };
  }

  function gradientFor(alpha) {
    const g = ctx.createLinearGradient(0, 0, width, 0);
    g.addColorStop(0, `rgba(185,139,46,0)`);
    g.addColorStop(0.2, `rgba(185,139,46,${alpha})`);
    g.addColorStop(0.5, `rgba(240,214,143,${alpha * 1.4})`);
    g.addColorStop(0.8, `rgba(185,139,46,${alpha})`);
    g.addColorStop(1, `rgba(185,139,46,0)`);
    return g;
  }

  function drawRibbon(ribbon, t) {
    const base = ribbon.y * height;
    const amp = ribbon.amp * (1 + music * (0.12 + level * 0.45));
    ctx.lineWidth = 0.7;
    ctx.strokeStyle = gradientFor(ribbon.alpha * boost * (1 + music * 0.35));
    for (let s = 0; s < ribbon.strands; s++) {
      const offset = s - ribbon.strands / 2;
      ctx.beginPath();
      for (let x = -20; x <= width + 20; x += 14) {
        const twist = Math.sin(x * 0.0011 + t * 0.00009 + ribbon.phase);
        const y =
          base +
          Math.sin(x * ribbon.freq + t * ribbon.speed + ribbon.phase + s * 0.05) * amp +
          offset * ribbon.spread * twist * 4;
        if (x === -20) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  function drawParticles(t, palette) {
    const [core, halo] = palette;
    const speed = 1 + music * (0.6 + level * 1.4);
    for (const p of particles) {
      p.y -= p.vy * speed;
      p.x += p.vx + Math.sin(t * 0.0004 + p.phase) * 0.08;
      if (p.y < -12) Object.assign(p, spawn());

      const shimmer = 0.5 + 0.5 * Math.sin(t * p.twinkle + p.phase);
      const a = Math.min(1, (0.45 + 0.5 * shimmer) * Math.min(boost, 1.4) * (1 + music * 0.3));
      const scale = 1 + music * (0.9 + level * 2.6 * p.react);
      const r = p.r * scale;

      // jemná zlatá záře
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3.2);
      g.addColorStop(0, `rgba(${halo},${a * 0.55})`);
      g.addColorStop(1, `rgba(${halo},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 3.2, 0, Math.PI * 2);
      ctx.fill();

      // ostré zlaté jádro
      ctx.fillStyle = `rgba(${core},${a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function draw(t) {
    const dark = root.dataset.theme === "dark";
    // V tmavém režimu zlato víc září: silnější stuhy a aditivní míchání světla.
    boost = dark ? 1.9 : 1;
    ctx.globalCompositeOperation = dark ? "lighter" : "source-over";

    const on = root.dataset.music === "on";
    music += ((on ? 1 : 0) - music) * 0.03;
    const raw = on && typeof window.serpMusicLevel === "function" ? window.serpMusicLevel() : 0;
    level += (raw - level) * (raw > level ? 0.35 : 0.08); // rychlý náběh, pomalý dozvuk

    ctx.clearRect(0, 0, width, height);
    for (const ribbon of ribbons) drawRibbon(ribbon, t);
    drawParticles(t, dark ? GOLD.dark : GOLD.light);
    frame = requestAnimationFrame(draw);
  }

  resize();
  addEventListener("resize", resize);
  frame = requestAnimationFrame(draw);

  document.addEventListener("visibilitychange", () => {
    cancelAnimationFrame(frame);
    if (!document.hidden) frame = requestAnimationFrame(draw);
  });
}

// Jemná zlatá záře za kurzorem (jen pro myš).
if (glow && !reduceMotion.matches && matchMedia("(pointer: fine)").matches) {
  addEventListener(
    "pointermove",
    (event) => {
      glow.style.setProperty("--px", `${event.clientX}px`);
      glow.style.setProperty("--py", `${event.clientY}px`);
    },
    { passive: true },
  );
}
