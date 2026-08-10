param(
  [string]$GoogleMapsWebApiKey = $env:GOOGLE_MAPS_WEB_API_KEY,
  [ValidatePattern('^/.*/$|^/$')]
  [string]$BaseHref = '/app/',
  [switch]$TunisiaMode
)

$ErrorActionPreference = 'Stop'

$taskRoot = Split-Path -Parent $PSScriptRoot
$flutterArgs = @(
  'build', 'web',
  '--no-wasm-dry-run',
  '--pwa-strategy=none',
  '--base-href', $BaseHref
)
if (-not [string]::IsNullOrWhiteSpace($GoogleMapsWebApiKey)) {
  $flutterArgs += "--dart-define=GOOGLE_PLACES_CLIENT_API_KEY=$GoogleMapsWebApiKey"
  $flutterArgs += '--dart-define=DREWEL_ENABLE_GOOGLE_WEB_MAP=true'
}
if ($TunisiaMode) {
  $flutterArgs += '--dart-define=DREWEL_TUNISIA_TEST_MODE=true'
}

Push-Location $taskRoot
try {
  & flutter @flutterArgs
  if ($LASTEXITCODE -ne 0) {
    throw "Flutter web build failed with exit code $LASTEXITCODE."
  }

  $indexPath = Join-Path $taskRoot 'build\web\index.html'
  $indexHtml = Get-Content -LiteralPath $indexPath -Raw
  $versionPath = Join-Path $taskRoot 'build\web\version.json'
  $versionInfo = Get-Content -LiteralPath $versionPath -Raw | ConvertFrom-Json
  $assetVersion = "$($versionInfo.version)-$($versionInfo.build_number)-$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())"
  $bootstrapPath = Join-Path $taskRoot 'build\web\flutter_bootstrap.js'
  $bootstrap = Get-Content -LiteralPath $bootstrapPath -Raw
  $mainToken = '"mainJsPath":"main.dart.js"'
  if (-not $bootstrap.Contains($mainToken)) {
    throw 'Flutter main.dart.js bootstrap token was not found.'
  }
  $bootstrap = $bootstrap.Replace(
    $mainToken,
    "`"mainJsPath`":`"main.dart.js?v=$assetVersion`""
  )
  [System.IO.File]::WriteAllText(
    $bootstrapPath,
    $bootstrap,
    [System.Text.UTF8Encoding]::new($false)
  )
  $indexHtml = $indexHtml.Replace(
    'src="flutter_bootstrap.js"',
    "src=`"flutter_bootstrap.js?v=$assetVersion`""
  )
  $placeholder = '<!-- GOOGLE_MAPS_WEB_SCRIPT -->'
  if (-not $indexHtml.Contains($placeholder)) {
    throw 'Google Maps web key placeholder was not found in the built index.'
  }
  $mapsScript = if ([string]::IsNullOrWhiteSpace($GoogleMapsWebApiKey)) {
    ''
  } else {
    "<script src=`"https://maps.googleapis.com/maps/api/js?key=$GoogleMapsWebApiKey`"></script>"
  }
  $indexHtml = $indexHtml.Replace($placeholder, $mapsScript)
  [System.IO.File]::WriteAllText(
    $indexPath,
    $indexHtml,
    [System.Text.UTF8Encoding]::new($false)
  )
  if ([string]::IsNullOrWhiteSpace($GoogleMapsWebApiKey)) {
    Write-Host 'Flutter web build completed with OpenStreetMap (no Google key required).'
  } else {
    Write-Host 'Flutter web build completed with Google Maps and automatic OpenStreetMap fallback.'
  }
}
finally {
  Pop-Location
}
