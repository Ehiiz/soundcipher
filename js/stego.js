/*
  Whisper — stego.js
  LSB steganography: encode/decode + WAV file builder
  MIT License © 2025 thedigitalauteur
*/

const MAGIC = [1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 0, 1, 1];

// ── Message → bit array ──
function msgToBits(msg) {
  const bits = MAGIC.slice();
  const len = msg.length;
  for (let i = 15; i >= 0; i--) bits.push((len >> i) & 1);
  for (let ci = 0; ci < msg.length; ci++) {
    const c = msg.charCodeAt(ci);
    for (let b = 7; b >= 0; b--) bits.push((c >> b) & 1);
  }
  return bits;
}

// ── Embed bits into PCM samples ──
function embedBits(samples, bits) {
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    let s16 = Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767)));
    if (i < bits.length) s16 = (s16 & ~1) | bits[i];
    out[i] = s16 / 32767;
  }
  return out;
}

// ── Extract LSBs from PCM samples ──
function extractBits(samples, count) {
  const bits = [];
  for (let i = 0; i < count && i < samples.length; i++)
    bits.push(Math.round(samples[i] * 32767) & 1);
  return bits;
}

// ── Decode message from bit array ──
function decodeBits(rawBits) {
  // Validate magic header
  const magic = rawBits.slice(0, 16);
  if (!MAGIC.every((b, i) => b === magic[i])) return null;

  // Read message length
  let msgLen = 0;
  for (let i = 16; i < 32; i++) msgLen = (msgLen << 1) | rawBits[i];

  // Read characters
  let decoded = "";
  for (let ci = 0; ci < msgLen; ci++) {
    let code = 0;
    for (let b = 0; b < 8; b++)
      code = (code << 1) | (rawBits[32 + ci * 8 + b] || 0);
    if (code >= 32 && code < 127) decoded += String.fromCharCode(code);
  }
  return decoded;
}

// ── Build WAV file from PCM samples ──
function buildWav(samples, sr) {
  const n = samples.length;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const ws = (o, s) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  ws(0, "RIFF");
  v.setUint32(4, 36 + n * 2, true);
  ws(8, "WAVE");
  ws(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sr, true);
  v.setUint32(28, sr * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  ws(36, "data");
  v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++)
    v.setInt16(
      44 + i * 2,
      Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767))),
      true,
    );
  return buf;
}

// ── Full encode pipeline ──
async function buildEncodedWav() {
  const msg = document.getElementById("secret-msg").value.trim();
  if (!msg) {
    UI.toast("Type a message first", "err");
    return null;
  }

  const pf = document.getElementById("enc-fill");
  const pl = document.getElementById("enc-label");

  pl.textContent = "Synthesising audio…";
  pf.style.width = "15%";
  await UI.sleep(20);

  let raw;
  if (App.selectedSound === "custom") {
    raw = await renderCustomAudio();
    if (!raw) {
      UI.toast("Upload a custom sound first", "err");
      return null;
    }
  } else {
    raw = synthesise(App.selectedSound, SR, DUR);
  }

  pf.style.width = "45%";
  pl.textContent = "Embedding message…";
  await UI.sleep(20);

  const bits = msgToBits(msg);
  if (bits.length > raw.length) {
    UI.toast("Message too long", "err");
    return null;
  }

  const encoded = embedBits(raw, bits);
  pf.style.width = "80%";
  pl.textContent = "Building WAV…";
  await UI.sleep(20);

  return buildWav(encoded, SR);
}
