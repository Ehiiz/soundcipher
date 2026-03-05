/*
  Whisper — app.js
  Global state, encode/download, reveal/decode pipeline, init
  MIT License © 2025 thedigitalauteur
*/

const App = { selectedSound: "rain" };

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
    a.download = "whisper-" + App.selectedSound + "-" + Date.now() + ".wav";
    a.click();
    URL.revokeObjectURL(url);
    UI.toast("Downloaded!", "ok");
  }
  btn.disabled = false;
  UI.hideProgress("enc-prog", 2000);
}

// ── Shared scan logic — runs the waveform animation and extracts bits ──
async function scanAudio() {
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
  await new Promise(function (resolve) {
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

  playhead.style.left = "0px";
  playhead.classList.remove("active");
  scanOverlay.style.width = "0%";

  UI.setProgress("dec-fill", "dec-label", 55, "Extracting bits…");
  await UI.sleep(80);

  const samples = rxBuffer.getChannelData(0);
  return extractBits(samples, 16 + 16 + 500 * 8);
}

// ── Reveal message (called by button and passphrase submit) ──
async function revealMessage(passphrase) {
  if (!rxBuffer) {
    UI.toast("Upload a .wav file first", "err");
    return;
  }

  passphrase = passphrase || "";
  const btn = document.getElementById("reveal-btn");
  const resultBox = document.getElementById("result-box");
  const resultText = document.getElementById("result-text");
  const passcodePrompt = document.getElementById("passcode-prompt");

  btn.disabled = true;
  UI.showProgress("dec-prog");
  resultBox.style.display = "none";
  passcodePrompt.style.display = "none";

  // Phase 1 — scan
  const rawBits = await scanAudio();
  UI.setProgress("dec-fill", null, 70);

  // Phase 2 — decode
  const result = decodeBits(rawBits, passphrase);

  if (result.status === SCAN_NONE) {
    UI.setProgress("dec-fill", "dec-label", 100, "No hidden message found.");
    resultBox.style.display = "block";
    resultText.innerHTML =
      '<span style="color:rgba(245,240,232,0.4);font-size:14px;font-style:italic;">No hidden message found.<br>Make sure the file was created with Whisper.</span>';
    btn.disabled = false;
    UI.toast("No Whisper message found", "err");
    return;
  }

  if (result.status === SCAN_LOCKED) {
    // Message exists but needs passphrase — show prompt
    UI.setProgress("dec-fill", "dec-label", 100, "🔒 Passcode required.");
    UI.hideProgress("dec-prog", 600);
    passcodePrompt.style.display = "block";
    setTimeout(function () {
      document.getElementById("dec-passphrase").focus();
    }, 320);
    btn.disabled = false;
    UI.toast("This message is passcode protected", "ok");
    return;
  }

  if (result.status === "wrong_passphrase") {
    UI.setProgress("dec-fill", "dec-label", 100, "✗ Wrong passcode.");
    passcodePrompt.style.display = "block";
    document.getElementById("dec-passphrase").value = "";
    document.getElementById("dec-passphrase").focus();
    btn.disabled = false;
    UI.toast("Wrong passcode — try again", "err");
    return;
  }

  // Success
  const decoded = result.message;
  UI.setProgress(
    "dec-fill",
    "dec-label",
    88,
    "Decrypted — " + decoded.length + " characters…",
  );
  await UI.sleep(80);
  UI.setProgress(
    "dec-fill",
    "dec-label",
    100,
    "✓ " + decoded.length + " characters revealed",
  );

  resultBox.style.display = "block";
  await typewriterReveal(decoded, resultText);

  btn.disabled = false;
  UI.toast("Message revealed — " + decoded.length + " characters", "ok");

  await UI.sleep(400);
  const ttsEl = document.getElementById("tts-indicator");
  ttsEl.classList.add("active");
  await TTS.speak(decoded);
  ttsEl.classList.remove("active");
}

// ── Submit passphrase ──
async function submitPasscode() {
  const pass = (document.getElementById("dec-passphrase").value || "").trim();
  if (!pass) {
    UI.toast("Enter a passcode", "err");
    return;
  }
  document.getElementById("dec-passphrase").value = "";
  await revealMessage(pass);
}

// ── Load Unreal Speech key from env via /api/config ──
async function loadConfig() {
  try {
    const resp = await fetch("/api/config");
    if (!resp.ok) return;
    const cfg = await resp.json();
    if (cfg.unrealSpeechKey) {
      const input = document.getElementById("us-key");
      if (input && !input.value) {
        input.value = cfg.unrealSpeechKey;
        TTS.setProvider("unrealspeech");
      }
    }
  } catch (e) {
    // /api/config not available locally without vercel dev — silently fall back
  }
}

// ── Init ──
window.addEventListener("load", function () {
  TTS.restoreSettings();
  initDragDrop();
  const link = document.getElementById("contact-link");
  if (link) link.href = "mailto:" + "thedigitalauteur" + "@" + "gmail.com";
  loadConfig();
  setTimeout(function () {
    Share.loadFromHash();
  }, 300);
});
