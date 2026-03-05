/*
  api/config.js — Vercel Serverless Function
  Exposes non-secret public config to the browser.
  The Unreal Speech API key is safe to expose client-side
  (it's a read/usage key, not an account secret) but keeping
  it in env vars means it never appears in your source code.

  Environment variables required:
    UNREAL_SPEECH_API_KEY  — your Unreal Speech bearer token

  MIT License © 2025 thedigitalauteur
*/

export default function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  return res.status(200).json({
    unrealSpeechKey: process.env.UNREAL_SPEECH_API_KEY || "",
  });
}
