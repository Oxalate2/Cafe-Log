# Renders tools/icon.svg into the PNG app icons in /icons using headless Edge (or Chrome).
# Run after editing the SVG:  powershell -File tools/render-icon.ps1
$root = Split-Path $PSScriptRoot -Parent
$svg = Join-Path $PSScriptRoot 'icon.svg'
$browser = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
             "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
             "$env:ProgramFiles\Google\Chrome\Application\chrome.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $browser) { throw 'Needs Microsoft Edge or Google Chrome installed.' }

$svgText = Get-Content $svg -Raw
$tmp = Join-Path $env:TEMP "cafe-log-icon"
New-Item -ItemType Directory -Force $tmp | Out-Null

foreach ($size in 180, 192, 512) {
  $html = Join-Path $tmp "icon-$size.html"
  # only resize the outer <svg> tag (the background rect also says 512)
  $sized = ([regex]'(<svg[^>]*?)width="512" height="512"').Replace($svgText, "`${1}width=""$size"" height=""$size""", 1)
  Set-Content -Encoding utf8 $html "<!doctype html><html><body style='margin:0;overflow:hidden'>$sized</body></html>"
  $out = Join-Path $root "icons\icon-$size.png"
  & $browser --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 `
    --default-background-color=00000000 --window-size="$size,$size" --screenshot="$out" "file:///$($html -replace '\\','/')" 2>$null | Out-Null
  Write-Output "wrote $out"
}
