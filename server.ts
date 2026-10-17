import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "10mb" }));

  app.post("/api/generate-video", async (req, res) => {
    const { prompt, negativePrompt, seed, resolution, duration, image, provider, model, includeAudio } = req.body;
    if (!prompt || !image) {
      res.status(400).json({ error: "prompt and image are required" });
      return;
    }
    const apiKey = provider === "agnes" ? process.env.AGNES_API_KEY : process.env.PRUNA_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: `${provider === "agnes" ? "AGNES_API_KEY" : "PRUNA_API_KEY"} is not configured` });
      return;
    }

    const url = resolveGenerateUrl(provider, model);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ prompt, negativePrompt, seed, resolution, duration, image, model, includeAudio }),
      });
      const data = await response.json();
      if (!response.ok) {
        res.status(response.status).json({ error: data.error || "Video generation failed" });
        return;
      }
      res.json(data);
    } catch (error) {
      console.error("API Error:", error);
      res.status(500).json({ error: "Failed to generate video" });
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

function resolveGenerateUrl(provider: string, model: string) {
  if (provider === "agnes") return "https://api.agnes.ai/v1/generate";
  return `https://api.pruna.ai/v1/${model || "p2"}/generate`;
}

startServer();
