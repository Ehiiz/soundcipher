# Whisper 🎧

### Hide secret messages inside sound

> _Invisible to the ear. Visible only to those who know where to look._

Whisper is a browser-based steganography tool that lets you embed secret text messages inside normal-sounding audio files. Share a file that sounds like rain, lo-fi music, or ocean waves — only someone with Whisper can reveal what's hidden inside.

**No server. No account. No installation. Just open the HTML file.**

🔗 **Live demo:** [playwhisper.vercel.app](https://playwhisper.vercel.app)

---

## What is steganography?

Steganography is the practice of hiding information inside another medium — not encrypting it, but concealing its very existence. Unlike encryption (which makes data unreadable), steganography makes data invisible. The message isn't locked; it's hidden in plain sight.

Whisper uses **LSB (Least Significant Bit) steganography** on audio data.

---

## How it works

A 16-bit audio sample is a number between -32,768 and 32,767. The **least significant bit** is the last binary digit — changing it alters the value by exactly 1, a volume difference of ~0.003%. No human ear can detect this.

Whisper converts each character of your message to binary, then writes each bit into the LSB of one audio sample:

```
Original sample:  0111 1111 1111 1110   (32,766)
After embedding:  0111 1111 1111 1111   (32,767)  ← 1-unit change, inaudible
```

A 12-second audio file at 44,100 Hz contains **529,200 samples** — enough to hide ~500 characters with zero audible impact.

### Message format

Each encoded file follows this structure:

```
[16-bit magic header] [16-bit message length] [8-bit ASCII chars × N]
```

The magic header (`1011110111101011`) is checked first during decode. If it's absent, the file contains no hidden message.

---

## Features

- 🎵 **8 procedurally synthesised cover sounds** — Rain, Forest Dawn, Ocean Waves, Campfire, Lo-fi Hip Hop, Late Night Jazz, Deep Ambient, White Noise
- 📁 **Upload your own audio** — MP3, WAV, OGG, M4A — any format
- 🔗 **Serverless share links** — entire WAV embedded as base64 in the URL hash, no backend needed
- 🎙️ **Voice readout** — decoded messages read aloud via Browser TTS, Unreal Speech, or ElevenLabs
- 🌊 **Animated decode experience** — scanning waveform, typewriter reveal, animated voice indicator
- 💾 **Download as .wav** — share the file directly, it sounds completely normal

---

## Getting started

Whisper is a single HTML file. No build step, no dependencies, no npm install.

```bash
# Clone the repo
git clone https://github.com/thedigitalauteur/whisper.git
cd whisper

# Open in browser
open whisper.html
```

That's it.

---

## Usage

### Hiding a message

1. Open Whisper and go to **Hide a Message**
2. Choose a cover sound (or upload your own)
3. Type your secret message (up to 500 characters)
4. Click **Download .wav** to save the file, or **Share Link** to generate a URL
5. Send the file or link to your recipient

### Revealing a message

1. Go to **Reveal a Message**
2. Upload the `.wav` file, or open the share link directly
3. Press **Play** to hear it — it sounds completely normal
4. Click **Reveal Hidden Message**
5. Watch the waveform scan, see the message type out, hear it spoken aloud

---

## Voice readout (optional)

Three TTS options are available in the Reveal tab:

| Provider          | Quality   | Setup                                                        |
| ----------------- | --------- | ------------------------------------------------------------ |
| **Browser**       | Basic     | None — works everywhere                                      |
| **Unreal Speech** | Good      | Free API key at [unrealspeech.com](https://unrealspeech.com) |
| **ElevenLabs**    | Excellent | Free API key at [elevenlabs.io](https://elevenlabs.io)       |

> ⚠️ **Never hardcode API keys in the source.** Keys are entered client-side and stored in localStorage only. If you fork this repo, do not commit a version with a hardcoded key.

---

## Technical details

| Property           | Value                       |
| ------------------ | --------------------------- |
| Sample rate        | 44,100 Hz                   |
| Bit depth          | 16-bit PCM                  |
| Channels           | Mono                        |
| Encoding duration  | 12 seconds                  |
| Max message length | 500 characters              |
| Capacity           | 529,200 bits (66,150 bytes) |

### Audio synthesis

All cover sounds are generated using the **Web Audio API** with no external files:

- **Pink noise** — 7-pole IIR filter on white noise
- **Bird calls** — frequency-modulated sine waves with glide
- **Rhythmic elements** — procedural kick, snare, hi-hat with envelope shaping
- **Atmospheric layers** — detuned oscillators with slow LFO modulation

### Share links

The share link approach encodes the entire WAV file as base64 in the URL hash fragment (`#whisper=...`). Because the hash is never sent to a server, the audio data stays entirely client-side. Links are long (~3MB as a URL string) but completely self-contained.

---

## Project structure

```
whisper.html    ← The entire application (HTML + CSS + JS, single file)
README.md       ← This file
LICENSE         ← MIT License
```

---

## Built with

- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) — synthesis, decoding, playback
- [Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API) — waveform visualisation
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API) — browser TTS
- [Claude](https://claude.ai) by Anthropic — AI collaborator (vibe-coded)

---

## Contributing

Contributions are welcome. A few ideas if you want to pick something up:

- [ ] Support for longer messages (multi-file encoding)
- [ ] Image steganography mode
- [ ] Message encryption layer (AES) before embedding
- [ ] Mobile PWA wrapper
- [ ] More synthesised cover sounds

Open an issue or submit a PR.

---

## License

MIT License — see [LICENSE](LICENSE) for full terms.

Free to use, fork, modify, and distribute. Credit appreciated but not required.

---

## Contact

Made by **thedigitalauteur**
📧 [thedigitalauteur@gmail.com](mailto:thedigitalauteur@gmail.com)

_Have an idea? Want to collaborate? Get in touch._
