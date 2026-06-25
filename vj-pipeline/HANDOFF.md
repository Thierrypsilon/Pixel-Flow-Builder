# HANDOFF — Floating Portrait VJ Pipeline

**Branch:** `claude/floating-portrait-comfyui-pipeline-g6kgbi`
**User:** VJ Fiebertraum (thierrypsilon@gmail.com) — Windows, RTX 5080 (16 GB), ComfyUI **Desktop**. Resolume Arena + TD 2025.x.

## Ziel
Automatisierte "Floating Portrait" VJ-Loops (ingi.ai-Stil): Editorial-Porträt auf flachem grau-blauem Plate (#5a6470) → Wan 2.2 I2V → nahtloser Loop → Resolume (HAP).

## WICHTIGE RANDBEDINGUNGEN
- **Claude läuft im Cloud-Container OHNE Zugriff auf den lokalen ComfyUI-Server des Users.** Generierung läuft IMMER lokal beim User; Claude liefert Code/Workflows, User führt aus und pastet Output.
- **Magnific-Pfad GESTOPPT** (Account gehört nicht dem User → keine weiteren Credits). Bereits dort erzeugt: 2 Porträts + 1 Test-Loop. Nicht weiterverwenden ohne Freigabe.

## AKTUELLER STAND (zuletzt erreicht)
- Lokale ComfyUI-Instanz (Desktop-App) läuft auf **Port 8000** (NICHT 8188!). Es gibt auch eine "Comfy Cloud"-Instanz (cloud.comfy.org) — die ist NICHT relevant, hat unsere Modelle nicht. Immer die lokale Instanz nutzen.
- Runner-Aufruf daher mit: `--server http://127.0.0.1:8000`
- **Preflight bestanden für ALLES außer InspyrenetRembg.** Bestätigt vorhanden/gesehen von ComfyUI: sd_xl_base_1.0, wan2.2_ti2v_5B_fp16, wan2.2_vae, umt5_xxl_fp8, Node `Wan22ImageToVideoLatent`, Node `VHS_VideoCombine`, `ModelSamplingSD3`.
- **Einziger offener Punkt:** Custom Node `InspyrenetRembg` fehlte. User installiert ihn gerade via ComfyUI-Manager: **"ComfyUI-Inspyrenet-Rembg" von john-mnz** (v1.1.1, ~247k Downloads) — registriert die Node-Klasse `InspyrenetRembg`. NICHT die RMBG/YCYY-Varianten (andere Node-Namen).

## NÄCHSTER SCHRITT
Nach Inspyrenet-Install + ComfyUI-Restart, lokal beim User:
```
cd "C:\Users\Thierry Meyer\Pixel-Flow-Builder\vj-pipeline"
git pull
python vj_portrait_batch.py --limit 1 --server http://127.0.0.1:8000
```
→ Preflight sollte komplett grün sein, dann rendert 1 Test-Loop. Output an Claude pasten.
Danach voller Batch: `python vj_portrait_batch.py --server http://127.0.0.1:8000`

## SOFORT-FALLBACK (ohne Inspyrenet)
`portrait_gen_nobg.json` = SDXL ohne Matting, flacher BG per Prompt. Lauf:
`python vj_portrait_batch.py --limit 1 --server http://127.0.0.1:8000 --portrait-workflow portrait_gen_nobg.json`

## DATEIEN (alle in vj-pipeline/, committet)
- inventory_comfyui.py — Schritt 1 Inventory (live via /object_info)
- portrait_gen.json — Workflow 1: SDXL → InspyrenetRembg → ImageCompositeMasked auf #5a6470
- portrait_gen_nobg.json — Workflow 1 Fallback ohne Custom Node (prompt-only flat bg)
- wan_i2v.json — Workflow 2: Wan 2.2 ti2v-5B I2V, 832x1216, 121f/5s@24fps, ModelSamplingSD3 shift 8
- vj_portrait_batch.py — Runner (stdlib): Preflight + queue→poll→chain→collect + FFmpeg Ping-Pong-Loop + HAP; Resume, Progress, --no-encode, --skip-preflight
- prompts.txt — 8 Editorial-Prompts
- setup_pipeline.ps1 — lokales One-Shot-Setup (Wan-5B-Modelle + Inspyrenet-Node, john-mnz)
- README.md — Voll-Doku + Patch-Punkte

### Runner Patch-Punkte (Node-IDs)
- portrait_gen(_nobg).json: Node 6 = Prompt, Node 3 = seed, Node 12 = SaveImage
- wan_i2v.json: Node 52 = LoadImage (Start-Bild), Node 6 = Motion-Prompt, Node 3 = seed, Node 57 = VHS_VideoCombine

## BEKANNTE RISIKOSTELLEN
1. HAP-Encoder muss im FFmpeg-Build sein (`ffmpeg -encoders | findstr hap`); sonst `--no-encode` (libx264-MP4 für Resolume Alley → DXV3).
2. VRAM bei 121 Frames auf 16 GB: bei OOM in wan_i2v.json Node 55 `length` z.B. auf 81 senken.
3. Falls weitere Node-Namen abweichen: Preflight zeigt sie; Workflow-JSON anpassen.

## NEUE SESSION FORTSETZEN
Auf demselben Branch starten und sagen: "Lies vj-pipeline/HANDOFF.md und mach da weiter."
