#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
inventory_comfyui.py  --  Schritt 1: Bestandsaufnahme der ComfyUI-Installation.

Laeuft mit reiner Python-Standardbibliothek (keine pip-Installs noetig).
Getestet fuer Windows (TD/Resolume-Rechner), funktioniert aber auch unter Linux/macOS.

Was es prueft:
  * Speicherort der ComfyUI-Installation (per --comfyui-path, Env, Auto-Detect, oder laufender Server)
  * Installierte Custom Nodes (Ordner unter custom_nodes/)
  * Modelle in checkpoints / diffusion_models / unet / vae / text_encoders / clip / clip_vision / loras
  * Verfuegbares VRAM (nvidia-smi)
  * Gezielte Pruefung auf die Wan-2.2-Dateien (14B I2V high/low noise, 5B ti2v, umt5_xxl, wan VAE)
  * Optional: laufender ComfyUI-Server auf 127.0.0.1:8188 (/system_stats, /object_info)

Ausgabe:
  * Lesbarer Report auf stdout
  * Maschinenlesbares JSON nach vj-pipeline/inventory_report.json (oder --json-out PFAD)

Beispiele (Windows PowerShell):
  python inventory_comfyui.py
  python inventory_comfyui.py --comfyui-path "C:\\Users\\fiebertraum\\ComfyUI"
  python inventory_comfyui.py --comfyui-path "D:\\ComfyUI_windows_portable\\ComfyUI"
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path

# ---------------------------------------------------------------------------
# Konfiguration
# ---------------------------------------------------------------------------

# Modell-Unterordner, die wir auflisten (relativ zu <comfyui>/models/)
MODEL_DIRS = [
    "checkpoints",
    "diffusion_models",
    "unet",            # aelteres ComfyUI legt diffusion models hier ab
    "vae",
    "text_encoders",
    "clip",            # umt5 wird manchmal hier statt in text_encoders erwartet
    "clip_vision",
    "loras",
]

MODEL_EXTS = {".safetensors", ".sft", ".ckpt", ".pt", ".pth", ".bin", ".gguf"}

# Erkennungsmuster fuer die Wan-2.2-Pipeline. Substring-Match, case-insensitive.
WAN_REQUIREMENTS = {
    "wan2.2_i2v_14B_high": ["wan2.2_i2v_high_noise_14b", "i2v_high_noise_14b", "wan2_2_i2v_high"],
    "wan2.2_i2v_14B_low":  ["wan2.2_i2v_low_noise_14b", "i2v_low_noise_14b", "wan2_2_i2v_low"],
    "wan2.2_ti2v_5B":      ["wan2.2_ti2v_5b", "ti2v_5b", "wan2_2_ti2v_5b"],
    "umt5_xxl_text_encoder": ["umt5_xxl", "umt5-xxl"],
    "wan_vae":             ["wan_2.1_vae", "wan2.1_vae", "wan_vae", "wan2.2_vae"],
}

API_BASE = "http://127.0.0.1:8188"

# Wahrscheinliche Installationspfade auf Windows + Unix fuer Auto-Detect.
# Inkl. der Base-Directories der ComfyUI-Desktop-App (Electron).
COMMON_PATHS = [
    r"C:\ComfyUI",
    r"C:\ComfyUI_windows_portable\ComfyUI",
    r"D:\ComfyUI",
    r"D:\ComfyUI_windows_portable\ComfyUI",
    r"D:\AI\ComfyUI",
    os.path.expanduser(r"~\ComfyUI"),
    os.path.expanduser(r"~\Documents\ComfyUI"),          # Desktop-App Default-Base-Dir
    os.path.expanduser(r"~\AppData\Local\Programs\ComfyUI"),
    os.path.expanduser(r"~/ComfyUI"),
    os.path.expanduser(r"~/Documents/ComfyUI"),
    "/opt/ComfyUI",
    "/workspace/ComfyUI",
]

# Bei der Desktop-App liegt der eigentliche Server-Code oft unter resources/ComfyUI,
# das Base-Dir (mit models/) wird beim Setup gewaehlt. Wir suchen models/ tolerant.
DESKTOP_SUBPATHS = [
    "models",
    r"resources\ComfyUI\models",
    "resources/ComfyUI/models",
]


# ---------------------------------------------------------------------------
# Hilfsfunktionen
# ---------------------------------------------------------------------------

def human_size(num_bytes: int) -> str:
    size = float(num_bytes)
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if size < 1024.0:
            return f"{size:.1f}{unit}"
        size /= 1024.0
    return f"{size:.1f}PB"


def looks_like_comfyui(path: Path) -> bool:
    """Heuristik: ein ComfyUI-Root hat main.py und einen models/-Ordner."""
    return (path / "main.py").is_file() and (path / "models").is_dir()


def http_get_json(url: str, timeout: float = 3.0):
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8", errors="replace"))
    except Exception:
        return None


def detect_comfyui_path(cli_path: str | None) -> Path | None:
    """Reihenfolge: CLI-Arg -> Env COMFYUI_PATH -> laufender Server -> Common-Paths."""
    # 1) explizit per CLI
    if cli_path:
        p = Path(cli_path).expanduser()
        return p

    # 2) Environment
    env = os.environ.get("COMFYUI_PATH")
    if env:
        return Path(env).expanduser()

    # 3) laufender Server kennt seinen eigenen Pfad ueber /system_stats
    stats = http_get_json(f"{API_BASE}/system_stats")
    if stats:
        # system_stats liefert keinen Root-Pfad, aber wenn der Server laeuft,
        # versuchen wir die Common-Paths trotzdem; ansonsten None.
        pass

    # 4) bekannte Standardorte
    for candidate in COMMON_PATHS:
        try:
            p = Path(candidate).expanduser()
        except (RuntimeError, OSError):
            continue
        if looks_like_comfyui(p) or find_models_root(p) is not None:
            return p

    return None


def get_vram_info() -> dict:
    """VRAM via nvidia-smi. Gibt Liste der GPUs + max VRAM zurueck."""
    result: dict = {"available": False, "method": None, "gpus": [], "max_vram_gb": 0.0}

    smi = shutil.which("nvidia-smi")
    if smi:
        try:
            out = subprocess.run(
                [smi, "--query-gpu=name,memory.total,memory.used,driver_version",
                 "--format=csv,noheader,nounits"],
                capture_output=True, text=True, timeout=15,
            )
            if out.returncode == 0 and out.stdout.strip():
                for line in out.stdout.strip().splitlines():
                    parts = [c.strip() for c in line.split(",")]
                    if len(parts) >= 3:
                        name, total_mib, used_mib = parts[0], parts[1], parts[2]
                        driver = parts[3] if len(parts) > 3 else "?"
                        total_gb = round(float(total_mib) / 1024.0, 1)
                        result["gpus"].append({
                            "name": name,
                            "vram_total_gb": total_gb,
                            "vram_used_gb": round(float(used_mib) / 1024.0, 1),
                            "driver": driver,
                        })
                        result["max_vram_gb"] = max(result["max_vram_gb"], total_gb)
                result["available"] = True
                result["method"] = "nvidia-smi"
                return result
        except Exception as exc:  # pragma: no cover
            result["error"] = f"nvidia-smi fehlgeschlagen: {exc}"

    # Fallback: laufender ComfyUI-Server meldet VRAM in /system_stats
    stats = http_get_json(f"{API_BASE}/system_stats")
    if stats and isinstance(stats.get("devices"), list):
        for dev in stats["devices"]:
            total = dev.get("vram_total", 0) or 0
            total_gb = round(total / (1024 ** 3), 1)
            result["gpus"].append({
                "name": dev.get("name", "?"),
                "vram_total_gb": total_gb,
                "vram_used_gb": round((total - (dev.get("vram_free", 0) or 0)) / (1024 ** 3), 1),
                "driver": stats.get("system", {}).get("os", "?"),
            })
            result["max_vram_gb"] = max(result["max_vram_gb"], total_gb)
        if result["gpus"]:
            result["available"] = True
            result["method"] = "comfyui /system_stats"

    return result


def scan_custom_nodes(comfyui: Path) -> list[str]:
    cn = comfyui / "custom_nodes"
    if not cn.is_dir():
        return []
    nodes = []
    for entry in sorted(cn.iterdir()):
        if entry.is_dir() and entry.name not in {"__pycache__"}:
            nodes.append(entry.name)
        elif entry.is_file() and entry.suffix == ".py" and entry.name != "example_node.py.example":
            nodes.append(entry.name)
    return nodes


def find_models_root(comfyui: Path) -> Path | None:
    """Findet den models/-Ordner tolerant (auch fuer die Desktop-App)."""
    for sub in DESKTOP_SUBPATHS:
        cand = comfyui / sub
        if cand.is_dir():
            return cand
    # Letzter Versuch: bis zu 2 Ebenen tief nach einem 'models'-Ordner suchen,
    # der typische Unterordner enthaelt.
    try:
        for depth1 in comfyui.iterdir():
            if depth1.is_dir() and depth1.name == "models" and (depth1 / "checkpoints").is_dir():
                return depth1
    except OSError:
        pass
    return None


def scan_models(comfyui: Path) -> dict:
    models_root = find_models_root(comfyui) or (comfyui / "models")
    inventory: dict = {}
    for sub in MODEL_DIRS:
        d = models_root / sub
        files = []
        if d.is_dir():
            for f in sorted(d.rglob("*")):
                if f.is_file() and f.suffix.lower() in MODEL_EXTS:
                    try:
                        size = f.stat().st_size
                    except OSError:
                        size = 0
                    rel = f.relative_to(d).as_posix()
                    files.append({"name": rel, "size_bytes": size, "size_h": human_size(size)})
        inventory[sub] = files
    return inventory


def check_wan_models(model_inventory: dict, api_models: dict | None = None) -> dict:
    """Sucht ueber ALLE gescannten Modellordner + API-Modelle nach den Wan-2.2-Bausteinen."""
    all_names = []
    for files in model_inventory.values():
        for f in files:
            all_names.append(f["name"].lower())
    if api_models:
        for names in api_models.values():
            for n in names:
                all_names.append(n.lower())

    found: dict = {}
    for key, patterns in WAN_REQUIREMENTS.items():
        match = None
        for name in all_names:
            if any(p in name for p in patterns):
                match = name
                break
        found[key] = match  # None == fehlt
    return found


# Welche Loader-Node welches Eingabefeld fuer Modelldateien hat.
# So liest man die *tatsaechlich von ComfyUI gesehenen* Modelle aus -- unabhaengig
# vom Speicherort (entscheidend fuer die Desktop-App mit eigenem Base-Dir).
OBJECT_INFO_MODEL_FIELDS = {
    "checkpoints":      [("CheckpointLoaderSimple", "ckpt_name")],
    "diffusion_models": [("UNETLoader", "unet_name")],
    "vae":              [("VAELoader", "vae_name")],
    "text_encoders":    [("CLIPLoader", "clip_name"),
                         ("DualCLIPLoader", "clip_name1"),
                         ("DualCLIPLoader", "clip_name2")],
    "clip_vision":      [("CLIPVisionLoader", "clip_name")],
    "loras":            [("LoraLoader", "lora_name")],
}


def extract_models_from_object_info(obj: dict) -> dict:
    """Zieht die verfuegbaren Modell-Dateinamen aus den Node-Definitionen."""
    out: dict = {}
    for category, sources in OBJECT_INFO_MODEL_FIELDS.items():
        names: list[str] = []
        for node_type, field in sources:
            node = obj.get(node_type)
            if not isinstance(node, dict):
                continue
            req = node.get("input", {}).get("required", {})
            opt = node.get("input", {}).get("optional", {})
            spec = req.get(field) or opt.get(field)
            # spec ist typischerweise [[ "datei1", "datei2", ... ], {meta}]
            if isinstance(spec, list) and spec and isinstance(spec[0], list):
                for n in spec[0]:
                    if isinstance(n, str) and n not in names:
                        names.append(n)
        out[category] = sorted(names)
    return out


def query_running_server() -> dict:
    info: dict = {"running": False}
    stats = http_get_json(f"{API_BASE}/system_stats")
    if stats:
        info["running"] = True
        info["system"] = stats.get("system", {})
        obj = http_get_json(f"{API_BASE}/object_info")
        if isinstance(obj, dict):
            info["node_count"] = len(obj)
            info["api_models"] = extract_models_from_object_info(obj)
            # Pruefe gezielt auf die fuer Wan/I2V relevanten Node-Typen
            wan_relevant = [
                "WanImageToVideo", "WanVaeLoader", "UNETLoader", "CLIPLoader",
                "VAELoader", "LoadImage", "UnetLoaderGGUF", "ImageOnlyCheckpointLoader",
            ]
            info["relevant_nodes_present"] = {n: (n in obj) for n in wan_relevant}
    return info


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------

HF_DOWNLOAD_HINTS = {
    "wan2.2_i2v_14B_high": (
        "Comfy-Org/Wan_2.2_ComfyUI_Repackaged -> "
        "split_files/diffusion_models/wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors "
        "-> models/diffusion_models/"
    ),
    "wan2.2_i2v_14B_low": (
        "Comfy-Org/Wan_2.2_ComfyUI_Repackaged -> "
        "split_files/diffusion_models/wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors "
        "-> models/diffusion_models/"
    ),
    "wan2.2_ti2v_5B": (
        "Comfy-Org/Wan_2.2_ComfyUI_Repackaged -> "
        "split_files/diffusion_models/wan2.2_ti2v_5B_fp16.safetensors "
        "-> models/diffusion_models/"
    ),
    "umt5_xxl_text_encoder": (
        "Comfy-Org/Wan_2.2_ComfyUI_Repackaged -> "
        "split_files/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors "
        "-> models/text_encoders/"
    ),
    "wan_vae": (
        "Comfy-Org/Wan_2.2_ComfyUI_Repackaged -> "
        "split_files/vae/wan_2.1_vae.safetensors (fuer 14B) bzw. "
        "wan2.2_vae.safetensors (fuer 5B) -> models/vae/"
    ),
}


def print_report(report: dict) -> None:
    line = "=" * 70
    p = print
    p(line)
    p("  COMFYUI BESTANDSAUFNAHME  --  Floating Portrait VJ Pipeline")
    p(line)

    # Pfad
    p(f"\n[ComfyUI-Root] {report['comfyui_path'] or 'NICHT GEFUNDEN (Dateisystem-Scan uebersprungen)'}")
    if not report["comfyui_path"]:
        p("  -> Pfad nicht erkannt. Fuer den Dateisystem-Scan mit --comfyui-path starten,")
        p("     z.B. --comfyui-path \"C:\\\\Users\\\\<du>\\\\Documents\\\\ComfyUI\".")
        p("     (VRAM + laufender Server werden trotzdem unten ausgewertet.)")
    elif not report["valid_comfyui"]:
        p("  -> WARNUNG: main.py oder models/ fehlen. Ist das wirklich das ComfyUI-Root?")

    # VRAM
    vram = report["vram"]
    p("\n[VRAM]")
    if vram["available"]:
        for g in vram["gpus"]:
            p(f"  - {g['name']}: {g['vram_total_gb']} GB total "
              f"({g['vram_used_gb']} GB belegt)  Treiber {g['driver']}")
        p(f"  -> max VRAM: {vram['max_vram_gb']} GB  (Quelle: {vram['method']})")
        rec = "14B fp8 (high+low noise)" if vram["max_vram_gb"] >= 24 else "5B ti2v"
        p(f"  -> EMPFEHLUNG fuer Wan 2.2: {rec}")
    else:
        p(f"  - Keine GPU-Info ({vram.get('error', 'nvidia-smi nicht gefunden')})")

    # Custom Nodes
    nodes = report["custom_nodes"]
    p(f"\n[Custom Nodes]  ({len(nodes)})")
    if nodes:
        for n in nodes:
            p(f"  - {n}")
    else:
        p("  (keine)")

    # Modelle
    p("\n[Modelle]")
    for sub, files in report["models"].items():
        p(f"  {sub}/  ({len(files)})")
        for f in files:
            p(f"      {f['name']}  [{f['size_h']}]")

    # Wan-Check
    p("\n[Wan 2.2 Pruefung]")
    missing = []
    for key, match in report["wan_check"].items():
        if match:
            p(f"  [OK]    {key}: {match}")
        else:
            p(f"  [FEHLT] {key}")
            missing.append(key)

    if missing:
        p("\n[Download-Hinweise fuer fehlende Dateien]  (NICHT automatisch geladen!)")
        p("  HuggingFace Repo: https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged")
        for key in missing:
            p(f"  - {key}:\n      {HF_DOWNLOAD_HINTS.get(key, '(siehe Repo)')}")

    # Server
    srv = report["server"]
    p("\n[Laufender ComfyUI-Server]")
    if srv.get("running"):
        p(f"  - erreichbar auf {API_BASE}  ({srv.get('node_count', '?')} Node-Typen)")
        for n, present in srv.get("relevant_nodes_present", {}).items():
            p(f"      {'[OK]   ' if present else '[fehlt]'} {n}")
        api_models = srv.get("api_models")
        if api_models:
            p("\n  [Von ComfyUI live gesehene Modelle (via /object_info)]")
            for cat, names in api_models.items():
                p(f"    {cat}/  ({len(names)})")
                for n in names:
                    p(f"        {n}")
    else:
        p(f"  - kein Server auf {API_BASE} (fuer Batch-Runner spaeter starten)")

    p("\n" + line)
    p(f"  JSON-Report: {report['json_out']}")
    p(line)


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def main() -> int:
    ap = argparse.ArgumentParser(description="ComfyUI-Bestandsaufnahme fuer die Floating-Portrait-Pipeline")
    ap.add_argument("--comfyui-path", default=None,
                    help="Pfad zum ComfyUI-Root (mit main.py + models/). Sonst Auto-Detect.")
    ap.add_argument("--json-out", default=None,
                    help="Zielpfad fuer den JSON-Report (Default: neben diesem Skript).")
    args = ap.parse_args()

    comfyui = detect_comfyui_path(args.comfyui_path)

    report: dict = {
        "comfyui_path": str(comfyui) if comfyui else None,
        "valid_comfyui": bool(comfyui and (looks_like_comfyui(comfyui)
                                           or find_models_root(comfyui) is not None)),
        "vram": get_vram_info(),
        "custom_nodes": [],
        "models": {sub: [] for sub in MODEL_DIRS},
        "wan_check": {k: None for k in WAN_REQUIREMENTS},
        "server": query_running_server(),
    }

    if comfyui and comfyui.is_dir():
        report["custom_nodes"] = scan_custom_nodes(comfyui)
        report["models"] = scan_models(comfyui)

    api_models = report["server"].get("api_models")
    report["wan_check"] = check_wan_models(report["models"], api_models)

    json_out = args.json_out or str(Path(__file__).resolve().parent / "inventory_report.json")
    report["json_out"] = json_out
    try:
        with open(json_out, "w", encoding="utf-8") as fh:
            json.dump(report, fh, indent=2, ensure_ascii=False)
    except OSError as exc:
        print(f"WARNUNG: Konnte JSON nicht schreiben: {exc}", file=sys.stderr)

    print_report(report)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
