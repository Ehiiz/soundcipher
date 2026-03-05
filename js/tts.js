/*
  Whisper — tts.js
  Text-to-speech: Browser Web Speech API, Unreal Speech, ElevenLabs
  MIT License © 2025 thedigitalauteur
*/

const TTS = {
  provider: "browser",

  setProvider(p) {
    this.provider = p;
    ["browser", "unrealspeech", "elevenlabs"].forEach((k) => {
      document
        .getElementById("tts-btn-" + k)
        .classList.toggle("active", k === p);
      document.getElementById("tts-cfg-" + k).style.display =
        k === p ? "block" : "none";
    });
    try {
      localStorage.setItem("whisper_tts_provider", p);
    } catch (e) {}
  },

  saveKey(inputId, storageKey) {
    try {
      localStorage.setItem(storageKey, document.getElementById(inputId).value);
    } catch (e) {}
  },

  restoreSettings() {
    try {
      const p = localStorage.getItem("whisper_tts_provider") || "browser";
      this.setProvider(p);
      const map = {
        whisper_el_key: "el-key",
        whisper_el_voice: "el-voice",
        whisper_us_key: "us-key",
        whisper_us_voice: "us-voice",
      };
      Object.entries(map).forEach(([k, id]) => {
        const v = localStorage.getItem(k);
        const el = document.getElementById(id);
        if (v && el) el.value = v;
      });
    } catch (e) {}
  },

  async speak(text) {
    if (this.provider === "unrealspeech") {
      const key = (document.getElementById("us-key").value || "").trim();
      const voice = document.getElementById("us-voice").value;
      if (key) {
        try {
          const resp = await fetch("https://api.v7.unrealspeech.com/speech", {
            method: "POST",
            headers: {
              Authorization: "Bearer " + key,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              Text: text,
              VoiceId: voice,
              Bitrate: "192k",
              Speed: "0",
              Pitch: "1",
              TimestampType: "sentence",
            }),
          });
          if (!resp.ok) throw new Error(resp.status);
          const json = await resp.json();
          await this._playUrl(json.OutputUri);
          return;
        } catch (e) {
          console.warn("Unreal Speech failed:", e);
        }
      }
    }

    if (this.provider === "elevenlabs") {
      const key = (document.getElementById("el-key").value || "").trim();
      const voice = document.getElementById("el-voice").value;
      if (key) {
        try {
          const resp = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${voice}`,
            {
              method: "POST",
              headers: {
                "xi-api-key": key,
                "Content-Type": "application/json",
                Accept: "audio/mpeg",
              },
              body: JSON.stringify({
                text,
                model_id: "eleven_monolingual_v1",
                voice_settings: { stability: 0.4, similarity_boost: 0.8 },
              }),
            },
          );
          if (!resp.ok) throw new Error(resp.status);
          const blob = await resp.blob();
          const url = URL.createObjectURL(blob);
          await this._playUrl(url, true);
          return;
        } catch (e) {
          console.warn("ElevenLabs failed:", e);
        }
      }
    }

    // Fallback: browser speech synthesis
    await this._browserSpeak(text);
  },

  _playUrl(url, revoke = false) {
    return new Promise((resolve) => {
      const audio = new Audio(url);
      audio.onended = () => {
        if (revoke) URL.revokeObjectURL(url);
        resolve();
      };
      audio.onerror = () => resolve();
      audio.play().catch(() => resolve());
    });
  },

  _browserSpeak(text) {
    return new Promise((resolve) => {
      if (!window.speechSynthesis) {
        resolve();
        return;
      }
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(text);
      utt.rate = 0.88;
      utt.pitch = 0.9;
      utt.volume = 1;
      const voices = window.speechSynthesis.getVoices();
      const pref = voices.find(
        (v) =>
          v.name.toLowerCase().includes("samantha") ||
          v.name.toLowerCase().includes("karen") ||
          v.name.toLowerCase().includes("moira") ||
          v.name.toLowerCase().includes("victoria"),
      );
      if (pref) utt.voice = pref;
      utt.onend = resolve;
      utt.onerror = resolve;
      window.speechSynthesis.speak(utt);
    });
  },
};
