/*
  Whisper — stego.js
  LSB steganography with optional passcode layer.
  MIT License © 2025 thedigitalauteur
*/

const MAGIC_OPEN = [1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 0, 1, 1];
const MAGIC_LOCKED = [1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0];

const SCAN_NONE = "none";
const SCAN_OPEN = "open";
const SCAN_LOCKED = "locked";

function deriveKey(passphrase, length) {
  const key = [];
  for (let i = 0; i < length; i++)
    key.push(passphrase.charCodeAt(i % passphrase.length));
  return key;
}

function xorMessage(msg, passphrase) {
  const key = deriveKey(passphrase, msg.length);
  let out = "";
  for (let i = 0; i < msg.length; i++)
    out += String.fromCharCode(msg.charCodeAt(i) ^ key[i]);
  return out;
}

function msgToBits(msg, passphrase) {
  passphrase = passphrase || "";
  const magic = passphrase ? MAGIC_LOCKED.slice() : MAGIC_OPEN.slice();
  const payload = passphrase ? xorMessage(msg, passphrase) : msg;
  const bits = magic.slice();
  const len = payload.length;
  for (let i = 15; i >= 0; i--) bits.push((len >> i) & 1);
  for (let ci = 0; ci < payload.length; ci++) {
    const c = payload.charCodeAt(ci);
    for (let b = 7; b >= 0; b--) bits.push((c >> b) & 1);
  }
  return bits;
}

function embedBits(samples, bits) {
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    // Use 32768 for both directions so the roundtrip is consistent:
    // embed:   float → round(float * 32768) → clear LSB → set bit → store as float/32768
    // extract: float * 32768 → round → & 1  (browser decodeAudioData also divides by 32768)
    let s16 = Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32768)));
    if (i < bits.length) s16 = (s16 & ~1) | bits[i];
    out[i] = s16 / 32768;
  }
  return out;
}

function extractBits(samples, count) {
  const bits = [];
  for (let i = 0; i < count && i < samples.length; i++)
    // Must match embedBits: multiply by 32768, not 32767.
    // Browser's decodeAudioData normalises int16 → float by dividing by 32768,
    // so multiplying back by 32768 recovers the exact integer, preserving the LSB.
    bits.push(Math.round(samples[i] * 32768) & 1);
  return bits;
}

function scanBits(rawBits) {
  const header = rawBits.slice(0, 16);
  if (
    MAGIC_OPEN.every(function (b, i) {
      return b === header[i];
    })
  )
    return SCAN_OPEN;
  if (
    MAGIC_LOCKED.every(function (b, i) {
      return b === header[i];
    })
  )
    return SCAN_LOCKED;
  return SCAN_NONE;
}

function decodeBits(rawBits, passphrase) {
  passphrase = passphrase || "";
  const type = scanBits(rawBits);
  if (type === SCAN_NONE) return { status: SCAN_NONE, message: null };

  let msgLen = 0;
  for (let i = 16; i < 32; i++) msgLen = (msgLen << 1) | rawBits[i];
  if (msgLen <= 0 || msgLen > 500) return { status: SCAN_NONE, message: null };

  if (type === SCAN_LOCKED && !passphrase)
    return { status: SCAN_LOCKED, message: null };

  let raw = "";
  for (let ci = 0; ci < msgLen; ci++) {
    let code = 0;
    for (let b = 0; b < 8; b++)
      code = (code << 1) | (rawBits[32 + ci * 8 + b] || 0);
    raw += String.fromCharCode(code);
  }

  if (type === SCAN_LOCKED) {
    const decrypted = xorMessage(raw, passphrase);
    const valid = decrypted.split("").every(function (c) {
      return c.charCodeAt(0) >= 32 && c.charCodeAt(0) < 127;
    });
    if (!valid) return { status: "wrong_passphrase", message: null };
    return { status: SCAN_OPEN, message: decrypted };
  }

  return { status: SCAN_OPEN, message: raw };
}

function buildWav(samples, sr) {
  const n = samples.length;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const ws = function (o, s) {
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
    // buildWav writes the int16 that embedBits already computed (stored as float/32768),
    // so we recover it by multiplying back by 32768.
    v.setInt16(
      44 + i * 2,
      Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32768))),
      true,
    );
  return buf;
}

async function buildEncodedWav() {
  const msg = document.getElementById("secret-msg").value.trim();
  if (!msg) {
    UI.toast("Type a message first", "err");
    return null;
  }
  const passphrase = (
    document.getElementById("enc-passphrase").value || ""
  ).trim();
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
  pl.textContent = passphrase
    ? "Encrypting & embedding…"
    : "Embedding message…";
  await UI.sleep(20);
  const bits = msgToBits(msg, passphrase);
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
