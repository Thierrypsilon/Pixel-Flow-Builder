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
