/**
 * Rádio v rohu stránky. Hraje až po kliknutí (prohlížeče automatické přehrávání blokují).
 * První stanice se generuje živě ve Web Audio API, ostatní jsou veřejné internetové streamy
 * (posílají CORS hlavičky, takže jdou analyzovat). U každé stanice může být víc adres –
 * při chybě se zkusí další.
 *
 * Zvuk vede přes AnalyserNode: ekvalizér v přehrávači i zlaté částice na pozadí
 * (effects.js přes window.serpMusicLevel) se hýbou podle skutečné hudby.
 */
const STATIONS = [
  { name: "Zlatý ambient", note: "generováno živě v prohlížeči", synth: true },
  {
    name: "ČRo Jazz",
    note: "Český rozhlas",
    urls: ["https://rozhlas.stream/jazz_aac_128.aac", "https://rozhlas.stream/jazz_high.aac"],
  },
  {
    name: "ČRo D-dur",
    note: "Český rozhlas · klasika",
    urls: ["https://rozhlas.stream/ddur_aac_128.aac", "https://rozhlas.stream/ddur_high.aac"],
  },
  {
    name: "Mellow Mix",
    note: "Radio Paradise",
    urls: ["https://stream.radioparadise.com/mellow-128", "https://stream.radioparadise.com/mellow-192"],
  },
  {
    name: "Global Mix",
    note: "Radio Paradise · world",
    urls: ["https://stream.radioparadise.com/global-128"],
  },
];

const root = document.querySelector("#radio");
const playButton = document.querySelector("#radio-play");
const nextButton = document.querySelector("#radio-next");
const stationEl = document.querySelector("#radio-station");
const noteEl = document.querySelector("#radio-note");
const bars = [...root.querySelectorAll(".eq i")];

const audio = new Audio();
audio.preload = "none";
audio.crossOrigin = "anonymous";

let index = loadIndex();
let urlIndex = 0;
let playing = false;
let ambient = null;

// Společný zvukový řetězec: zdroj → analyzátor → reproduktory.
let ctx = null;
let analyser = null;
let streamSource = null;
let spectrum = null;
let suspendTimer = 0;

function ensureAudioGraph() {
  if (ctx) return;
  ctx = new AudioContext();
  analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.78;
  spectrum = new Uint8Array(analyser.frequencyBinCount);
  const volume = ctx.createGain();
  volume.gain.value = 0.8;
  analyser.connect(volume).connect(ctx.destination);
}

/** Hlasitost 0–1 s důrazem na basy – podle ní pulzují částice. */
function musicLevel() {
  if (!playing || !analyser) return 0;
  analyser.getByteFrequencyData(spectrum);
  let bass = 0;
  for (let i = 1; i <= 6; i++) bass += spectrum[i];
  let all = 0;
  for (let i = 0; i < 96; i++) all += spectrum[i];
  return Math.min(1, (bass / 6 / 255) * 0.65 + (all / 96 / 255) * 0.75);
}
window.serpMusicLevel = musicLevel;

// Živý ekvalizér: 4 pásma spektra → výška sloupců.
const BANDS = [
  [1, 4],
  [4, 12],
  [12, 32],
  [32, 80],
];
let eqRunning = false;
function drawEqualizer() {
  if (!playing || !analyser) {
    eqRunning = false;
    return;
  }
  eqRunning = true;
  analyser.getByteFrequencyData(spectrum);
  BANDS.forEach(([from, to], i) => {
    let sum = 0;
    for (let k = from; k < to; k++) sum += spectrum[k];
    const value = sum / (to - from) / 255;
    bars[i].style.height = `${4 + Math.min(1, value * 1.25) * 14}px`;
  });
  requestAnimationFrame(drawEqualizer);
}

function loadIndex() {
  try {
    const saved = Number(localStorage.getItem("serp-radio-station"));
    return Number.isInteger(saved) && saved >= 0 && saved < STATIONS.length ? saved : 0;
  } catch {
    return 0;
  }
}

function saveIndex() {
  try {
    localStorage.setItem("serp-radio-station", String(index));
  } catch {
    /* úložiště nemusí být dostupné – nevadí */
  }
}

function setState(state, note = STATIONS[index].note) {
  root.dataset.state = state;
  stationEl.textContent = STATIONS[index].name;
  noteEl.textContent = note;
  const active = state === "playing" || state === "loading";
  playButton.setAttribute("aria-pressed", String(active));
  playButton.setAttribute("aria-label", active ? "Pozastavit rádio" : "Pustit rádio");
  // Pro effects.js: hraje-li hudba, částice se zvětší.
  document.documentElement.dataset.music = state === "playing" ? "on" : "off";
  if (state === "playing" && !eqRunning) requestAnimationFrame(drawEqualizer);
  else bars.forEach((bar) => (bar.style.height = ""));
}

async function play() {
  ensureAudioGraph(); // musí proběhnout přímo v obsluze kliknutí
  clearTimeout(suspendTimer);
  const station = STATIONS[index];
  playing = true;
  await ctx.resume();
  if (station.synth) {
    ambient ??= createAmbient(ctx, analyser);
    ambient.start();
    setState("playing");
    return;
  }
  streamSource ??= ctx.createMediaElementSource(audio);
  streamSource.connect(analyser);
  setState("loading", "ladím stanici…");
  urlIndex = 0;
  await tryUrl();
}

async function tryUrl() {
  const station = STATIONS[index];
  audio.src = station.urls[urlIndex];
  try {
    await audio.play();
  } catch (err) {
    // Chybu zdroje řeší událost „error“ (zkusí další adresu); tady jen zákaz přehrávání.
    if (err instanceof DOMException && err.name === "NotAllowedError") {
      playing = false;
      setState("paused", "klikněte pro spuštění");
    }
  }
}

function onStreamError() {
  const station = STATIONS[index];
  if (!playing || !station.urls) return;
  if (urlIndex < station.urls.length - 1) {
    urlIndex += 1;
    tryUrl();
    return;
  }
  playing = false;
  setState("error", "stanice teď nehraje – zkuste další");
}

function stop() {
  playing = false;
  audio.pause();
  audio.removeAttribute("src");
  audio.load();
  ambient?.stop();
  setState("paused");
  if (ctx) suspendTimer = setTimeout(() => !playing && ctx.suspend(), 2000);
}

audio.addEventListener("playing", () => playing && setState("playing"));
audio.addEventListener("waiting", () => playing && setState("loading", "načítám…"));
audio.addEventListener("error", () => {
  if (audio.getAttribute("src")) onStreamError();
});

playButton.addEventListener("click", () => (playing ? stop() : play()));
nextButton.addEventListener("click", () => {
  const wasPlaying = playing || root.dataset.state === "error";
  stop();
  index = (index + 1) % STATIONS.length;
  saveIndex();
  setState("paused");
  if (wasPlaying) play();
});

setState("paused");

/**
 * Generativní ambient: pomalé akordy (Cmaj9 – Am9 – Fmaj9 – G6/9) ze sinusových
 * a trojúhelníkových oscilátorů, filtr, umělý dozvuk a náhodné „zlaté“ zvonky.
 */
function createAmbient(ctx, output) {
  const CHORDS = [
    [48, 52, 55, 59, 62],
    [45, 48, 52, 55, 59],
    [41, 45, 48, 52, 55],
    [43, 47, 50, 52, 57],
  ];
  const BELLS = [72, 74, 76, 79, 81, 84, 86];
  const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

  const master = ctx.createGain();
  master.gain.value = 0;
  const bus = ctx.createGain();
  const reverb = ctx.createConvolver();
  reverb.buffer = impulse(4);
  const wet = ctx.createGain();
  wet.gain.value = 0.6;
  const dry = ctx.createGain();
  dry.gain.value = 0.55;
  const compressor = ctx.createDynamicsCompressor();
  bus.connect(dry).connect(master);
  bus.connect(reverb).connect(wet).connect(master);
  master.connect(compressor).connect(output);

  let chordTimer;
  let bellTimer;
  let step = 0;
  let active = false;

  function impulse(seconds) {
    const length = Math.round(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 2.8;
    }
    return buffer;
  }

  function pad(chord, t, duration) {
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.value = 0.5;
    filter.frequency.setValueAtTime(650, t);
    filter.frequency.linearRampToValueAtTime(1500, t + duration / 2);
    filter.frequency.linearRampToValueAtTime(750, t + duration);

    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0, t);
    envelope.gain.linearRampToValueAtTime(0.03, t + 2.5);
    envelope.gain.setValueAtTime(0.03, t + duration - 1);
    envelope.gain.linearRampToValueAtTime(0, t + duration + 3);
    filter.connect(envelope).connect(bus);

    for (const note of chord) {
      for (const [type, detune] of [["sine", 0], ["triangle", -7], ["sine", 6]]) {
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.value = hz(note);
        osc.detune.value = detune;
        osc.connect(filter);
        osc.start(t);
        osc.stop(t + duration + 3.2);
      }
    }
  }

  function bell(t) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = hz(BELLS[Math.floor(Math.random() * BELLS.length)]);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.03, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
    osc.connect(gain).connect(bus);
    osc.start(t);
    osc.stop(t + 3.3);
  }

  function nextChord() {
    pad(CHORDS[step % CHORDS.length], ctx.currentTime + 0.05, 8);
    step += 1;
  }

  function scheduleBell() {
    bellTimer = setTimeout(() => {
      if (!active) return;
      bell(ctx.currentTime + 0.05);
      scheduleBell();
    }, 1400 + Math.random() * 3600);
  }

  return {
    start() {
      active = true;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(1, ctx.currentTime, 0.8);
      nextChord();
      chordTimer = setInterval(nextChord, 8000);
      scheduleBell();
    },
    stop() {
      active = false;
      clearInterval(chordTimer);
      clearTimeout(bellTimer);
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(0, ctx.currentTime, 0.35);
    },
  };
}
