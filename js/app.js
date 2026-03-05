/*
  Whisper — app.js
  Global state, encode/download action, reveal/decode pipeline, app init
  MIT License © 2025 thedigitalauteur
*/

// ── Global state ──
const App = {
  selectedSound: "rain",
};

// ── Encode & download ──
async function encodeAndDownload() {
  const btn = document.getElementById("enc-btn");
  btn.disabled = true;
  UI.showProgress("enc-prog");

  const wavBuf = await buildEncodedWav();

  if (wavBuf) {
    UI.setProgress("enc-fill", "enc-label", 100, "Done — downloading…");
    const blob = new Blob([wavBuf], { type: "audio/wav" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `whisper-${App.selectedSound}-${Date.now()}.wav`;
    a.click();
    URL.revokeObjectURL(url);
    UI.toast("Downloaded!", "ok");
  }

  btn.disabled = false;
  UI.hideProgress("enc-prog", 2000);
}

// ── Reveal / decode ──
async function revealMessage() {
  if (!rxBuffer) {
    UI.toast("Upload a .wav file first", "err");
    return;
  }

  const btn = document.getElementById("reveal-btn");
  const resultBox = document.getElementById("result-box");
  const resultText = document.getElementById("result-text");

  btn.disabled = true;
  UI.showProgress("dec-prog");
  resultBox.style.display = "none";

  // Phase 1 — animated waveform scan
  const playhead = document.getElementById("wv-playhead");
  const scanOverlay = document.getElementById("wv-scan");
  const canvas = document.getElementById("rx-wv");
  UI.drawWaveform(rxBuffer);
  await UI.sleep(30);
  const W = canvas.offsetWidth || 600;
  playhead.classList.add("active");
  UI.setProgress("dec-fill", "dec-label", 5, "Scanning audio for hidden data…");

  const scanDur = 1800,
    scanStart = performance.now();
  await new Promise((resolve) => {
    function animate(now) {
      const pct = Math.min(1, (now - scanStart) / scanDur);
      playhead.style.left = pct * W + "px";
      scanOverlay.style.width = pct * 100 + "%";
      UI.setProgress("dec-fill", null, 5 + pct * 45);
      if (pct < 1) requestAnimationFrame(animate);
      else resolve();
    }
    requestAnimationFrame(animate);
  });

  // Phase 2 — extract bits
  UI.setProgress("dec-fill", "dec-label", 55, "Extracting bits…");
  await UI.sleep(80);

  const samples = rxBuffer.getChannelData(0);
  const rawBits = extractBits(samples, 16 + 16 + 500 * 8 + 16);

  UI.setProgress("dec-fill", null, 70);

  // Phase 3 — decode
  const decoded = decodeBits(rawBits);

  // Reset scan visuals
  playhead.style.left = "0px";
  playhead.classList.remove("active");
  scanOverlay.style.width = "0%";

  if (decoded === null) {
    UI.setProgress("dec-fill", "dec-label", 100, "No hidden message found.");
    resultBox.style.display = "block";
    resultText.innerHTML =
      '<span style="color:rgba(245,240,232,0.4);font-size:14px;font-style:italic;">No hidden message found.<br>Make sure the file was created with Whisper.</span>';
    btn.disabled = false;
    UI.toast("No Whisper message found", "err");
    return;
  }

  UI.setProgress(
    "dec-fill",
    "dec-label",
    88,
    `Decrypted — ${decoded.length} characters…`,
  );
  await UI.sleep(80);
  UI.setProgress(
    "dec-fill",
    "dec-label",
    100,
    `✓ ${decoded.length} characters revealed`,
  );

  // Phase 4 — typewriter
  resultBox.style.display = "block";
  await typewriterReveal(decoded, resultText);

  btn.disabled = false;
  UI.toast(`Message revealed — ${decoded.length} characters`, "ok");

  // Phase 5 — voice readout
  await UI.sleep(400);
  const ttsEl = document.getElementById("tts-indicator");
  ttsEl.classList.add("active");
  await TTS.speak(decoded);
  ttsEl.classList.remove("active");
}

// ── Init ──
window.addEventListener("load", () => {
  TTS.restoreSettings();
  initDragDrop();

  // Set contact mailto without Cloudflare mangling it
  const link = document.getElementById("contact-link");
  if (link) link.href = "mailto:" + "thedigitalauteur" + "@" + "gmail.com";

  setTimeout(() => Share.loadFromHash(), 300);
});
