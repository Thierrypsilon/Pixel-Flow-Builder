<#
  setup_pipeline.ps1  --  One-shot local setup for the Floating Portrait pipeline.

  Runs ON YOUR Windows machine (NOT in any cloud). It:
    1. Locates your ComfyUI base dir (auto, or pass -ComfyDir).
    2. Downloads the two Wan 2.2 ti2v-5B files into models\ (resumable).
    3. Sets up the Inspyrenet-Rembg custom node (git clone, or tells you to use Manager).
    4. Verifies everything and prints next steps.

  Usage (PowerShell):
    .\setup_pipeline.ps1
    .\setup_pipeline.ps1 -ComfyDir "C:\Users\Thierry Meyer\Documents\ComfyUI"

  If PowerShell blocks the script:
    powershell -ExecutionPolicy Bypass -File .\setup_pipeline.ps1
#>

param(
    [string]$ComfyDir = ""
)

$ErrorActionPreference = "Stop"

function Write-Step($msg) { Write-Host "`n=== $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "  [OK] $msg"   -ForegroundColor Green }
function Write-Warn2($msg){ Write-Host "  [!]  $msg"   -ForegroundColor Yellow }

# ---------------------------------------------------------------------------
# 1) ComfyUI base dir
# ---------------------------------------------------------------------------
Write-Step "ComfyUI-Basisordner finden"

$candidates = @(
    $ComfyDir,
    "$env:USERPROFILE\Documents\ComfyUI",
    "C:\ComfyUI",
    "C:\ComfyUI_windows_portable\ComfyUI",
    "D:\ComfyUI",
    "D:\ComfyUI_windows_portable\ComfyUI"
) | Where-Object { $_ -and (Test-Path (Join-Path $_ "models")) }

if (-not $candidates) {
    Write-Warn2 "Kein ComfyUI-Basisordner mit models\ gefunden."
    Write-Host  "  Bitte erneut mit Pfad starten, z.B.:"
    Write-Host  '    .\setup_pipeline.ps1 -ComfyDir "C:\Users\Thierry Meyer\Documents\ComfyUI"'
    exit 1
}

$base = $candidates[0]
$models = Join-Path $base "models"
$diffDir = Join-Path $models "diffusion_models"
$vaeDir  = Join-Path $models "vae"
$nodesDir = Join-Path $base "custom_nodes"
New-Item -ItemType Directory -Force -Path $diffDir, $vaeDir, $nodesDir | Out-Null
Write-Ok "Basis: $base"

# ---------------------------------------------------------------------------
# 2) Downloads (resumable via curl.exe, fallback Invoke-WebRequest)
# ---------------------------------------------------------------------------
Write-Step "Wan 2.2 ti2v-5B Modelle laden (~11 GB gesamt, einmalig)"

$downloads = @(
    @{
        Url  = "https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files/diffusion_models/wan2.2_ti2v_5B_fp16.safetensors"
        Dest = Join-Path $diffDir "wan2.2_ti2v_5B_fp16.safetensors"
        MinMB = 8000
    },
    @{
        Url  = "https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files/vae/wan2.2_vae.safetensors"
        Dest = Join-Path $vaeDir "wan2.2_vae.safetensors"
        MinMB = 200
    }
)

$curl = (Get-Command curl.exe -ErrorAction SilentlyContinue)

foreach ($d in $downloads) {
    $name = Split-Path $d.Dest -Leaf
    if ((Test-Path $d.Dest) -and ((Get-Item $d.Dest).Length / 1MB) -ge $d.MinMB) {
        Write-Ok "$name ist bereits vollstaendig vorhanden -> ueberspringe"
        continue
    }
    Write-Host "  -> lade $name ..."
    if ($curl) {
        # -L Redirects folgen, -C - resume, --retry robust
        & curl.exe -L -C - --retry 5 --retry-delay 3 -o $d.Dest $d.Url
        if ($LASTEXITCODE -ne 0) { throw "Download fehlgeschlagen: $name (curl exit $LASTEXITCODE)" }
    }
    else {
        Write-Warn2 "curl.exe nicht gefunden -> nutze Invoke-WebRequest (kein Resume)"
        Invoke-WebRequest -Uri $d.Url -OutFile $d.Dest
    }
    $sizeMB = [math]::Round((Get-Item $d.Dest).Length / 1MB, 1)
    if ($sizeMB -lt $d.MinMB) { throw "$name nur $sizeMB MB -- Download unvollstaendig." }
    Write-Ok "$name geladen ($sizeMB MB)"
}

# ---------------------------------------------------------------------------
# 3) Inspyrenet-Rembg custom node
# ---------------------------------------------------------------------------
Write-Step "Inspyrenet-Rembg Node einrichten"

$nodePath = Join-Path $nodesDir "ComfyUI-Inspyrenet-Rembg"
if (Test-Path $nodePath) {
    Write-Ok "Node-Ordner existiert bereits: $nodePath"
}
elseif (Get-Command git -ErrorAction SilentlyContinue) {
    try {
        & git clone "https://github.com/john-mnz/ComfyUI-Inspyrenet-Rembg.git" $nodePath
        Write-Ok "Node geklont nach $nodePath"
        Write-Warn2 "Dependency 'transparent-background' wird beim naechsten ComfyUI-Start (bzw. via Manager) installiert."
    }
    catch {
        Write-Warn2 "git clone fehlgeschlagen. Bitte den Node ueber den ComfyUI-Manager installieren:"
        Write-Host  "    Manager -> Custom Nodes Manager -> Suche 'Inspyrenet' -> Install -> Restart"
    }
}
else {
    Write-Warn2 "git nicht gefunden. Node bitte ueber den ComfyUI-Manager installieren:"
    Write-Host  "    Manager -> Custom Nodes Manager -> Suche 'Inspyrenet' -> Install -> Restart"
}

# ---------------------------------------------------------------------------
# 4) Verifikation
# ---------------------------------------------------------------------------
Write-Step "Verifikation"

$checks = @(
    @{ Label = "Wan ti2v-5B Modell"; Path = (Join-Path $diffDir "wan2.2_ti2v_5B_fp16.safetensors") },
    @{ Label = "Wan 2.2 VAE";        Path = (Join-Path $vaeDir  "wan2.2_vae.safetensors") },
    @{ Label = "umt5 Text-Encoder";  Path = (Join-Path $models  "text_encoders\umt5_xxl_fp8_e4m3fn_scaled.safetensors") },
    @{ Label = "Inspyrenet Node";    Path = $nodePath }
)
$allOk = $true
foreach ($c in $checks) {
    if (Test-Path $c.Path) { Write-Ok $c.Label }
    else { Write-Warn2 "FEHLT: $($c.Label)  ($($c.Path))"; $allOk = $false }
}

Write-Host ""
if ($allOk) {
    Write-Host "Alles bereit. Naechste Schritte:" -ForegroundColor Green
    Write-Host "  1. ComfyUI (neu) starten -- damit der Inspyrenet-Node geladen wird."
    Write-Host "  2. Im vj-pipeline-Ordner:  python vj_portrait_batch.py --limit 1"
} else {
    Write-Warn2 "Einige Teile fehlen noch (siehe oben). Nach dem Beheben dieses Skript erneut starten."
}
