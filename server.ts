import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";

const PRUNA_BASE = "https://api.pruna.ai/v1";
const AGNES_BASE = "https://apihub.agnes-ai.com/v1";
const AGNES_POLL_BASE = "https://apihub.agnes-ai.com/agnesapi";
const MAX_WAIT_MS = 10 * 60 * 1000;
const generatedVideoProviders = new Map<string, "pruna" | "agnes">();

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "10mb" }));

  app.post("/api/generate-video", async (req, res) => {
    const { provider, model } = req.body;
    if (provider === "pruna") {
      await handlePruna(req.body, res);
      return;
    }
    if (provider === "agnes") {
      await handleAgnes(req.body, res);
      return;
    }
    res.status(400).json({ error: "Unknown provider" });
  });

  // Proxied playback: Pruna delivery URLs require the apikey header,
  // which a plain <video> tag cannot send.
  app.get("/api/video", async (req, res) => {
    const target = String(req.query.u || "");
    const provider = req.query.provider === "agnes" ? "agnes" : "pruna";
    let host = "";
    try {
      host = new URL(target).hostname;
    } catch {
      res.status(400).json({ error: "Invalid video URL" });
      return;
    }
    const allowedHost = generatedVideoProviders.get(target) === provider || (provider === "agnes"
      ? host === "apihub.agnes-ai.com" || host.endsWith(".agnes-ai.com")
      : host.endsWith(".pruna.ai") || host === "pruna.ai");
    if (!allowedHost) {
      res.status(400).json({ error: "Video host not allowed" });
      return;
    }
    const apiKey = provider === "agnes" ? process.env.AGNES_API_KEY : process.env.PRUNA_API_KEY;
    const secretName = provider === "agnes" ? "AGNES_API_KEY" : "PRUNA_API_KEY";
    if (!apiKey) {
      res.status(500).json({ error: `${secretName} is not configured` });
      return;
    }
    const authHeaders: Record<string, string> = provider === "agnes"
      ? { Authorization: `Bearer ${apiKey}` }
      : { apikey: apiKey };
    try {
      const range = req.headers.range;
      const upstream = await fetch(target, {
        headers: { ...authHeaders, ...(range ? { Range: range } : {}) },
      });
      if (!upstream.ok || !upstream.body) {
        res.status(502).json({ error: `Provider video fetch failed (${upstream.status})` });
        return;
      }
      const contentType = upstream.headers.get("Content-Type") || "";
      if (!contentType.startsWith("video/")) {
        await upstream.body.cancel();
        res.status(502).json({ error: `Provider returned ${contentType || "an unknown format"}, not a video` });
        return;
      }
      res.status(upstream.status);
      for (const name of ["Content-Type", "Content-Length", "Content-Range", "Accept-Ranges"]) {
        const value = upstream.headers.get(name);
        if (value) res.setHeader(name, value);
      }
      if (!upstream.headers.get("Content-Type")) res.setHeader("Content-Type", "video/mp4");
      for await (const chunk of upstream.body) res.write(chunk);
      res.end();
    } catch (error) {
      console.error("Video proxy error:", error);
      res.status(502).json({ error: "Failed to fetch video" });
    }
  });

  if (process.env.NODE_ENV === "production") {
    app.use(express.static("dist"));
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

async function handlePruna(body: Record<string, unknown>, res: express.Response) {
  const apiKey = process.env.PRUNA_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "PRUNA_API_KEY is not configured" });
    return;
  }
  const image = body.image as string | undefined;
  if (!body.prompt || (body.model !== "p-video-2-pro" && !image)) {
    res.status(400).json({ error: body.model === "p-video-2-pro" ? "prompt is required" : "prompt and image are required" });
    return;
  }
  const model = body.model === "wan-i2v" || body.model === "p-video-2-pro" ? body.model : "p-video-2";
  try {
    const imageUrl = image ? await uploadToPruna(image, apiKey) : undefined;
    const input = model === "wan-i2v"
      ? wanInput(body, imageUrl as string)
      : model === "p-video-2-pro"
        ? pVideo2ProInput(body, imageUrl)
        : pVideo2Input(body, imageUrl as string);
    const created = await prunaJson("/predictions", apiKey, { Model: model }, { input });
    const deliveryUrl = await pollPruna(created.get_url as string, apiKey);
    await assertVideoUrl(deliveryUrl, { apikey: apiKey });
    generatedVideoProviders.set(deliveryUrl, "pruna");
    res.json({ videoUrl: `api/video?provider=pruna&u=${encodeURIComponent(deliveryUrl)}`, model, provider: "pruna" });
  } catch (error) {
    console.error("Pruna error:", error);
    res.status(502).json({ error: error instanceof Error ? error.message : "Pruna generation failed" });
  }
}

function pVideo2Input(body: Record<string, unknown>, imageUrl: string) {
  return {
    prompt: body.prompt,
    image: imageUrl,
    duration: Number(body.duration) || 5,
    resolution: body.resolution === "1080p" ? "1080p" : "720p",
    fps: body.fps === 48 ? 48 : 24,
    seed: body.seed === "" || body.seed === undefined ? undefined : Number(body.seed),
    draft: body.draft === true,
    save_audio: body.saveAudio !== false,
  };
}

function pVideo2ProInput(body: Record<string, unknown>, imageUrl: string | undefined) {
  return {
    prompt: body.prompt,
    ...(imageUrl ? { image: imageUrl } : {}),
    duration: Math.min(15, Math.max(5, Number(body.duration) || 5)),
    resolution: body.resolution === "480p" ? "480p" : "768p",
    mode: body.proMode === "quality" || body.proMode === "cost" ? body.proMode : "speed",
    prompt_upsampler: body.promptUpsampler === "off" || body.promptUpsampler === "max" ? body.promptUpsampler : "turbo",
    aspect_ratio: typeof body.aspectRatio === "string" ? body.aspectRatio : "16:9",
    ...(body.seed === "" || body.seed === undefined ? {} : { seed: Number(body.seed) }),
  };
}

function wanInput(body: Record<string, unknown>, imageUrl: string) {
  return {
    prompt: body.prompt,
    image: imageUrl,
    resolution: body.resolution === "720p" ? "720p" : "480p",
    frames_per_second: Math.min(30, Math.max(5, Number(body.fps) || 16)),
    num_frames: Math.min(121, Math.max(81, Number(body.frames) || 81)),
    interpolate_output: body.interpolate === true,
    go_fast: body.goFast !== false,
  };
}

async function handleAgnes(body: Record<string, unknown>, res: express.Response) {
  const apiKey = process.env.AGNES_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "AGNES_API_KEY is not configured" });
    return;
  }
  if (!body.prompt) {
    res.status(400).json({ error: "prompt is required" });
    return;
  }
  try {
    const model = body.model === "agnes-video-2.5-flash" ? "agnes-video-2.5-flash" : "agnes-video-2.5";
    const image = body.image as string | undefined;
    const useKeyframe = Boolean(image);
    let firstFrame: string | undefined;
    if (useKeyframe) {
      const prunaKey = process.env.PRUNA_API_KEY;
      if (!prunaKey) {
        res.status(500).json({ error: "Agnes image-to-video needs PRUNA_API_KEY for image upload, or use text mode without an image" });
        return;
      }
      firstFrame = await uploadToPruna(image as string, prunaKey);
    }
    const created = await agnesJson("/videos", apiKey, {
      model,
      prompt: body.prompt,
      mode: useKeyframe ? "keyframe" : "text",
      seconds: String(Math.min(12, Math.max(4, Number(body.duration) || 5))),
      size: model === "agnes-video-2.5-flash" ? "720P" : body.resolution === "1080P" ? "1080P" : "720P",
      aspect_ratio: typeof body.aspectRatio === "string" ? body.aspectRatio : "16:9",
      seed: body.seed === "" || body.seed === undefined ? undefined : Number(body.seed),
      ...(firstFrame ? { first_frame: firstFrame } : {}),
    });
    const url = await pollAgnes(created.video_id as string, apiKey, model);
    await assertVideoUrl(url, { Authorization: `Bearer ${apiKey}` });
    generatedVideoProviders.set(url, "agnes");
    res.json({ videoUrl: `api/video?provider=agnes&u=${encodeURIComponent(url)}`, model, provider: "agnes" });
  } catch (error) {
    console.error("Agnes error:", error);
    res.status(502).json({ error: error instanceof Error ? error.message : "Agnes generation failed" });
  }
}

function upstreamMessage(data: unknown, fallback: string) {
  const err = (data as { error?: unknown; message?: unknown } | null)?.error
    ?? (data as { message?: unknown } | null)?.message;
  if (typeof err === "string" && err) return err;
  if (err !== undefined && err !== null) return JSON.stringify(err);
  return fallback;
}

async function uploadToPruna(dataUrl: string, apiKey: string) {
  const { buffer, mime } = decodeDataUrl(dataUrl);
  const form = new FormData();
  form.append("content", new Blob([buffer], { type: mime }), mime === "image/png" ? "upload.png" : "upload.jpg");
  const response = await fetch(`${PRUNA_BASE}/files`, {
    method: "POST",
    headers: { apikey: apiKey },
    body: form,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(upstreamMessage(data, "Image upload failed"));
  const url = data.urls?.get as string | undefined;
  if (!url) throw new Error("Image upload returned no URL");
  return url;
}

function decodeDataUrl(dataUrl: string) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("Image must be a JPEG, PNG, or WebP data URL");
  return { buffer: Buffer.from(match[2], "base64"), mime: match[1] };
}

async function prunaJson(path: string, apiKey: string, headers: Record<string, string>, body?: unknown) {
  const response = await fetch(`${PRUNA_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey, ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(upstreamMessage(data, `Pruna request failed (${response.status})`));
  return data;
}

async function pollPruna(statusUrl: string, apiKey: string) {
  const started = Date.now();
  for (;;) {
    const response = await fetch(statusUrl, { headers: { apikey: apiKey } });
    const data = await response.json();
    if (!response.ok) throw new Error(upstreamMessage(data, "Pruna status check failed"));
    if (data.status === "succeeded") {
      if (!data.generation_url) throw new Error("Pruna finished without a video URL");
      return data.generation_url as string;
    }
    if (data.status === "failed") throw new Error(upstreamMessage(data, "Pruna generation failed"));
    if (Date.now() - started > MAX_WAIT_MS) throw new Error("Pruna generation timed out");
    await sleep(5000);
  }
}

async function agnesJson(path: string, apiKey: string, body: unknown) {
  const response = await fetch(`${AGNES_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(upstreamMessage(data, `Agnes request failed (${response.status})`));
  return data;
}

async function pollAgnes(videoId: string, apiKey: string, model: string) {
  if (!videoId) throw new Error("Agnes returned no video ID");
  const started = Date.now();
  for (;;) {
    const response = await fetch(
      `${AGNES_POLL_BASE}?video_id=${encodeURIComponent(videoId)}&model_name=${model}`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );
    const data = await response.json();
    if (!response.ok) throw new Error(upstreamMessage(data, "Agnes status check failed"));
    if (data.status === "completed") {
      const url = data.url || data.metadata?.url;
      if (!url) throw new Error("Agnes finished without a video URL");
      return url as string;
    }
    if (data.status === "failed") throw new Error(upstreamMessage(data, "Agnes generation failed"));
    if (Date.now() - started > MAX_WAIT_MS) throw new Error("Agnes generation timed out");
    await sleep(2000);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function assertVideoUrl(url: string, headers: Record<string, string>) {
  const type = await probeContentType(url, headers);
  if (type && !type.startsWith("video/")) {
    throw new Error(`Provider returned a non-video URL (content-type: ${type})`);
  }
}

async function probeContentType(url: string, headers: Record<string, string>) {
  const head = await fetch(url, { method: "HEAD", headers });
  if (head.ok) return head.headers.get("Content-Type");
  const partial = await fetch(url, { headers: { ...headers, Range: "bytes=0-0" } });
  if (partial.ok || partial.status === 206) {
    const type = partial.headers.get("Content-Type");
    await partial.body?.cancel();
    return type;
  }
  return null;
}

startServer();
