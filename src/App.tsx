/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { motion } from 'motion/react';
import { Upload, Play, Loader2 } from 'lucide-react';

export default function App() {
  const [file, setFile] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('high quality detail, realistic');
  const [negativePrompt, setNegativePrompt] = useState('low quality, cartoon, deformed');
  const [seed, setSeed] = useState(1234);
  const [resolution, setResolution] = useState('720p');
  const [duration, setDuration] = useState(4);
  const [provider, setProvider] = useState('agnes');
  const [model, setModel] = useState('p2');
  const [includeAudio, setIncludeAudio] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const costEstimate = { '480p': '$0.02', '720p': '$0.05', '1080p': '$0.10' }[resolution] || '$0.05';

  const handleGenerate = async () => {
    if (!file) return;
    setLoading(true);
    
    const response = await fetch('/api/generate-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, negativePrompt, seed, resolution, duration, image: file, provider, model, includeAudio }),
    });
    
    const data = await response.json();
    setResult(data.videoUrl || 'generated_video_placeholder.mp4');
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8">
      <header className="flex justify-between items-center mb-16 border-b border-zinc-800 pb-8">
        <h1 className="text-2xl font-bold tracking-tight">VisionReel</h1>
        <nav className="flex gap-6 text-sm font-medium text-zinc-400">
          <a href="#" className="hover:text-white">Studio</a>
          <a href="#" className="hover:text-white">Gallery</a>
        </nav>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-2 gap-16">
        <section className="space-y-8">
          <div className="border border-zinc-800 rounded-2xl p-8 bg-zinc-900/50">
            <h2 className="text-lg font-semibold mb-6">Create</h2>
            <div className="space-y-6">
              <label className="block">
                <span className="text-sm text-zinc-400">Source Image</span>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        const img = new Image();
                        img.onload = () => {
                          const canvas = document.createElement('canvas');
                          const MAX_WIDTH = 1024;
                          let width = img.width;
                          let height = img.height;
                          
                          if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                          }
                          
                          canvas.width = width;
                          canvas.height = height;
                          const ctx = canvas.getContext('2d');
                          ctx?.drawImage(img, 0, 0, width, height);
                          setFile(canvas.toDataURL('image/jpeg', 0.8));
                        };
                        img.src = reader.result as string;
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="mt-2 w-full text-sm text-zinc-400"
                />
              </label>

                <label className="block">
                <span className="text-sm text-zinc-400">Provider</span>
                <select 
                  onChange={(e) => {
                    setProvider(e.target.value);
                    if (e.target.value !== 'pruna') setModel('p2');
                  }}
                  className="w-full mt-2 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-white"
                >
                  <option value="agnes">Agnes AI</option>
                  <option value="pruna">Pruna AI</option>
                </select>
              </label>

              {provider === 'pruna' && (
                <label className="block">
                  <span className="text-sm text-zinc-400">Model</span>
                  <select 
                    value={model}
                    onChange={(e) => {
                      const newModel = e.target.value;
                      setModel(newModel);
                      if (newModel === 'wan-i2v' && resolution === '1080p') {
                        setResolution('720p');
                      }
                      if (newModel !== 'wan-i2v' && resolution === '480p') {
                        setResolution('720p');
                      }
                    }}
                    className="w-full mt-2 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-white"
                  >
                    <option value="p2">Pruna P2</option>
                    <option value="wan-i2v">Wan I2V</option>
                  </select>
                </label>
              )}
              
              <label className="block">
                <span className="text-sm text-zinc-400">Positive Prompt</span>
                <input 
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="w-full mt-2 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-600"
                  placeholder="Describe the motion..."
                />
              </label>

              <label className="block">
                <span className="text-sm text-zinc-400">Negative Prompt</span>
                <input 
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  className="w-full mt-2 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-600"
                  placeholder="What to avoid..."
                />
              </label>

              <label className="block">
                <span className="text-sm text-zinc-400">Duration (seconds)</span>
                <input 
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full mt-2 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-600"
                />
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-sm text-zinc-400">Seed</span>
                  <input 
                    type="number"
                    value={seed}
                    onChange={(e) => setSeed(Number(e.target.value))}
                    className="w-full mt-2 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-600"
                  />
                </label>
                <label className="block">
                  <span className="text-sm text-zinc-400">Resolution</span>
                  <select 
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    className="w-full mt-2 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-white"
                  >
                    {model === 'wan-i2v' ? (
                      <>
                        <option value="480p">480p</option>
                        <option value="720p">720p</option>
                      </>
                    ) : (
                      <>
                        <option value="720p">720p</option>
                        <option value="1080p">1080p</option>
                      </>
                    )}
                  </select>
                </label>
              </div>

              <div className="text-sm text-zinc-400">
                Estimated Cost: <span className="font-semibold text-white">{costEstimate}</span>
              </div>

              <label className="flex items-center gap-2 mb-4">
                <input 
                  type="checkbox"
                  checked={includeAudio}
                  onChange={(e) => setIncludeAudio(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-950"
                />
                <span className="text-sm text-zinc-400">Include Audio</span>
              </label>

              <button 
                onClick={handleGenerate}
                disabled={loading}
                className="w-full bg-white text-black font-semibold rounded-lg py-3 flex items-center justify-center gap-2 hover:bg-zinc-200 disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <Play className="w-4 h-4" />}
                Generate Reel
              </button>
            </div>
          </div>
        </section>

        <section className="border border-zinc-800 rounded-2xl p-8 bg-zinc-900/50 flex flex-col items-center justify-center min-h-[400px]">
          {result ? (
            <div className="space-y-4 w-full">
              <video src={result} controls className="rounded-xl w-full" />
              <a href={result} download className="block text-center bg-zinc-800 hover:bg-zinc-700 py-2 rounded-lg text-sm">Download Video</a>
            </div>
          ) : (
            <div className="text-center text-zinc-500">
              <Play className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>Your generated video will appear here</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

