# scripts/publish-pbix.ps1
#
# Generate a clean, GitHub-publishable .pbix from the fixture .pbip,
# guaranteed free of the local helper-bypass code.
#
# The dev workflow uses skip-worktree on src/local/exportHelper.ts (real
# impl with helper URL) and the fixture's bundled pbiviz.json (real-impl
# bundle) so Mothership's PBI Desktop has the bypass active. This script
# temporarily swaps both back to the committed stub state, rebuilds the
# bundle, walks you through PBI Desktop's Save As, verifies the resulting
# .pbix contains zero references to the helper URL, then restores the
# real-impl state so your dev environment keeps working.
#
# Usage:
#   pwsh scripts/publish-pbix.ps1                       # uses default output path
#   pwsh scripts/publish-pbix.ps1 -OutputPath <path>    # custom .pbix output
#   npm run publish-pbix                                # via package.json script

param(
    [string]$OutputPath = "$env:USERPROFILE\SANDBOX\Reporting-Gantt-publish.pbix",
    [string]$LeakPattern = "mothership.cortex.lan"
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path "$PSScriptRoot/..").Path
Set-Location $repoRoot

$helperPath  = "src/local/exportHelper.ts"
$fixturePath = "fixtures/PBI-Reporting-Gantt.Report/CustomVisuals/reportingGantt7C9F3E5A1B2D4F8E6A0C3B5D7E9F1A2C/resources/reportingGantt7C9F3E5A1B2D4F8E6A0C3B5D7E9F1A2C.pbiviz.json"
$customDir   = "fixtures/PBI-Reporting-Gantt.Report/CustomVisuals/reportingGantt7C9F3E5A1B2D4F8E6A0C3B5D7E9F1A2C"
$pbipPath    = (Resolve-Path "fixtures/PBI-Reporting-Gantt.pbip").Path
$launchPbi   = "C:/Users/Corte/.cortex/agents/_shared/skills/pbi-custom-visual-build/scripts/launch-pbi.ps1"
$shotPath    = "$env:USERPROFILE\SANDBOX\publish-pbix-stub-state.png"

$realImplBackup = Join-Path $env:TEMP "publish-pbix-real-impl.ts.bak"
$realFixtureBackup = Join-Path $env:TEMP "publish-pbix-real-fixture.pbiviz.json.bak"

function Test-PbixForLeak([string]$path, [string]$pattern) {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::OpenRead($path)
    try {
        foreach ($entry in $zip.Entries) {
            $stream = $entry.Open()
            try {
                $reader = New-Object IO.StreamReader($stream)
                try {
                    $content = $reader.ReadToEnd()
                    if ($content -match [regex]::Escape($pattern)) {
                        Write-Host "  LEAK in entry: $($entry.FullName)" -ForegroundColor Red
                        return $true
                    }
                } finally { $reader.Dispose() }
            } finally { $stream.Dispose() }
        }
    } finally { $zip.Dispose() }
    return $false
}

function Invoke-PbivizPackage {
    Write-Host "[publish-pbix] npx pbiviz package..." -ForegroundColor Cyan
    & npx pbiviz package 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "pbiviz package failed (exit $LASTEXITCODE)" }
}

function Invoke-DeployPbiviz {
    $src = Get-ChildItem "dist/*.pbiviz" | Where-Object { $_.Name -like "reportingGantt*" } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $src) { throw "No reportingGantt*.pbiviz found in dist/" }
    Write-Host "[publish-pbix] Deploying $($src.Name) -> CustomVisuals/" -ForegroundColor Cyan
    Get-ChildItem $customDir | Remove-Item -Recurse -Force
    Expand-Archive -LiteralPath $src.FullName -DestinationPath $customDir -Force
}

try {
    Write-Host "===== publish-pbix : produce clean .pbix =====" -ForegroundColor Yellow

    # 1. Back up the real-impl files (skip-worktree'd; not in git).
    Write-Host "[1/9] backing up local real-impl state..." -ForegroundColor Cyan
    Copy-Item $helperPath  $realImplBackup    -Force
    Copy-Item $fixturePath $realFixtureBackup -Force

    # 2. Un-skip-worktree so git checkout can restore committed state.
    Write-Host "[2/9] un-skip-worktree on helper + fixture bundle..." -ForegroundColor Cyan
    & git update-index --no-skip-worktree $helperPath  | Out-Null
    & git update-index --no-skip-worktree $fixturePath | Out-Null

    # 3. Restore committed (stub) versions to disk.
    Write-Host "[3/9] git checkout stub versions..." -ForegroundColor Cyan
    & git checkout HEAD -- $helperPath  | Out-Null
    & git checkout HEAD -- $fixturePath | Out-Null

    # 4. Rebuild + deploy with stub on disk.
    Write-Host "[4/9] rebuild with stub..." -ForegroundColor Cyan
    Invoke-PbivizPackage
    Invoke-DeployPbiviz

    # 5. Kill+launch PBI Desktop on the fixture .pbip so it loads the stub bundle.
    Write-Host "[5/9] relaunch PBI Desktop with stub bundle..." -ForegroundColor Cyan
    & powershell.exe -ExecutionPolicy Bypass -File $launchPbi -PbipPath $pbipPath -ScreenshotPath $shotPath -WaitSeconds 180 | Out-Null

    # 6. Prompt operator to Save As.
    Write-Host ""
    Write-Host "===================================================================" -ForegroundColor Yellow
    Write-Host " IN PBI DESKTOP: File -> Save As -> 'Power BI files (*.pbix)'" -ForegroundColor Yellow
    Write-Host " Save to:" -ForegroundColor Yellow
    Write-Host "   $OutputPath" -ForegroundColor White
    Write-Host "===================================================================" -ForegroundColor Yellow
    if (-not (Test-Path (Split-Path $OutputPath -Parent))) {
        New-Item -ItemType Directory -Path (Split-Path $OutputPath -Parent) -Force | Out-Null
    }
    Read-Host "[6/9] Press Enter once you have saved the .pbix"

    if (-not (Test-Path $OutputPath)) {
        throw ".pbix not found at $OutputPath - did you save to the right location?"
    }

    # 7. Verify the saved .pbix is free of the helper URL.
    Write-Host "[7/9] scanning .pbix for leak pattern '$LeakPattern'..." -ForegroundColor Cyan
    $leaked = Test-PbixForLeak -path $OutputPath -pattern $LeakPattern
    if ($leaked) {
        throw "LEAK detected in $OutputPath - the saved .pbix contains '$LeakPattern'. Did PBI Desktop fully reload the stub bundle? Aborting before restore so you can investigate."
    }
    Write-Host "  clean: no '$LeakPattern' anywhere in .pbix" -ForegroundColor Green
}
finally {
    # 8. ALWAYS restore real-impl state, even on error/cancel.
    if (Test-Path $realImplBackup) {
        Write-Host "[8/9] restoring real-impl state + re-applying skip-worktree..." -ForegroundColor Cyan
        Copy-Item $realImplBackup    $helperPath  -Force
        Copy-Item $realFixtureBackup $fixturePath -Force
        & git update-index --skip-worktree $helperPath  | Out-Null
        & git update-index --skip-worktree $fixturePath | Out-Null
        Remove-Item $realImplBackup -Force
        Remove-Item $realFixtureBackup -Force
    }
}

# 9. Rebuild + redeploy with real impl so PBI dev keeps working.
Write-Host "[9/9] rebuild + redeploy with real impl..." -ForegroundColor Cyan
Invoke-PbivizPackage
Invoke-DeployPbiviz

Write-Host ""
Write-Host "===== DONE =====" -ForegroundColor Green
Write-Host "Clean .pbix at:      $OutputPath" -ForegroundColor White
Write-Host "Real-impl restored:  $helperPath (skip-worktree active)" -ForegroundColor White
Write-Host ""
Write-Host "Next: gh release create <tag> ""$OutputPath"" --notes ""...""" -ForegroundColor Yellow
