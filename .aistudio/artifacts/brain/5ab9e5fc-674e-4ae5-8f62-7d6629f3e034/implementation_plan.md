# VisionReel: AI Video Generator

VisionReel is a minimalist application designed to help creatives turn images into videos for their portfolios and showreels. It provides a simple, clean interface to upload images, configure generation settings, and preview results using external AI video models.

### User Review & Critical Decisions

> [!IMPORTANT]
> The app is designed for minimalist aesthetic and portfolio-oriented workflows.

- **Confirmed Decision 1**: Focus on creative portfolio/showreel generation.
- **Confirmed Decision 2**: Minimalist, clean editorial aesthetic (per user preference).
- **Open Choice 1**: I will integrate with Pruna AI and Agnes AI Video 2.5 Flash using server-side proxy routes. (Assumed API endpoints will be used based on service documentation).

### 1. Overview & Core Concept

- **What It Does**: Allows users to transform static portfolio images into dynamic video clips for showreels.
- **Target Audience**: Creative professionals (video editors, designers, artists).
- **Key Value**: Simplified generation workflow with granular controls (prompts, duration) for precise output.

### 2. User Experience & Visual Design

- **Key User Flows**: 
    1. Upload source image.
    2. Configure parameters (Prompts, Duration, etc.).
    3. Trigger generation.
    4. View/Download generated video.
- **Visual Identity & Theme**:
    - *Aesthetic*: Minimalist Editorial. Stark contrast, clean layout, ample white space.
    - *Palette*: Monochrome (`#050505` black, `#FFFFFF` white, `#E4E4E7` grays).
    - *Typography*: Geometric sans-serif for display (`Plus Jakarta Sans`), readable sans for body (`Inter`/`DM Sans`).
- **Feedback & Motion**: Smooth transitions for generation states, simple progress indicators.

### 3. Key Product Decisions & Trade-Offs

- **Decision 1**: Backend Proxy for API Calls
    - *Chosen Approach*: All external API calls (Pruna/Agnes) will be routed through an Express.js backend.
    - *Why*: Keeps API keys secure and centralizes API interaction logic.
- **Decision 2**: Minimalist UI
    - *Chosen Approach*: Clean split-pane layout (Controls | Preview).
    - *Why*: Direct focus on the generation process, avoids clutter.

### 4. Technical Architecture & Data Strategy

```
┌─────────────────────┐   ┌───────────────────┐   ┌───────────────────────────┐
│ Browser (Frontend)  │◄─►│ Express (Backend) │◄─►│ External AI API Services  │
│ (React/Tailwind)    │   │ (API Proxy)       │   │ (Pruna AI / Agnes AI)     │
└─────────────────────┘   └───────────────────┘   └───────────────────────────┘
```

- **Data Model & State**: Local React state for form inputs, image previews, and generation status. Server-side session state (if needed) for long-running video generation operations.
- **Interactive Component & State Mapping**: 
    - `GeneratorForm.tsx`: Manages input state (image, prompt, duration) and submission.
    - `VideoDisplay.tsx`: Manages video loading states, playback, and error boundaries.
- **Key Integrations**: Server-side proxy calls to external video generation APIs.
