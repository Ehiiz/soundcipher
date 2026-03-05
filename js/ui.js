/*
  Whisper — ui.js
  UI helpers: mode switching, toast notifications, waveform canvas, progress
  MIT License © 2025 thedigitalauteur
*/

const UI = {
  sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  },

  setMode(m) {
    ["hide", "reveal"].forEach((k) => {
      document.getElementById("panel-" + k).classList.toggle("active", k === m);
      document.getElementById("btn-" + k).classList.toggle("active", k === m);
    });
  },

  toast(msg, type = "") {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.className = "toast show " + type;
    setTimeout(() => (el.className = "toast"), 3200);
  },

  drawWaveform(buf) {
    const canvas = document.getElementById("rx-wv");
    const W = canvas.offsetWidth,
      H = canvas.offsetHeight;
    if (!W || !H) return;
    canvas.width = W * devicePixelRatio;
    canvas.height = H * devicePixelRatio;
    const c = canvas.getContext("2d");
    c.scale(devicePixelRatio, devicePixelRatio);
    const data = buf.getChannelData(0);
    const step = Math.max(1, Math.ceil(data.length / W));
    c.fillStyle = "#ede7d9";
    c.fillRect(0, 0, W, H);
    c.strokeStyle = "#b8860b";
    c.lineWidth = 1;
    c.beginPath();
    for (let x = 0; x < W; x++) {
      let mn = 1,
        mx = -1;
      for (let j = 0; j < step; j++) {
        const s = data[x * step + j] || 0;
        if (s < mn) mn = s;
        if (s > mx) mx = s;
      }
      c.moveTo(x, (1 - (mx + 1) / 2) * H);
      c.lineTo(x, (1 - (mn + 1) / 2) * H);
    }
    c.stroke();
  },

  setProgress(fillId, labelId, pct, label) {
    const fill = document.getElementById(fillId);
    const lbl = document.getElementById(labelId);
    if (fill) fill.style.width = pct + "%";
    if (lbl && label !== undefined) lbl.textContent = label;
  },

  showProgress(wrapId) {
    const el = document.getElementById(wrapId);
    if (el) el.style.display = "block";
  },

  hideProgress(wrapId, delay = 0) {
    setTimeout(() => {
      const el = document.getElementById(wrapId);
      if (el) el.style.display = "none";
      const fill = el && el.querySelector(".prog-fill");
      if (fill) fill.style.width = "0%";
    }, delay);
  },

  setShareHint(text) {
    const el = document.getElementById("share-hint");
    if (el) el.textContent = text;
  },
};

// ── Sound card selection ──
function selectSound(card, id) {
  document
    .querySelectorAll(".sound-card")
    .forEach((c) => c.classList.remove("selected"));
  card.classList.add("selected");
  App.selectedSound = id;
}

// ── Upload zone file handler ──
function handleUpload(input) {
  const file = input.files[0];
  if (!file) return;
  document.getElementById("up-filename").textContent = "📄 " + file.name;
  const reader = new FileReader();
  reader.onload = async (e) => {
    const ctx = getCtx();
    try {
      const buf = await ctx.decodeAudioData(e.target.result.slice(0));
      loadRxBuffer(buf, file.name);
      UI.toast("File loaded — press Reveal to decode", "ok");
    } catch (err) {
      UI.toast("Could not read file", "err");
    }
  };
  reader.readAsArrayBuffer(file);
}

// ── Drag & drop ──
function initDragDrop() {
  const zone = document.getElementById("upload-zone");
  zone.addEventListener("dragover", (e) => {
    e.preventDefault();
    zone.classList.add("over");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("over"));
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("over");
    const file = e.dataTransfer.files[0];
    if (file) {
      const dt = new DataTransfer();
      dt.items.add(file);
      const inp = zone.querySelector("input");
      inp.files = dt.files;
      handleUpload(inp);
    }
  });
}

// ── Typewriter reveal ──
async function typewriterReveal(text, targetEl) {
  targetEl.innerHTML = "";
  const cursor = document.createElement("span");
  cursor.className = "typewriter-cursor";
  targetEl.appendChild(cursor);
  const delay = Math.max(18, Math.min(60, 1200 / text.length));
  for (const ch of text) {
    const span = document.createElement("span");
    span.textContent = ch;
    targetEl.insertBefore(span, cursor);
    await UI.sleep(delay);
  }
  await UI.sleep(600);
  cursor.remove();
}
