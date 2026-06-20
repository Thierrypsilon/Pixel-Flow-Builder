#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
vj_portrait_batch.py -- Floating Portrait batch runner (Schritte 4 + 5).

Pipeline pro Prompt-Zeile:
  1. portrait_gen.json  ueber die ComfyUI-API queuen  (SDXL -> Inspyrenet -> #5a6470)
  2. Ergebnis-PNG abholen und als LoadImage-Input wieder hochladen
  3. wan_i2v.json queuen (Wan 2.2 ti2v-5B, Bild -> 5 s Video)
  4. Video nach ./output/floating_portraits/ sichern
  5. FFmpeg Ping-Pong-Loop (vorwaerts + rueckwaerts) fuer nahtloses Looping
  6. Encode als HAP (-c:v hap -format hap_q) nach ./output/resolume_ready/
     ( --no-encode  -> stattdessen hochwertiges MP4, fuer Resolume Alley -> DXV3 )

Nur Python-Standardbibliothek + FFmpeg auf dem PATH. Kein pip-Install noetig.

Beispiele (Windows PowerShell):
  python vj_portrait_batch.py
  python vj_portrait_batch.py --prompts prompts.txt --no-encode
  python vj_portrait_batch.py --limit 3 --motion "slow hair drift, static camera"
  python vj_portrait_batch.py --no-resume        # alles neu rendern
"""

from __future__ import annotations

import argparse
import hashlib
import json
import mimetypes
import os
import random
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

# ---------------------------------------------------------------------------
# Konstanten / Patch-Punkte (muessen zu portrait_gen.json / wan_i2v.json passen)
# ---------------------------------------------------------------------------

PORTRAIT_NODE_PROMPT = "6"      # CLIPTextEncode positive (Portrait-Prompt)
PORTRAIT_NODE_SEED = "3"        # KSampler seed
PORTRAIT_NODE_SAVE = "12"       # SaveImage

WAN_NODE_MOTION = "6"           # CLIPTextEncode positive (Motion-Prompt)
WAN_NODE_SEED = "3"             # KSampler seed
WAN_NODE_LOADIMAGE = "52"       # LoadImage (Start-Bild)
WAN_NODE_VIDEO = "57"           # VHS_VideoCombine

HERE = Path(__file__).resolve().parent


# ---------------------------------------------------------------------------
# Kleine, robuste HTTP-Helfer (nur urllib)
# ---------------------------------------------------------------------------

class ComfyClient:
    """Minimaler ComfyUI-API-Client ueber /prompt, /history, /view, /upload/image."""

    def __init__(self, server: str, timeout: float = 30.0):
        self.server = server.rstrip("/")
        self.timeout = timeout
        self.client_id = str(uuid.uuid4())

    # -- low level -------------------------------------------------------
    def _url(self, path: str) -> str:
        return f"{self.server}{path}"

    def _get_json(self, path: str):
        req = urllib.request.Request(self._url(path), method="GET")
        with urllib.request.urlopen(req, timeout=self.timeout) as resp:
            return json.loads(resp.read().decode("utf-8", errors="replace"))

    def _get_bytes(self, path: str) -> bytes:
        req = urllib.request.Request(self._url(path), method="GET")
        with urllib.request.urlopen(req, timeout=self.timeout) as resp:
            return resp.read()

    # -- public ----------------------------------------------------------
    def ping(self) -> bool:
        try:
            self._get_json("/system_stats")
            return True
        except Exception:
            return False

    def queue_prompt(self, graph: dict) -> str:
        body = json.dumps({"prompt": graph, "client_id": self.client_id}).encode("utf-8")
        req = urllib.request.Request(
            self._url("/prompt"), data=body, method="POST",
            headers={"Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                data = json.loads(resp.read().decode("utf-8", errors="replace"))
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"/prompt HTTP {exc.code}: {detail}") from exc
        node_errors = data.get("node_errors") or {}
        if node_errors:
            raise RuntimeError(f"ComfyUI node_errors: {json.dumps(node_errors)}")
        pid = data.get("prompt_id")
        if not pid:
            raise RuntimeError(f"Keine prompt_id in Antwort: {data}")
        return pid

    def wait(self, prompt_id: str, timeout: float = 1800.0, poll: float = 1.5) -> dict:
        """Pollt /history bis der Job fertig (oder Fehler / Timeout) ist."""
        deadline = time.time() + timeout
        last_note = 0.0
        while time.time() < deadline:
            try:
                hist = self._get_json(f"/history/{prompt_id}")
            except Exception:
                hist = {}
            entry = hist.get(prompt_id)
            if entry:
                status = entry.get("status", {}) or {}
                status_str = status.get("status_str")
                if status_str == "error":
                    msgs = status.get("messages", [])
                    raise RuntimeError(f"ComfyUI-Ausfuehrungsfehler: {json.dumps(msgs)[:800]}")
                # fertig, sobald Outputs da sind oder completed-Flag gesetzt
                if entry.get("outputs") or status.get("completed"):
                    return entry
            now = time.time()
            if now - last_note > 15:
                last_note = now
                sys.stdout.write(".")
                sys.stdout.flush()
            time.sleep(poll)
        raise TimeoutError(f"Timeout ({timeout:.0f}s) beim Warten auf {prompt_id}")

    @staticmethod
    def collect_outputs(entry: dict, node_id: str, keys: tuple[str, ...]) -> list[dict]:
        """Holt File-Deskriptoren (filename/subfolder/type) aus einem Output-Node."""
        out = entry.get("outputs", {}).get(node_id, {})
        files: list[dict] = []
        for key in keys:
            for item in out.get(key, []) or []:
                if isinstance(item, dict) and item.get("filename"):
                    files.append(item)
        if not files:
            # Fallback: irgendeine Liste mit filename-Eintraegen im Node
            for val in out.values():
                if isinstance(val, list):
                    for item in val:
                        if isinstance(item, dict) and item.get("filename"):
                            files.append(item)
        return files

    def download_view(self, descriptor: dict) -> bytes:
        q = urllib.parse.urlencode({
            "filename": descriptor.get("filename", ""),
            "subfolder": descriptor.get("subfolder", ""),
            "type": descriptor.get("type", "output"),
        })
        return self._get_bytes(f"/view?{q}")

    def upload_image(self, data: bytes, filename: str) -> str:
        """Laedt Bytes als Bild in den ComfyUI-input-Ordner. Gibt den Namen zurueck."""
        boundary = "----vjportrait" + uuid.uuid4().hex
        mime = mimetypes.guess_type(filename)[0] or "image/png"
        parts: list[bytes] = []

        def field(name: str, value: str):
            parts.append(
                (f"--{boundary}\r\n"
                 f'Content-Disposition: form-data; name="{name}"\r\n\r\n'
                 f"{value}\r\n").encode("utf-8")
            )

        # Datei-Feld
        parts.append(
            (f"--{boundary}\r\n"
             f'Content-Disposition: form-data; name="image"; filename="{filename}"\r\n'
             f"Content-Type: {mime}\r\n\r\n").encode("utf-8")
        )
        parts.append(data)
        parts.append(b"\r\n")
        # Zusatzfelder
        field("overwrite", "true")
        field("type", "input")
        parts.append(f"--{boundary}--\r\n".encode("utf-8"))
        payload = b"".join(parts)

        req = urllib.request.Request(
            self._url("/upload/image"), data=payload, method="POST",
            headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        )
        with urllib.request.urlopen(req, timeout=self.timeout) as resp:
            info = json.loads(resp.read().decode("utf-8", errors="replace"))
        name = info.get("name", filename)
        sub = info.get("subfolder", "")
        return f"{sub}/{name}" if sub else name


# ---------------------------------------------------------------------------
# State / Resume
# ---------------------------------------------------------------------------

class State:
    def __init__(self, path: Path, enabled: bool):
        self.path = path
        self.enabled = enabled
        self.data: dict = {}
        if enabled and path.is_file():
            try:
                self.data = json.loads(path.read_text(encoding="utf-8"))
            except Exception:
                self.data = {}

    def get(self, key: str) -> dict:
        return self.data.get(key, {})

    def update(self, key: str, **fields):
        rec = self.data.setdefault(key, {})
        rec.update(fields)
        self._flush()

    def _flush(self):
        if not self.enabled:
            return
        try:
            self.path.write_text(json.dumps(self.data, indent=2, ensure_ascii=False), encoding="utf-8")
        except OSError:
            pass


# ---------------------------------------------------------------------------
# FFmpeg-Post (Schritt 5)
# ---------------------------------------------------------------------------

def ffmpeg_available() -> bool:
    return shutil.which("ffmpeg") is not None


# Ping-Pong (Boomerang): vorwaerts + rueckwaerts, das doppelte Naht-Frame entfernt,
# damit der Loop nahtlos laeuft. -an verwirft Audio (gibt es ohnehin nicht).
PINGPONG_FILTER = (
    "[0:v]split=2[a][b];"
    "[b]reverse,trim=start_frame=1,setpts=PTS-STARTPTS[r];"
    "[a][r]concat=n=2:v=1[v]"
)


def build_loop(src: Path, dst: Path, encode_hap: bool, fps: int) -> None:
    """Erzeugt aus src einen nahtlosen Ping-Pong-Loop nach dst (HAP .mov oder MP4)."""
    dst.parent.mkdir(parents=True, exist_ok=True)
    if encode_hap:
        # HAP Q in MOV-Container -- Resolume-nativer Codec, GPU-dekodiert.
        cmd = [
            "ffmpeg", "-y", "-i", str(src),
            "-filter_complex", PINGPONG_FILTER, "-map", "[v]",
            "-r", str(fps),
            "-c:v", "hap", "-format", "hap_q",
            "-an", str(dst),
        ]
    else:
        # Hochwertiges MP4 -- z.B. fuer Resolume Alley -> DXV3.
        cmd = [
            "ffmpeg", "-y", "-i", str(src),
            "-filter_complex", PINGPONG_FILTER, "-map", "[v]",
            "-r", str(fps),
            "-c:v", "libx264", "-crf", "8", "-preset", "slow",
            "-pix_fmt", "yuv420p", "-movflags", "+faststart",
            "-an", str(dst),
        ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        tail = "\n".join(proc.stderr.strip().splitlines()[-8:])
        raise RuntimeError(f"FFmpeg-Loop fehlgeschlagen ({src.name}):\n{tail}")


# ---------------------------------------------------------------------------
# Prompt-Liste
# ---------------------------------------------------------------------------

def load_prompts(path: Path) -> list[str]:
    if not path.is_file():
        raise FileNotFoundError(f"Prompt-Datei nicht gefunden: {path}")
    prompts = []
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        prompts.append(line)
    return prompts


def slug(text: str, idx: int) -> str:
    h = hashlib.sha1(text.encode("utf-8")).hexdigest()[:6]
    safe = "".join(c if c.isalnum() else "_" for c in text.lower())[:32].strip("_")
    return f"{idx:03d}_{safe or 'portrait'}_{h}"


def prompt_key(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# Haupt-Workflow pro Prompt
# ---------------------------------------------------------------------------

def run_one(client: ComfyClient, idx: int, total: int, prompt: str,
            portrait_graph: dict, wan_graph: dict, motion: str,
            dirs: dict, state: State, args) -> bool:
    name = slug(prompt, idx)
    key = prompt_key(prompt + "||" + motion)
    rec = state.get(key)
    tag = f"[{idx + 1}/{total}] {name}"
    print(f"\n=== {tag}")
    print(f"    prompt: {prompt[:90]}")

    video_path = dirs["videos"] / f"{name}.mp4"
    loop_ext = "mov" if not args.no_encode else "mp4"
    loop_path = dirs["resolume"] / f"{name}.{loop_ext}"

    # Resume: finaler Loop existiert schon -> ueberspringen
    if not args.no_resume and loop_path.is_file() and loop_path.stat().st_size > 0:
        print(f"    [skip] Loop existiert bereits: {loop_path.name}")
        return True

    # ---- 1) Portrait generieren (oder aus State/Datei wiederverwenden) -----
    if not args.no_resume and video_path.is_file() and video_path.stat().st_size > 0:
        print(f"    [resume] Video existiert -> ueberspringe Gen, gehe direkt zum Loop")
    else:
        try:
            pg = json.loads(json.dumps(portrait_graph))  # deep copy
            pg[PORTRAIT_NODE_PROMPT]["inputs"]["text"] = prompt
            pg[PORTRAIT_NODE_SEED]["inputs"]["seed"] = random.randint(0, 2**63 - 1)
            print("    -> Portrait queuen ...", end="", flush=True)
            pid = client.queue_prompt(pg)
            entry = client.wait(pid, timeout=args.timeout)
            imgs = client.collect_outputs(entry, PORTRAIT_NODE_SAVE, ("images",))
            if not imgs:
                raise RuntimeError("Keine Portrait-Ausgabe (SaveImage) gefunden")
            print(" ok")
            portrait_desc = imgs[0]
            png_bytes = client.download_view(portrait_desc)
            (dirs["portraits"]).mkdir(parents=True, exist_ok=True)
            (dirs["portraits"] / f"{name}.png").write_bytes(png_bytes)
            state.update(key, prompt=prompt, portrait=f"{name}.png")

            # ---- 2) Portrait als LoadImage-Input hochladen ----------------
            input_name = client.upload_image(png_bytes, f"{name}.png")

            # ---- 3) Wan I2V ------------------------------------------------
            wg = json.loads(json.dumps(wan_graph))  # deep copy
            wg[WAN_NODE_LOADIMAGE]["inputs"]["image"] = input_name
            wg[WAN_NODE_MOTION]["inputs"]["text"] = motion
            wg[WAN_NODE_SEED]["inputs"]["seed"] = random.randint(0, 2**63 - 1)
            print("    -> Wan I2V queuen (das dauert) ...", end="", flush=True)
            pid = client.queue_prompt(wg)
            entry = client.wait(pid, timeout=args.timeout)
            vids = client.collect_outputs(entry, WAN_NODE_VIDEO, ("gifs", "videos"))
            if not vids:
                raise RuntimeError("Keine Video-Ausgabe (VHS_VideoCombine) gefunden")
            print(" ok")
            # bevorzugt das MP4 aus den Deskriptoren
            mp4 = next((v for v in vids if str(v.get("filename", "")).lower().endswith(".mp4")), vids[0])
            video_bytes = client.download_view(mp4)
            video_path.parent.mkdir(parents=True, exist_ok=True)
            video_path.write_bytes(video_bytes)
            state.update(key, video=video_path.name)
        except Exception as exc:
            print(f"\n    [FEHLER] {tag}: {exc}")
            state.update(key, error=str(exc))
            return False

    # ---- 4+5) FFmpeg Ping-Pong-Loop + (optional) HAP ----------------------
    if not ffmpeg_available():
        print("    [warn] FFmpeg nicht gefunden -> ueberspringe Loop/HAP. "
              "Rohvideo liegt unter output/floating_portraits/.")
        return True
    try:
        mode = "MP4 (--no-encode)" if args.no_encode else "HAP hap_q (.mov)"
        print(f"    -> Ping-Pong-Loop + {mode} ...", end="", flush=True)
        build_loop(video_path, loop_path, encode_hap=not args.no_encode, fps=args.fps)
        state.update(key, loop=loop_path.name)
        print(f" ok -> {loop_path.name}")
        return True
    except Exception as exc:
        print(f"\n    [FEHLER] FFmpeg {tag}: {exc}")
        state.update(key, error=str(exc))
        return False


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def main() -> int:
    ap = argparse.ArgumentParser(
        description="Floating Portrait Batch-Runner (ComfyUI -> Wan 2.2 -> Resolume HAP)")
    ap.add_argument("--server", default="http://127.0.0.1:8188", help="ComfyUI-API-Adresse")
    ap.add_argument("--prompts", default=str(HERE / "prompts.txt"), help="Prompt-Liste (eine Zeile pro Variante)")
    ap.add_argument("--portrait-workflow", default=str(HERE / "portrait_gen.json"))
    ap.add_argument("--wan-workflow", default=str(HERE / "wan_i2v.json"))
    ap.add_argument("--outdir", default=str(HERE / "output"))
    ap.add_argument("--motion", default=None,
                    help="Motion-Prompt fuer Wan ueberschreiben (sonst aus wan_i2v.json)")
    ap.add_argument("--fps", type=int, default=24, help="Loop-Framerate fuer FFmpeg")
    ap.add_argument("--no-encode", action="store_true",
                    help="Statt HAP ein hochwertiges MP4 schreiben (fuer Resolume Alley -> DXV3)")
    ap.add_argument("--no-resume", action="store_true", help="Alles neu rendern, State ignorieren")
    ap.add_argument("--limit", type=int, default=0, help="Nur die ersten N Prompts verarbeiten")
    ap.add_argument("--timeout", type=float, default=1800.0, help="Timeout pro Job in Sekunden")
    args = ap.parse_args()

    # Workflows + Prompts laden
    try:
        portrait_graph = json.loads(Path(args.portrait_workflow).read_text(encoding="utf-8"))
        wan_graph = json.loads(Path(args.wan_workflow).read_text(encoding="utf-8"))
        prompts = load_prompts(Path(args.prompts))
    except Exception as exc:
        print(f"[ABBRUCH] Konnte Eingaben nicht laden: {exc}")
        return 2
    if args.limit > 0:
        prompts = prompts[:args.limit]
    if not prompts:
        print("[ABBRUCH] Keine Prompts gefunden.")
        return 2

    # Motion-Prompt bestimmen
    motion = args.motion or wan_graph.get(WAN_NODE_MOTION, {}).get("inputs", {}).get("text", "")

    # Ausgabe-Ordner
    out = Path(args.outdir)
    dirs = {
        "portraits": out / "portraits",
        "videos": out / "floating_portraits",
        "resolume": out / "resolume_ready",
    }
    for d in dirs.values():
        d.mkdir(parents=True, exist_ok=True)

    state = State(out / ".batch_state.json", enabled=not args.no_resume)

    # Server pruefen
    client = ComfyClient(args.server)
    if not client.ping():
        print(f"[ABBRUCH] ComfyUI nicht erreichbar unter {args.server}. "
              f"Bitte ComfyUI starten (Server muss laufen).")
        return 3
    if not ffmpeg_available():
        print("[Hinweis] FFmpeg nicht im PATH gefunden -- Rohvideos werden erzeugt, "
              "aber Loop/HAP wird uebersprungen.")

    print(f"== Floating Portrait Batch ==")
    print(f"   Server : {args.server}")
    print(f"   Prompts: {len(prompts)}  |  Encode: {'MP4' if args.no_encode else 'HAP hap_q'}  |  Resume: {not args.no_resume}")
    print(f"   Output : {out}")

    t0 = time.time()
    ok = fail = 0
    for i, prompt in enumerate(prompts):
        success = run_one(client, i, len(prompts), prompt,
                          portrait_graph, wan_graph, motion, dirs, state, args)
        if success:
            ok += 1
        else:
            fail += 1
        elapsed = time.time() - t0
        done = i + 1
        eta = (elapsed / done) * (len(prompts) - done)
        print(f"    [stats] ok={ok} fail={fail}  verstrichen={elapsed/60:.1f}min  ETA~{eta/60:.1f}min")

    print("\n========================================")
    print(f"  Fertig: {ok} ok, {fail} Fehler von {len(prompts)}")
    print(f"  Loops:  {dirs['resolume']}")
    if fail:
        print("  Tipp: erneut starten -- erledigte Clips werden dank Resume uebersprungen.")
    print("========================================")
    return 0 if fail == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
