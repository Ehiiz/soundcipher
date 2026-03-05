/*
  api/sign.js — Vercel Serverless Function
  Generates a signed Cloudinary upload signature server-side.
  Your API secret never leaves this function — it's read from
  Vercel environment variables, never exposed to the browser.

  Environment variables required (set in Vercel dashboard):
    CLOUDINARY_API_KEY     — your Cloudinary API key
    CLOUDINARY_API_SECRET  — your Cloudinary API secret
    CLOUDINARY_CLOUD_NAME  — dpcfxqiov

  How it works:
    1. Browser calls POST /api/sign with { folder, timestamp }
    2. This function signs those params with your API secret
    3. Returns { signature, apiKey, timestamp, cloudName }
    4. Browser uses those to upload directly to Cloudinary
       (Cloudinary verifies the signature server-side)

  MIT License © 2025 thedigitalauteur
*/

import crypto from "crypto";

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

  if (!apiSecret || !apiKey || !cloudName) {
    console.error("Missing Cloudinary env vars");
    return res.status(500).json({ error: "Server misconfigured" });
  }

  // Timestamp must be within 1 hour of Cloudinary's clock
  const timestamp = Math.round(Date.now() / 1000);
  const folder = "whisper";

  // Params to sign — must be sorted alphabetically, secret appended at end
  // Cloudinary signature spec: SHA1(param_string + api_secret)
  const paramsToSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;

  // SHA-1 digest (not HMAC — Cloudinary appends the secret to the string)
  const signature = crypto
    .createHash("sha1")
    .update(paramsToSign)
    .digest("hex");

  return res.status(200).json({
    signature,
    apiKey,
    timestamp,
    cloudName,
    folder,
  });
}
