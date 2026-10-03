# Login scene assets

These images were made for the Bird-Watcher login animation from the existing
`public/brand/watcher-munia-scene.jpg` composition. The anime scene and bird
poses were generated with OpenAI's built-in image generation tool on 2026-10-04.

- `scene-empty.jpg`: the illustrated scene with the branch clear, shown before arrival.
- `scene-perched.jpg`: the same scene with the munia perched, held after landing.
- `flight-up.png`, `flight-down.png`: transparent alternating flight poses.
- `landing.png`: transparent landing pose.

The scene PNGs were converted to JPEG at quality 86. The transparent poses were
resized to a 768px maximum edge with `sips`; their alpha channels were retained.
The animation sequence and final placement are defined in `src/app/(auth)/auth-scene.tsx`.
