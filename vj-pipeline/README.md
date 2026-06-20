# Floating Portrait — ComfyUI VJ Pipeline

Automated build for "Floating Portrait" VJ loops (ingi.ai style): stylised
editorial portraits on a neutral plate, animated with **Wan 2.2 I2V**, looped
seamlessly for **Resolume Arena**.

Target machine: Windows, RTX 5080 (16 GB), ComfyUI Desktop with base dir at
`C:\Users\<user>\Documents\ComfyUI`.

## Pipeline at a glance

```
prompts.txt
   │  (one portrait prompt per line)
   ▼
[Workflow 1] portrait_gen.json   SDXL → Inspyrenet matte → composite on #5a6470
   │  PNG portrait on flat plate
   ▼
[Workflow 2] wan_i2v.json        Wan 2.2 ti2v-5B  image → 5 s video
   │  MP4 / frames
   ▼
[vj_portrait_batch.py]           queue, poll, chain, collect
   │
   ▼
[FFmpeg post]                    ping-pong loop → HAP encode
   ▼
output/resolume_ready/*.mov
```

## Files

| File | Step | Purpose |
|------|------|---------|
| `inventory_comfyui.py` | 1 | Inventory: custom nodes, models, VRAM, Wan-2.2 presence check |
| `portrait_gen.json`    | 2 | Workflow 1 — editorial portrait + background cleanup (API format) |
| `wan_i2v.json`         | 3 | Workflow 2 — Wan 2.2 I2V animation (API format) |
| `vj_portrait_batch.py` | 4-5 | Batch runner + FFmpeg loop/HAP export |
| `prompts.txt`          | 4 | One portrait prompt per line |

## Model requirements

Portrait (Workflow 1):
- `sd_xl_base_1.0.safetensors` (checkpoints) — present ✓
- Custom node **ComfyUI-Inspyrenet-Rembg** (`InspyrenetRembg`) — install via Manager

Wan 2.2 ti2v-5B (Workflow 2):
- `wan2.2_ti2v_5B_fp16.safetensors` → `models/diffusion_models/`
- `wan2.2_vae.safetensors` → `models/vae/`  (5B uses its OWN vae, not wan_2.1_vae)
- `umt5_xxl_fp8_e4m3fn_scaled.safetensors` (text_encoders) — present ✓

Download source: https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged

## Workflow 1 — `portrait_gen.json` patch points

API-format prompt graph (directly POST-able to `/prompt`). Stable node IDs:

| Node | class_type | Role / patch point |
|------|-----------|--------------------|
| 4  | CheckpointLoaderSimple | SDXL checkpoint |
| 5  | EmptyLatentImage | 832×1216 portrait |
| 6  | CLIPTextEncode | **positive prompt** — batch runner overrides `inputs.text` per `prompts.txt` line |
| 7  | CLIPTextEncode | negative prompt |
| 3  | KSampler | **seed** — batch runner randomizes `inputs.seed`; 30 steps, cfg 6.5, dpmpp_2m/karras |
| 8  | VAEDecode | raw portrait |
| 9  | InspyrenetRembg | subject matte (outputs IMAGE rgba + MASK) |
| 10 | EmptyImage | flat plate, `color: 5923952` == `0x5a6470` |
| 11 | ImageCompositeMasked | subject (8) over plate (10) via mask (9) |
| 12 | SaveImage | `floating_portrait/portrait` prefix |

To change the studio plate colour: set node 10 `inputs.color` to the integer
value of your hex (e.g. `0x5a6470` → `5923952`).

## Workflow 2 — `wan_i2v.json` patch points

Wan 2.2 **ti2v-5B** image-to-video, 832×1216, 121 frames ≈ 5 s @ 24 fps.
Faithful to the official Comfy template (incl. `ModelSamplingSD3` shift 8.0).

| Node | class_type | Role / patch point |
|------|-----------|--------------------|
| 37 | UNETLoader | `wan2.2_ti2v_5B_fp16.safetensors` |
| 38 | CLIPLoader | `umt5_xxl_fp8...` (type `wan`) |
| 39 | VAELoader | `wan2.2_vae.safetensors` (5B's own VAE) |
| 54 | ModelSamplingSD3 | sigma shift 8.0 |
| 6  | CLIPTextEncode | **motion prompt** — runner overrides `inputs.text` (`--motion`) |
| 7  | CLIPTextEncode | negative — anti camera-move / morphing |
| 52 | LoadImage | **start image** — runner sets `inputs.image` to the uploaded portrait |
| 55 | Wan22ImageToVideoLatent | width/height/**length** (121 = 5 s @ 24 fps, 4n+1) |
| 3  | KSampler | seed; 30 steps, cfg 5.0, euler/simple, denoise 1.0 |
| 8  | VAEDecode | frames |
| 57 | VHS_VideoCombine | h264 mp4, `wan_i2v/clip` prefix, 24 fps |

Lower VRAM / faster: drop node 55 `length` (e.g. 81 → ~3.4 s) or node 3 `steps`.

## Batch runner — `vj_portrait_batch.py` (Steps 4 + 5)

Pure stdlib (urllib) + FFmpeg on PATH. No `pip install` needed. ComfyUI must be
running (server on `127.0.0.1:8188`).

Per `prompts.txt` line it: queues Workflow 1 → polls `/history` → downloads the
portrait → re-uploads it as a LoadImage input → queues Workflow 2 → saves the
clip to `output/floating_portraits/` → FFmpeg ping-pong loop → HAP `.mov` in
`output/resolume_ready/`.

```powershell
# default: HAP hap_q .mov for Resolume Arena
python vj_portrait_batch.py

# high-quality MP4 instead (for Resolume Alley -> DXV3)
python vj_portrait_batch.py --no-encode

# test with the first 2 prompts, custom motion
python vj_portrait_batch.py --limit 2 --motion "slow hair drift, static camera, plain background"
```

Flags: `--prompts`, `--server`, `--motion`, `--fps` (24), `--no-encode`,
`--no-resume`, `--limit N`, `--timeout` (s/job).

**Resume:** progress is tracked in `output/.batch_state.json` and by checking
existing files — a finished `resolume_ready/*.mov` is skipped, an existing
raw clip jumps straight to the loop/encode step. Re-run after a crash and only
the missing work is done.

### Step 5 — seamless loop + HAP

Ping-pong (boomerang) loop, with the duplicated seam frame trimmed so the loop
is jump-free:

```
[0:v]split=2[a][b];[b]reverse,trim=start_frame=1,setpts=PTS-STARTPTS[r];[a][r]concat=n=2:v=1[v]
```

- **default:** `-c:v hap -format hap_q` in a `.mov` (Resolume-native, GPU-decoded).
  832×1216 is divisible by 4, so HAP/DXT is happy.
- **`--no-encode`:** `libx264 -crf 8` MP4 — feed to Resolume Alley to convert to DXV3.

> Needs an FFmpeg build with the HAP encoder (`ffmpeg -hide_banner -encoders | findstr hap`).
> The gyan.dev "full" Windows builds include it. Without HAP, use `--no-encode`.
