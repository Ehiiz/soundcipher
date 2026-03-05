/*
  Whisper — audio.js
  Sound synthesis (Web Audio API) + playback controls
  MIT License © 2025 thedigitalauteur
*/

const SR = 44100;
const DUR = 12;

let audioCtx = null;
let previewSrc = null,
  previewingId = null;
let rxBuffer = null,
  rxSrc = null,
  rxPlaying = false;
let rxStartTime = 0,
  rxOffset = 0,
  rxRaf = null;
let customAudioBuffer = null,
  customAudioName = "";

function getCtx() {
  if (!audioCtx)
    audioCtx = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: SR,
    });
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

// ── Pink noise generator ──
function makePink() {
  let b0 = 0,
    b1 = 0,
    b2 = 0,
    b3 = 0,
    b4 = 0,
    b5 = 0,
    b6 = 0;
  return function () {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    const p = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
    return p;
  };
}

// ── Main synthesis function ──
function synthesise(type, sr, dur) {
  const N = Math.floor(sr * dur);
  const d = new Float32Array(N);
  const TAU = 2 * Math.PI;

  if (type === "rain") {
    const pink = makePink();
    const drops = [];
    for (let k = 0; k < dur * 40; k++)
      drops.push({
        t: Math.random() * dur,
        f: 800 + Math.random() * 2200,
        amp: 0.04 + Math.random() * 0.08,
      });
    for (let i = 0; i < N; i++) {
      const t = i / sr;
      const mist = pink() * 0.55;
      const sizzle = (Math.random() * 2 - 1) * 0.054;
      let dropsV = 0;
      for (const dr of drops) {
        const dt = t - dr.t;
        if (dt >= 0 && dt < 0.045)
          dropsV += Math.sin(TAU * dr.f * dt) * Math.exp(-dt * 120) * dr.amp;
      }
      const tSlot = t % 5.2,
        thunder =
          Math.sin(t * 18) *
          Math.sin(t * 22) *
          Math.exp(-tSlot * 0.7) *
          (tSlot < 3 ? 0.12 : 0);
      d[i] = Math.max(-1, Math.min(1, mist + sizzle + dropsV + thunder));
    }
  } else if (type === "forest") {
    const pink = makePink();
    const birds = [
      { t: 0.4, f0: 3400, f1: 4200, dur: 0.12, a: 0.18 },
      { t: 1.1, f0: 2800, f1: 2800, dur: 0.08, a: 0.12 },
      { t: 1.8, f0: 4100, f1: 3200, dur: 0.15, a: 0.2 },
      { t: 2.5, f0: 3600, f1: 4500, dur: 0.1, a: 0.15 },
      { t: 3.3, f0: 2200, f1: 2600, dur: 0.2, a: 0.14 },
      { t: 4.0, f0: 5000, f1: 4000, dur: 0.09, a: 0.16 },
      { t: 4.8, f0: 3400, f1: 4200, dur: 0.12, a: 0.18 },
      { t: 5.6, f0: 2800, f1: 3400, dur: 0.16, a: 0.13 },
      { t: 6.5, f0: 4500, f1: 5200, dur: 0.08, a: 0.17 },
      { t: 7.2, f0: 3100, f1: 2600, dur: 0.14, a: 0.19 },
      { t: 8.1, f0: 2200, f1: 2200, dur: 0.25, a: 0.11 },
      { t: 8.9, f0: 4000, f1: 4800, dur: 0.11, a: 0.15 },
      { t: 9.7, f0: 3400, f1: 4200, dur: 0.12, a: 0.18 },
      { t: 10.5, f0: 2900, f1: 3700, dur: 0.13, a: 0.16 },
      { t: 11.3, f0: 4100, f1: 3500, dur: 0.1, a: 0.14 },
    ];
    for (let i = 0; i < N; i++) {
      const t = i / sr;
      const wind =
        pink() *
        (0.22 +
          0.14 * Math.sin(TAU * 0.07 * t) +
          0.08 * Math.sin(TAU * 0.19 * t));
      const stream =
        (Math.random() * 2 - 1) * 0.06 * (0.7 + 0.3 * Math.sin(TAU * 0.04 * t));
      let birdV = 0;
      for (const b of birds) {
        const dt = t - b.t;
        if (dt >= 0 && dt < b.dur) {
          const prog = dt / b.dur,
            freq = b.f0 + (b.f1 - b.f0) * prog;
          birdV +=
            Math.sin(TAU * freq * t) *
            Math.exp(-dt * 18) *
            b.a *
            (1 - prog * 0.3);
        }
      }
      d[i] = Math.max(-1, Math.min(1, wind + stream + birdV));
    }
  } else if (type === "ocean") {
    const pink = makePink();
    for (let i = 0; i < N; i++) {
      const t = i / sr,
        wp = 4.2,
        wph = (t % wp) / wp;
      const waveEnv = Math.pow(Math.sin(Math.PI * wph), 2.5) * 0.6 + 0.1;
      const noise = pink() * waveEnv * 0.7;
      const foam =
        (Math.random() * 2 - 1) *
        0.25 *
        (wph > 0.45 && wph < 0.65
          ? Math.exp(-(wph - 0.5) * 20 + 10 * Math.abs(wph - 0.5))
          : 0);
      const gt = (t % 7.8) - 2.5;
      const gull =
        gt > 0 && gt < 0.6
          ? Math.sin(TAU * (1400 + 200 * Math.sin(TAU * 6 * gt)) * t) *
            Math.exp(-gt * 6) *
            0.06
          : 0;
      d[i] = Math.max(-1, Math.min(1, noise + foam + gull));
    }
  } else if (type === "fire") {
    const pink = makePink();
    const pops = [];
    for (let k = 0; k < dur * 25; k++)
      pops.push({
        t: Math.random() * dur,
        amp: 0.05 + Math.random() * 0.25,
        decay: 30 + Math.random() * 80,
      });
    for (let i = 0; i < N; i++) {
      const t = i / sr;
      const rumble = pink() * 0.4 * (0.8 + 0.2 * Math.sin(TAU * 1.3 * t));
      const crackle =
        (Math.random() * 2 - 1) * 0.15 * (Math.random() < 0.02 ? 3 : 1);
      let popV = 0;
      for (const p of pops) {
        const dt = t - p.t;
        if (dt >= 0 && dt < 0.08)
          popV += (Math.random() * 2 - 1) * Math.exp(-dt * p.decay) * p.amp;
      }
      d[i] = Math.max(-1, Math.min(1, rumble + crackle * 0.4 + popV));
    }
  } else if (type === "lofi") {
    const bpm = 72,
      beat = 60 / bpm,
      bar = beat * 4;
    const chords = [
      [220, 261.6, 329.6, 440],
      [174.6, 220, 261.6, 349.2],
      [261.6, 329.6, 392, 523.2],
      [196, 246.9, 293.6, 392],
    ];
    const pink = makePink();
    for (let i = 0; i < N; i++) {
      const t = i / sr,
        ci = Math.floor((t % bar) / beat) % 4,
        chord = chords[ci];
      let harm = 0;
      chord.forEach((f, ni) => {
        const det = 1 + [0.003, -0.002, 0.001, -0.003][ni];
        harm += Math.sin(TAU * f * det * t) * 0.08;
        harm += Math.sin(TAU * f * 2 * det * t) * 0.025;
      });
      const bp = t % beat,
        barp = t % bar;
      const kick =
        barp < 0.06 || Math.abs(barp - beat * 2) < 0.06
          ? Math.sin(TAU * 50 * Math.exp(-bp * 30) * t) *
            Math.exp(-bp * 25) *
            0.4
          : 0;
      const snare =
        Math.abs(barp - beat) < 0.05 || Math.abs(barp - beat * 3) < 0.05
          ? (Math.random() * 2 - 1) * Math.exp(-(barp % beat) * 40) * 0.2
          : 0;
      const hihat = t % (beat / 2) < 0.015 ? (Math.random() * 2 - 1) * 0.06 : 0;
      const vinyl =
        (Math.random() < 0.0007 ? (Math.random() * 2 - 1) * 0.4 : 0) +
        (Math.random() * 2 - 1) * 0.01;
      const wobble = 0.88 + 0.12 * Math.sin(TAU * 0.31 * t);
      d[i] = Math.max(
        -1,
        Math.min(
          1,
          harm * wobble + kick + snare + hihat + vinyl + pink() * 0.04,
        ),
      );
    }
  } else if (type === "jazz") {
    const bpm = 88,
      beat = 60 / bpm,
      bar = beat * 4;
    const bassNotes = [110, 123.5, 130.8, 146.8, 164.8, 146.8, 130.8, 123.5];
    const pianoV = [
      [277.2, 349.2, 415.3],
      [246.9, 311.1, 392],
      [220, 277.2, 329.6],
      [196, 246.9, 311.1],
    ];
    const pink = makePink();
    for (let i = 0; i < N; i++) {
      const t = i / sr,
        bi = Math.floor(t / beat),
        bf = bassNotes[bi % bassNotes.length],
        bp = t % beat;
      const bass = Math.sin(TAU * bf * t) * Math.exp(-bp * 8) * 0.35;
      const barp = t % bar,
        ci = Math.floor(barp / beat) % 4;
      let piano = 0;
      if (bp < 0.2) {
        pianoV[ci].forEach((f) => {
          piano += Math.sin(TAU * f * t) * Math.exp(-bp * 6) * 0.09;
          piano += Math.sin(TAU * f * 2 * t) * Math.exp(-bp * 10) * 0.03;
        });
      }
      const snare =
        Math.abs(barp - beat) < 0.3 || Math.abs(barp - beat * 3) < 0.3
          ? pink() * 0.18 * Math.exp(-(barp % beat) * 5)
          : 0;
      const ride =
        bp < 0.04 ? (Math.random() * 2 - 1) * Math.exp(-bp * 50) * 0.12 : 0;
      d[i] = Math.max(
        -1,
        Math.min(1, bass + piano + snare + ride + pink() * 0.04),
      );
    }
  } else if (type === "ambient") {
    const layers = [
      { freqs: [110, 138.6, 164.8], det: [0, 0.004, -0.003] },
      { freqs: [55, 69.3, 82.4], det: [0.002, -0.001, 0.003] },
    ];
    const pink = makePink();
    for (let i = 0; i < N; i++) {
      const t = i / sr;
      let s = 0;
      layers.forEach((layer, li) => {
        const env = 0.5 + 0.5 * Math.sin(TAU * 0.04 * t + li * 1.2);
        layer.freqs.forEach((f, fi) => {
          s += Math.sin(TAU * f * (1 + layer.det[fi]) * t) * 0.1 * env;
          s += Math.sin(TAU * f * 2 * (1 + layer.det[fi]) * t) * 0.03 * env;
        });
      });
      const filt =
        0.7 + 0.3 * Math.sin(TAU * 0.07 * t) * Math.sin(TAU * 0.13 * t);
      const bt = t % 8.5,
        bell =
          bt < 0.6 ? Math.sin(TAU * 523.2 * t) * Math.exp(-bt * 4) * 0.07 : 0;
      const bt2 = (t + 4.2) % 8.5;
      const bell2 =
        bt2 < 0.6 ? Math.sin(TAU * 659.2 * t) * Math.exp(-bt2 * 4) * 0.05 : 0;
      d[i] = Math.max(
        -1,
        Math.min(1, s * filt + bell + bell2 + pink() * 0.025),
      );
    }
  } else {
    // white noise
    for (let i = 0; i < N; i++) d[i] = (Math.random() * 2 - 1) * 0.45;
  }
  return d;
}

// ── Preview sound ──
function previewSound(e, id) {
  e.stopPropagation();
  const ctx = getCtx();
  if (previewSrc) {
    try {
      previewSrc.stop();
    } catch (e) {}
    previewSrc = null;
  }
  document
    .querySelectorAll(".sound-card")
    .forEach((c) => c.classList.remove("playing"));
  if (previewingId === id) {
    previewingId = null;
    return;
  }
  previewingId = id;
  document.querySelector(`[data-id="${id}"]`).classList.add("playing");
  const buf = ctx.createBuffer(1, SR * 4, SR);
  buf.copyToChannel(synthesise(id, SR, 4), 0);
  previewSrc = ctx.createBufferSource();
  previewSrc.buffer = buf;
  previewSrc.connect(ctx.destination);
  previewSrc.start();
  previewSrc.onended = () => {
    document
      .querySelectorAll(".sound-card")
      .forEach((c) => c.classList.remove("playing"));
    previewingId = null;
  };
}

// ── Custom sound upload ──
async function handleCustomSound(input) {
  const file = input.files[0];
  if (!file) return;
  customAudioName = file.name;
  const ctx = getCtx();
  const buf = await file.arrayBuffer();
  try {
    customAudioBuffer = await ctx.decodeAudioData(buf);
    document.getElementById("custom-sound-desc").textContent = "✓ " + file.name;
    document
      .querySelectorAll(".sound-card")
      .forEach((c) => c.classList.remove("selected"));
    document.getElementById("custom-sound-card").classList.add("selected");
    App.selectedSound = "custom";
    UI.toast("Custom sound loaded", "ok");
  } catch (e) {
    UI.toast("Could not decode audio", "err");
  }
}

// ── Playback controls ──
function togglePlay() {
  if (!rxBuffer) return;
  const ctx = getCtx();
  if (rxPlaying) {
    rxOffset += ctx.currentTime - rxStartTime;
    try {
      rxSrc.stop();
    } catch (e) {}
    rxSrc = null;
    rxPlaying = false;
    document.getElementById("rx-play-btn").textContent = "▶";
    cancelAnimationFrame(rxRaf);
  } else {
    if (rxOffset >= rxBuffer.duration) rxOffset = 0;
    rxSrc = ctx.createBufferSource();
    rxSrc.buffer = rxBuffer;
    rxSrc.connect(ctx.destination);
    rxSrc.start(0, rxOffset);
    rxStartTime = ctx.currentTime;
    rxPlaying = true;
    document.getElementById("rx-play-btn").textContent = "⏸";
    rxSrc.onended = () => {
      rxPlaying = false;
      rxOffset = 0;
      document.getElementById("rx-play-btn").textContent = "▶";
      cancelAnimationFrame(rxRaf);
    };
    tickPlayer();
  }
}

function tickPlayer() {
  const ctx = getCtx();
  const elapsed = rxOffset + (ctx.currentTime - rxStartTime);
  const dur = rxBuffer.duration;
  const pct = Math.min(100, (elapsed / dur) * 100);
  document.getElementById("rx-seekfill").style.width = pct + "%";
  const m = Math.floor(elapsed / 60),
    s = Math.floor(elapsed % 60);
  const dm = Math.floor(dur / 60),
    ds = Math.floor(dur % 60);
  document.getElementById("rx-time").textContent =
    `${m}:${s < 10 ? "0" : ""}${s} / ${dm}:${ds < 10 ? "0" : ""}${ds}`;
  rxRaf = requestAnimationFrame(tickPlayer);
}

function seekTo(e) {
  if (!rxBuffer) return;
  rxOffset = (e.offsetX / e.currentTarget.offsetWidth) * rxBuffer.duration;
  if (rxPlaying) {
    try {
      rxSrc.stop();
    } catch (e) {}
    rxPlaying = false;
    togglePlay();
  }
}

// ── Render custom audio to PCM for encoding ──
async function renderCustomAudio() {
  if (!customAudioBuffer) return null;
  const offCtx = new OfflineAudioContext(1, Math.floor(SR * DUR), SR);
  const src = offCtx.createBufferSource();
  src.buffer = customAudioBuffer;
  src.loop = true;
  src.connect(offCtx.destination);
  src.start(0);
  const rendered = await offCtx.startRendering();
  return rendered.getChannelData(0);
}

// ── Load buffer into player ──
function loadRxBuffer(buf, label) {
  rxBuffer = buf;
  document.getElementById("rx-fname").textContent = label || "Shared audio";
  document.getElementById("rx-section").style.display = "block";
  document.getElementById("result-box").style.display = "none";
  rxOffset = 0;
  rxPlaying = false;
  document.getElementById("rx-play-btn").textContent = "▶";
  requestAnimationFrame(() =>
    requestAnimationFrame(() => UI.drawWaveform(rxBuffer)),
  );
}
