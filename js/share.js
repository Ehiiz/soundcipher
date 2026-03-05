/*
  Whisper — share.js
  All sharing goes through Cloudinary. No message ever appears in the URL.

  Flow:
    Encode → synthesise audio → embed message → upload WAV → get ID
    Decode → fetch WAV by ID → play → reveal

  URL format:
    #id=PUBLIC_ID_B64   — opaque Cloudinary public_id, base64 encoded
    #whisper=...        — legacy long base64 (backwards compat, read-only)

  Signed upload flow:
    1. Browser calls /api/sign → gets { signature, apiKey, timestamp, folder }
    2. Browser uploads WAV directly to Cloudinary with those credentials
    3. API secret never touches the browser

  MIT License © 2025 thedigitalauteur
*/

const CLOUDINARY_CLOUD = "dpcfxqiov";
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/raw/upload`;
const CLOUDINARY_FETCH_URL = (id) =>
  `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/raw/upload/${id}`;

const Share = {
  // ── URL-safe base64 helpers ──
  toB64(uint8) {
    let binary = "";
    for (let i = 0; i < uint8.length; i++)
      binary += String.fromCharCode(uint8[i]);
    return btoa(binary)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  },

  fromB64(str) {
    str = str.replace(/-/g, "+").replace(/_/g, "/");
    while (str.length % 4) str += "=";
    const binary = atob(str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  },

  // ── Step 1: get upload signature from Vercel function ──
  async getSignature() {
    const resp = await fetch("/api/sign", { method: "POST" });
    if (!resp.ok)
      throw new Error(
        "Could not get upload signature — is /api/sign deployed?",
      );
    return await resp.json();
    // returns { signature, apiKey, timestamp, cloudName, folder }
  },

  // ── Step 2: upload signed WAV to Cloudinary ──
  async uploadToCloudinary(wavBuf, sig) {
    const formData = new FormData();
    formData.append(
      "file",
      new Blob([wavBuf], { type: "audio/wav" }),
      "whisper.wav",
    );
    formData.append("api_key", sig.apiKey);
    formData.append("timestamp", sig.timestamp);
    formData.append("signature", sig.signature);
    formData.append("folder", sig.folder);
    formData.append("resource_type", "raw");

    const resp = await fetch(CLOUDINARY_UPLOAD_URL, {
      method: "POST",
      body: formData,
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(
        err.error?.message || "Cloudinary upload failed: " + resp.status,
      );
    }

    const data = await resp.json();
    return data.public_id; // e.g. "whisper/abc123xyz"
  },

  // ── Fetch WAV from Cloudinary by public_id ──
  async fetchFromCloudinary(publicId) {
    const resp = await fetch(CLOUDINARY_FETCH_URL(publicId));
    if (!resp.ok)
      throw new Error("Could not fetch audio — link may have expired");
    return await resp.arrayBuffer();
  },

  // ── Generate share link ──
  async generate() {
    const msg = document.getElementById("secret-msg").value.trim();
    if (!msg) {
      UI.toast("Type a message first", "err");
      return;
    }

    const btn = document.getElementById("share-btn");
    const base = window.location.href.split("#")[0];
    btn.disabled = true;
    UI.showProgress("enc-prog");
    document.getElementById("share-result").style.display = "none";

    try {
      // Step 1 — synthesise cover sound
      UI.setProgress("enc-fill", "enc-label", 10, "Synthesising audio…");
      await UI.sleep(20);

      let raw;
      if (App.selectedSound === "custom") {
        raw = await renderCustomAudio();
        if (!raw) {
          UI.toast("Upload a custom sound first", "err");
          btn.disabled = false;
          UI.hideProgress("enc-prog");
          return;
        }
      } else {
        raw = synthesise(App.selectedSound, SR, DUR);
      }

      // Step 2 — embed message in LSB
      UI.setProgress("enc-fill", "enc-label", 30, "Embedding message…");
      await UI.sleep(20);
      const bits = msgToBits(msg);
      if (bits.length > raw.length) {
        UI.toast("Message too long", "err");
        btn.disabled = false;
        UI.hideProgress("enc-prog");
        return;
      }
      const encoded = embedBits(raw, bits);

      // Step 3 — build WAV
      UI.setProgress("enc-fill", "enc-label", 50, "Building WAV…");
      await UI.sleep(20);
      const wavBuf = buildWav(encoded, SR);

      // Step 4 — get upload signature from Vercel
      UI.setProgress("enc-fill", "enc-label", 65, "Signing upload…");
      await UI.sleep(20);
      const sig = await this.getSignature();

      // Step 5 — upload to Cloudinary
      UI.setProgress("enc-fill", "enc-label", 80, "Uploading to Cloudinary…");
      await UI.sleep(20);
      const publicId = await this.uploadToCloudinary(wavBuf, sig);

      // Step 6 — build short opaque URL
      const idB64 = this.toB64(new TextEncoder().encode(publicId));
      const shareUrl = base + "#id=" + idB64;

      UI.setProgress("enc-fill", "enc-label", 100, "✓ Link ready!");
      await UI.sleep(20);

      document.getElementById("share-url").value = shareUrl;
      document.getElementById("share-result").style.display = "block";
      UI.setShareHint(
        "✓ Short link — works everywhere. Audio stored for 30 days.",
      );
      UI.toast("Link generated!", "ok");
    } catch (e) {
      console.error("Share failed:", e);
      UI.toast(e.message || "Could not generate link", "err");
    }

    btn.disabled = false;
    UI.hideProgress("enc-prog", 1500);
  },

  copyLink() {
    const input = document.getElementById("share-url");
    input.select();
    navigator.clipboard
      .writeText(input.value)
      .then(() => UI.toast("Copied!", "ok"))
      .catch(() => {
        document.execCommand("copy");
        UI.toast("Copied!", "ok");
      });
  },

  // ── Load shared audio from URL hash on page open ──
  async loadFromHash() {
    const hash = window.location.hash;
    if (!hash) return;

    // #id=B64_PUBLIC_ID — fetch from Cloudinary
    if (hash.startsWith("#id=")) {
      const idB64 = hash.slice(4);
      if (!idB64) return;
      let publicId;
      try {
        publicId = new TextDecoder().decode(this.fromB64(idB64));
      } catch (e) {
        UI.toast("Invalid share link", "err");
        return;
      }

      UI.setMode("reveal");
      const pw = document.getElementById("dec-prog");
      pw.style.display = "block";
      UI.setProgress("dec-fill", "dec-label", 20, "Fetching shared audio…");

      try {
        const arrayBuf = await this.fetchFromCloudinary(publicId);
        UI.setProgress("dec-fill", "dec-label", 70, "Decoding audio…");
        const ctx = getCtx();
        const buf = await ctx.decodeAudioData(arrayBuf);
        UI.setProgress(
          "dec-fill",
          "dec-label",
          100,
          "Ready — press Reveal to decode",
        );
        document.getElementById("up-filename").textContent =
          "📡 Loaded from share link";
        loadRxBuffer(buf, "Shared audio");
        UI.toast("Shared audio loaded — press Reveal to decode", "ok");
      } catch (e) {
        UI.setProgress("dec-fill", "dec-label", 0, "");
        pw.style.display = "none";
        UI.toast(e.message || "Could not load shared audio", "err");
      }
      return;
    }

    // #whisper= — legacy long base64 (backwards compat, read-only)
    if (hash.startsWith("#whisper=")) {
      const b64 = hash.slice(9);
      if (!b64) return;
      UI.setMode("reveal");
      UI.toast("Loading legacy shared audio…", "ok");
      try {
        const bytes = this.fromB64(b64.replace(/\+/g, "-").replace(/\//g, "_"));
        const ctx = getCtx();
        const buf = await ctx.decodeAudioData(bytes.buffer);
        document.getElementById("up-filename").textContent =
          "📡 Loaded from share link";
        loadRxBuffer(buf, "Shared audio");
        UI.toast("Shared audio loaded — press Reveal to decode", "ok");
      } catch (e) {
        UI.toast("Could not load shared audio", "err");
      }
    }
  },
};
