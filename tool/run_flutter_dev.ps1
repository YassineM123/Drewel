param(
  [string]$GooglePlacesApiKey = $env:GOOGLE_PLACES_CLIENT_API_KEY,
  [string]$DeviceId,
  [switch]$TunisiaMode
)

# Places Autocomplete/Details and Geocoding are plain HTTP calls that need a
# dart-define key at run/build time (unlike the Maps SDK tile key, which is
# wired natively via local.properties/Secrets.xcconfig). `flutter run` never
# supplies this automatically, so without this script (or the equivalent
# --dart-define-from-file=dart_defines.local.json flag) every mobile dev
# build silently sends empty-key Places/Geocoding requests and search fails
# with "Location search is temporarily unavailable."
$ErrorActionPreference = 'Stop'

$taskRoot = Split-Path -Parent $PSScriptRoot

if ([string]::IsNullOrWhiteSpace($GooglePlacesApiKey)) {
  $localPropertiesPath = Join-Path $taskRoot 'android\local.properties'
  if (Test-Path -LiteralPath $localPropertiesPath) {
    $match = Select-String -Path $localPropertiesPath -Pattern '^GOOGLE_PLACES_API_KEY=(.+)$'
    if (-not $match) {
      $match = Select-String -Path $localPropertiesPath -Pattern '^GOOGLE_MAPS_API_KEY=(.+)$'
    }
    if ($match) {
      $GooglePlacesApiKey = $match.Matches[0].Groups[1].Value.Trim()
    }
  }
}

if ([string]::IsNullOrWhiteSpace($GooglePlacesApiKey)) {
  Write-Warning 'No Google Places API key found (checked -GooglePlacesApiKey, $env:GOOGLE_PLACES_CLIENT_API_KEY, android/local.properties). Location search will show "temporarily unavailable".'
}

$flutterArgs = @('run')
if ($DeviceId) {
  $flutterArgs += @('-d', $DeviceId)
}
if (-not [string]::IsNullOrWhiteSpace($GooglePlacesApiKey)) {
  $flutterArgs += "--dart-define=GOOGLE_PLACES_CLIENT_API_KEY=$GooglePlacesApiKey"
}
if ($TunisiaMode) {
  $flutterArgs += '--dart-define=DREWEL_TUNISIA_TEST_MODE=true'
}

Push-Location $taskRoot
try {
  & flutter @flutterArgs
}
finally {
  Pop-Location
}
