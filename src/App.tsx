/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Play, Loader2 } from 'lucide-react';

const inputClass = "w-full mt-2 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-600";
const labelClass = "block";
const labelTextClass = "text-sm text-zinc-400";

export default function App() {
  const [file, setFile] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('The camera slowly pushes in, gentle wind moves the hair');
  const [seed, setSeed] = useState<number | null>(null);
  const [provider, setProvider] = useState('pruna');
  const [model, setModel] = useState('p-video-2');
  const [agnesModel, setAgnesModel] = useState('agnes-video-2.5-flash');
  const [duration, setDuration] = useState(5);
  const [resolution, setResolution] = useState('720p');
  const [fps, setFps] = useState(24);
  const [proMode, setProMode] = useState('speed');
  const [promptUpsampler, setPromptUpsampler] = useState('turbo');
  const [frames, setFrames] = useState(81);
  const [draft, setDraft] = useState(false);
  const [saveAudio, setSaveAudio] = useState(true);
  const [interpolate, setInterpolate] = useState(false);
  const [goFast, setGoFast] = useState(true);
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isWan = provider === 'pruna' && model === 'wan-i2v';
  const isPVideo2 = provider === 'pruna' && model === 'p-video-2';
  const isPVideo2Pro = provider === 'pruna' && model === 'p-video-2-pro';
  const isAgnes = provider === 'agnes';

  const costEstimate = estimateCost({ provider, model: isAgnes ? agnesModel : model, resolution, duration, draft });

  const handleGenerate = async () => {
    if (isAgnes && !file && !prompt) return;
    if (!isAgnes && !isPVideo2Pro && !file) return;
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt, seed, duration, image: file, provider,
          model: isAgnes ? agnesModel : model,
          resolution: isAgnes && agnesModel === 'agnes-video-2.5-flash' ? '720P' : resolution,
          fps, frames, draft, saveAudio, interpolate, goFast, aspectRatio, proMode, promptUpsampler,
        }),
      });

      const data = response.headers.get('content-type')?.includes('application/json')
        ? await response.json()
        : { error: `Video service returned HTTP ${response.status}` };
      if (!response.ok) {
        setError(data.error || 'Video generation failed');
        return;
      }
      if (!data.jobId) {
        setError('Video service did not return a generation job');
        return;
      }
      const result = await waitForVideo(data.jobId);
      if (result.status === 'failed') {
        setError(result.error);
        return;
      }
      setResult(result.videoUrl);
    } catch {
      setError('Failed to reach the video service');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8">
      <header className="flex justify-between items-center mb-16 border-b border-zinc-800 pb-8">
        <h1 className="text-2xl font-bold tracking-tight">VisionReel</h1>
        <nav className="flex gap-6 text-sm font-medium text-zinc-400">
          <span>Studio</span>
          <span>Gallery</span>
        </nav>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-2 gap-16">
        <section className="space-y-8">
          <div className="border border-zinc-800 rounded-2xl p-8 bg-zinc-900/50">
            <h2 className="text-lg font-semibold mb-6">Create</h2>
            <div className="space-y-6">
              <label className={labelClass}>
                <span className={labelTextClass}>Source Image{isAgnes || isPVideo2Pro ? ' (optional)' : ''}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => readImageFile(e.target.files?.[0], setFile)}
                  className="mt-2 w-full text-sm text-zinc-400"
                />
              </label>

              <label className={labelClass}>
                <span className={labelTextClass}>Provider</span>
                <select
                  value={provider}
                  onChange={(e) => {
                    const next = e.target.value;
                    setProvider(next);
                    if (next === 'pruna') {
                      setModel('p-video-2');
                      setResolution('720p');
                      setFps(24);
                    } else {
                      setResolution('720P');
                    }
                  }}
                  className={`${inputClass} text-white`}
                >
                  <option value="pruna">Pruna AI</option>
                  <option value="agnes">Agnes AI</option>
                </select>
              </label>

              {provider === 'pruna' && (
                <label className={labelClass}>
                  <span className={labelTextClass}>Model</span>
                  <select
                    value={model}
                    onChange={(e) => {
                      const next = e.target.value;
                      setModel(next);
                      setResolution(next === 'wan-i2v' ? '480p' : next === 'p-video-2-pro' ? '768p' : '720p');
                      setFps(next === 'wan-i2v' ? 16 : 24);
                    }}
                    className={`${inputClass} text-white`}
                  >
                    <option value="p-video-2">P-Video-2 (premium, 720p/1080p)</option>
                    <option value="p-video-2-pro">P-Video-2 Pro (480p/768p, audio)</option>
                    <option value="wan-i2v">Wan I2V (480p/720p)</option>
                  </select>
                </label>
              )}

              {isAgnes && (
                <label className={labelClass}>
                  <span className={labelTextClass}>Model</span>
                  <select
                    value={agnesModel}
                    onChange={(e) => {
                      const next = e.target.value;
                      setAgnesModel(next);
                      if (next === 'agnes-video-2.5-flash') setResolution('720P');
                    }}
                    className={`${inputClass} text-white`}
                  >
                    <option value="agnes-video-2.5-flash">Agnes 2.5 Flash (720P)</option>
                    <option value="agnes-video-2.5">Agnes 2.5 (720P/1080P)</option>
                  </select>
                </label>
              )}

              {isAgnes && (
                <p className="text-xs text-zinc-500">
                  With an image, Agnes runs in keyframe mode using it as the first frame; without one, it runs text-to-video.
                </p>
              )}

              <label className={labelClass}>
                <span className={labelTextClass}>Prompt</span>
                <input
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className={inputClass}
                  placeholder="Describe the motion..."
                />
              </label>

              {!isWan && (
                <label className={labelClass}>
                  <span className={labelTextClass}>
                    {isAgnes ? 'Duration (4–12 seconds)' : isPVideo2Pro ? 'Duration (5–15 seconds)' : 'Duration (1–20 seconds)'}
                  </span>
                  <input
                    type="number"
                    min={isAgnes ? 4 : isPVideo2Pro ? 5 : 1}
                    max={isAgnes ? 12 : isPVideo2Pro ? 15 : 20}
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className={inputClass}
                  />
                </label>
              )}

              {isWan && (
                <p className="text-xs text-zinc-500">
                  Output length ≈ {(frames / fps).toFixed(1)}s ({frames} frames at {fps} fps).
                </p>
              )}

              <div className="grid grid-cols-2 gap-4">
                {!isWan && (
                  <label className={labelClass}>
                    <span className={labelTextClass}>Seed</span>
                    <input
                      type="number"
                      value={seed ?? ''}
                      placeholder="Random"
                      onChange={(e) => setSeed(e.target.value === '' ? null : Number(e.target.value))}
                      className={inputClass}
                    />
                  </label>
                )}
                <label className={labelClass}>
                  <span className={labelTextClass}>Resolution</span>
                  <select
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    className={`${inputClass} text-white`}
                  >
                    {isWan && (
                      <>
                        <option value="480p">480p</option>
                        <option value="720p">720p</option>
                      </>
                    )}
                    {isPVideo2 && (
                      <>
                        <option value="720p">720p</option>
                        <option value="1080p">1080p</option>
                      </>
                    )}
                    {isPVideo2Pro && (
                      <>
                        <option value="480p">480p</option>
                        <option value="768p">768p</option>
                      </>
                    )}
                    {isAgnes && agnesModel === 'agnes-video-2.5-flash' && (
                      <option value="720P">720P</option>
                    )}
                    {isAgnes && agnesModel !== 'agnes-video-2.5-flash' && (
                      <>
                        <option value="720P">720P</option>
                        <option value="1080P">1080P</option>
                      </>
                    )}
                  </select>
                </label>
              </div>

              {isPVideo2 && (
                <>
                  <label className={labelClass}>
                    <span className={labelTextClass}>Frame rate</span>
                    <select
                      value={fps}
                      onChange={(e) => setFps(Number(e.target.value))}
                      className={`${inputClass} text-white`}
                    >
                      <option value={24}>24 fps</option>
                      <option value={48}>48 fps</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={draft}
                      onChange={(e) => setDraft(e.target.checked)}
                      className="rounded border-zinc-700 bg-zinc-950"
                    />
                    <span className={labelTextClass}>Draft mode (faster preview, half price)</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={saveAudio}
                      onChange={(e) => setSaveAudio(e.target.checked)}
                      className="rounded border-zinc-700 bg-zinc-950"
                    />
                    <span className={labelTextClass}>Include generated sound</span>
                  </label>
                </>
              )}

              {isPVideo2Pro && (
                <>
                  <label className={labelClass}>
                    <span className={labelTextClass}>Generation mode</span>
                    <select
                      value={proMode}
                      onChange={(e) => setProMode(e.target.value)}
                      className={`${inputClass} text-white`}
                    >
                      <option value="speed">Speed</option>
                      <option value="quality">Quality</option>
                      <option value="cost">Cost</option>
                    </select>
                  </label>
                  <label className={labelClass}>
                    <span className={labelTextClass}>Prompt upsampler</span>
                    <select
                      value={promptUpsampler}
                      onChange={(e) => setPromptUpsampler(e.target.value)}
                      className={`${inputClass} text-white`}
                    >
                      <option value="turbo">Turbo</option>
                      <option value="max">Max</option>
                      <option value="off">Off</option>
                    </select>
                  </label>
                  <p className="text-xs text-zinc-500">P-Video-2 Pro generates audio automatically and uses 24 fps.</p>
                </>
              )}

              {isWan && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <label className={labelClass}>
                      <span className={labelTextClass}>Frame rate (5–30 fps)</span>
                      <input
                        type="number"
                        min={5}
                        max={30}
                        value={fps}
                        onChange={(e) => setFps(Number(e.target.value))}
                        className={inputClass}
                      />
                    </label>
                    <label className={labelClass}>
                      <span className={labelTextClass}>Frames (81–121)</span>
                      <input
                        type="number"
                        min={81}
                        max={121}
                        value={frames}
                        onChange={(e) => setFrames(Number(e.target.value))}
                        className={inputClass}
                      />
                    </label>
                  </div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={interpolate}
                      onChange={(e) => setInterpolate(e.target.checked)}
                      className="rounded border-zinc-700 bg-zinc-950"
                    />
                    <span className={labelTextClass}>Smooth motion interpolation (30 fps output)</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={goFast}
                      onChange={(e) => setGoFast(e.target.checked)}
                      className="rounded border-zinc-700 bg-zinc-950"
                    />
                    <span className={labelTextClass}>Fast processing mode</span>
                  </label>
                </>
              )}

              {isAgnes && (
                <label className={labelClass}>
                  <span className={labelTextClass}>Aspect ratio</span>
                  <select
                    value={aspectRatio}
                    onChange={(e) => setAspectRatio(e.target.value)}
                    className={`${inputClass} text-white`}
                  >
                    {['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'].map((ratio) => (
                      <option key={ratio} value={ratio}>{ratio}</option>
                    ))}
                  </select>
                </label>
              )}

              <div className="text-sm text-zinc-400">
                Estimated Cost: <span className="font-semibold text-white">{costEstimate}</span>
              </div>

              <button
                onClick={handleGenerate}
                disabled={loading || (!file && !isAgnes)}
                className="w-full bg-white text-black font-semibold rounded-lg py-3 flex items-center justify-center gap-2 hover:bg-zinc-200 disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <Play className="w-4 h-4" />}
                Generate Reel
              </button>
              {loading && (
                <p className="text-xs text-zinc-500 text-center">Generation can take several minutes — you can wait here.</p>
              )}
              {error && (
                <p className="text-sm text-red-400">{error}</p>
              )}
            </div>
          </div>
        </section>

        <section className="border border-zinc-800 rounded-2xl p-8 bg-zinc-900/50 flex flex-col items-center justify-center min-h-[400px]">
          {result ? (
            <div className="space-y-4 w-full">
              <video
                src={result}
                controls
                className="rounded-xl w-full"
                onError={() => setError('The video file could not be played. Try the download link below.')}
              />
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

async function waitForVideo(jobId: string) {
  const deadline = Date.now() + 10 * 60 * 1000;
  for (;;) {
    const response = await fetch(`api/generate-video/${encodeURIComponent(jobId)}`);
    const data = response.headers.get('content-type')?.includes('application/json')
      ? await response.json()
      : { status: 'failed', error: `Video service returned HTTP ${response.status}` };
    if (!response.ok || data.status === 'failed') {
      return { status: 'failed' as const, error: data.error || 'Video generation failed' };
    }
    if (data.status === 'completed' && data.videoUrl) {
      return { status: 'completed' as const, videoUrl: data.videoUrl as string };
    }
    if (Date.now() > deadline) {
      return { status: 'failed' as const, error: 'Video generation timed out' };
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

function estimateCost(options: { provider: string; model: string; resolution: string; duration: number; draft: boolean }) {
  if (options.provider === 'agnes') {
    if (options.model === 'agnes-video-2.5-flash') return '$0.00';
    const rate = options.resolution === '1080P' ? 0.04 : 0.025;
    return `$${(rate * options.duration).toFixed(3)}`;
  }
  if (options.model === 'wan-i2v') return options.resolution === '720p' ? '$0.11' : '$0.05';
  if (options.model === 'p-video-2-pro') {
    const rate = options.resolution === '768p' ? 0.075 : 0.02;
    return `$${(rate * options.duration).toFixed(3)}`;
  }
  const rate = options.resolution === '1080p' ? 0.05 : 0.015;
  const total = rate * options.duration * (options.draft ? 0.5 : 1);
  return `$${total.toFixed(3)}`;
}

function readImageFile(file: File | undefined, setFile: (value: string | null) => void) {
  if (!file) return;
  const reader = new FileReader();
  reader.onloadend = () => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_DIMENSION = 1024;
      const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
      const width = Math.round(img.width * scale);
      const height = Math.round(img.height * scale);

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      setFile(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.src = reader.result as string;
  };
  reader.readAsDataURL(file);
}
