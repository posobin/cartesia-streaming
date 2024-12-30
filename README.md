## Repro steps

1. `npm install`
2. `CARTESIA_API_KEY=... npm exec vitest run`
3. `ffmpeg -f f32le -ac 1 -i ./src/test-output/test-output-stream.raw out.wav`
4. play `out.wav`
