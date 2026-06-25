# HANDOFF — Floating Portrait VJ Pipeline

**Branch:** `claude/floating-portrait-comfyui-pipeline-g6kgbi`
**User:** VJ Fiebertraum (thierrypsilon@gmail.com) — Windows, RTX 5080 (16 GB), ComfyUI **Desktop**,
Base-Dir `C:\Users\Thierry Meyer\Documents\ComfyUI`. Resolume Arena + TD 2025.x.

## Ziel
Automatisierte "Floating Portrait" VJ-Loops (ingi.ai-Stil): Editorial-Porträt auf flachem
grau-blauem Plate (#5a6470) → Wan 2.2 I2V → nahtloser Loop → Resolume (HAP).

## Wichtige Randbedingungen
- **Ich (Claude) laufe in einem Cloud-Container OHNE Zugriff auf den lokalen ComfyUI-Server
  des Users** (`127.0.0.1:8188` ist seine Maschine). Generierung läuft daher IMMER beim User
  lokal — ich liefere Code/Workflows, er führt aus und pastet Output.
- **Magnific-Pfad gestoppt:** Account gehört nicht dem User → KEINE weiteren Magnific-Credits
  ausgeben (User-Anweisung). Bereits erzeugt (liegen im fremden Magnific-Account): 2 Porträts
  + 1 Test-Loop. Nicht weiterverwenden ohne ausdrückliche Freigabe.

## Stand der Bestandsaufnahme (Schritt 1, erledigt)
- VRAM 16 GB → Entscheidung: **Wan 2.2 ti2v-5B** (statt 14B).
- Portrait-Modell: **SDXL** (`sd_xl_base_1.0.safetensors`) — kein Flux-Checkpoint vorhanden.
- BG-Removal: **Inspyrenet-Rembg** (war nicht installiert).
- Vorhanden: `umt5_xxl_fp8...`, `wan_2.1_vae`, viele Custom Nodes inkl. VideoHelperSuite,
  KJNodes, frame-interpolation, rgthree.
- Fehlte (vom User per setup_pipeline.ps1 nachgeladen): `wan2.2_ti2v_5B_fp16.safetensors`
  (→ models/diffusion_models/), `wan2.2_vae.safetensors` (→ models/vae/), Inspyrenet-Node.

## Dateien (alle im Ordner vj-pipeline/, committet & gepusht)
| Datei | Zweck |
|---|---|
| `inventory_comfyui.py` | Schritt 1: Inventory (Nodes/Modelle/VRAM/Wan-Check, live via /object_info) |
| `portrait_gen.json` | Workflow 1 (API-Format): SDXL → InspyrenetRembg → ImageCompositeMasked auf #5a6470 |
| `wan_i2v.json` | Workflow 2 (API-Format): Wan 2.2 ti2v-5B I2V, 832x1216, 121f/5s@24fps, ModelSamplingSD3 shift 8 |
| `vj_portrait_batch.py` | Runner (stdlib): queue→poll→chain→collect + FFmpeg Ping-Pong-Loop + HAP; **Preflight-Check**, Resume, Progress |
| `prompts.txt` | 8 Editorial-Porträt-Prompts |
| `setup_pipeline.ps1` | Lokales One-Shot-Setup (lädt Wan-5B-Modelle + Inspyrenet-Node) |
| `README.md` | Voll-Doku + Patch-Punkte |

### Patch-Punkte (Runner überschreibt diese Node-IDs)
- portrait_gen.json: Node 6 = Prompt, Node 3 = seed, Node 12 = SaveImage.
- wan_i2v.json: Node 52 = LoadImage (Start-Bild), Node 6 = Motion-Prompt, Node 3 = seed, Node 57 = VHS_VideoCombine.

## NÄCHSTER SCHRITT (hier unterbrochen)
User hat setup_pipeline.ps1 ausgeführt + ComfyUI neu gestartet. Er sollte jetzt lokal laufen lassen:
```
cd "C:\Users\Thierry Meyer\Pixel-Flow-Builder\vj-pipeline"
git pull
python vj_portrait_batch.py --limit 1
```
→ **Auf seinen Output warten.** Der Preflight nennt exakt, falls ein Node-Typ fehlt oder ein
Modellname abweicht. Dann ggf. wan_i2v.json / portrait_gen.json anpassen.

## Bekannte Risikostellen (ungetestet, da kein lokaler Zugriff)
1. Exakte Node-Namen: `Wan22ImageToVideoLatent`, `InspyrenetRembg`, `VHS_VideoCombine`
   (Preflight fängt Abweichungen ab → Output zeigt verfügbare Alternativen).
2. HAP-Encoder muss im FFmpeg-Build sein (`ffmpeg -encoders | findstr hap`); sonst `--no-encode`.
3. VRAM bei 121 Frames auf 16 GB: bei OOM in wan_i2v.json Node 55 `length` z.B. auf 81 senken.
