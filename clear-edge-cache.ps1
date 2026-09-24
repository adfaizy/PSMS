# Clear Edge Default caches to reclaim space. Close Edge first.
$edge = Get-Process msedge -ErrorAction SilentlyContinue
if ($edge) {
  Write-Host "Close Microsoft Edge completely, then run this script again."
  exit 1
}
$base = "$env:LOCALAPPDATA\Microsoft\Edge\User Data\Default"
$targets = @(
  "Cache\Cache_Data",
  "Code Cache",
  "Service Worker\CacheStorage",
  "GPUCache"
)
foreach ($t in $targets) {
  $p = Join-Path $base $t
  if (Test-Path $p) {
    $before = (Get-ChildItem $p -Recurse -File -EA SilentlyContinue | Measure-Object Length -Sum).Sum
    Remove-Item $p -Recurse -Force -EA SilentlyContinue
    New-Item -ItemType Directory -Path $p -Force | Out-Null
    Write-Host ("Cleared {0} (~{1} MB)" -f $t, [math]::Round(($before/1MB),1))
  }
}
Write-Host "Done. Restart Edge."
