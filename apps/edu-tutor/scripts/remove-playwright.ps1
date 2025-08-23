# Remove remaining Playwright files and folders for edu-tutor
$base = Split-Path -Parent $PSScriptRoot
$paths = @(
    "$base\playwright.config.ts",
    "$base\e2e\app.spec.ts",
    "$base\playwright-report\index.html",
    "$base\playwright-report\data",
    "$base\playwright-report"
)
foreach ($p in $paths) {
    if (Test-Path $p) {
        Write-Host "Removing: $p"
        Remove-Item $p -Recurse -Force -ErrorAction SilentlyContinue
    } else {
        Write-Host "Not found: $p"
    }
}
Write-Host "Playwright cleanup complete. Consider running 'git status' and committing the deletions."
