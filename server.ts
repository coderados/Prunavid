import express from 'express';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  
  // Create Vite server in middleware mode
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });

  // Use vite's connect instance as middleware
  app.use(vite.middlewares);

  // API Routes (Proxy for AI services)
  app.use(express.json());

  app.post('/api/generate-video', async (req, res) => {
    const { prompt, duration, image, provider } = req.body;
    const apiKey = provider === 'agnes' ? process.env.AGNES_API_KEY : process.env.PRUNA_API_KEY;
    // Map provider+model to specific Pruna endpoint
    let url = provider === 'agnes' ? 'https://api.agnes.ai/v1/generate' : 'https://api.pruna.ai/v1/generate';
    if (provider === 'pruna') {
        const model = req.body.model || 'p2'; // Default to p2
        url = `https://api.pruna.ai/v1/${model}/generate`;
    }

    console.log(`Proxying to ${provider} (${req.body.model}) at ${url}`);
    console.log('Request Body:', JSON.stringify({ prompt, duration, image, provider }));

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ prompt, duration, image }),
      });
      const data = await response.json();
      console.log('API Response:', data);
      res.json(data);
    } catch (error) {
      console.error('API Error:', error);
      res.status(500).json({ error: 'Failed to generate video' });
    }
  });

  app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
  });
}

startServer();
