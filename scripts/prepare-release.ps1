param(
  [string]$OutputDirectory = ".release"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
if (-not [System.IO.Path]::IsPathRooted($OutputDirectory)) {
  $OutputDirectory = Join-Path $root $OutputDirectory
}
$OutputDirectory = [System.IO.Path]::GetFullPath($OutputDirectory)
if ($OutputDirectory -eq [System.IO.Path]::GetFullPath($root)) {
  throw "The release output directory cannot be the repository root."
}

$app = Get-Content -Raw -Encoding UTF8 (Join-Path $root "app.config.json") | ConvertFrom-Json
$version = [string]$app.version
if ($version -notmatch '^\d+\.\d+\.\d+$') {
  throw "app.config.json must contain a stable Semantic Versioning version."
}

$changelog = [System.IO.File]::ReadAllText((Join-Path $root "CHANGELOG.md"), [System.Text.Encoding]::UTF8)
$escaped = [regex]::Escape($version)
$heading = [regex]::Match($changelog, "(?m)^## v$escaped(?:[^\r\n]*)\r?\n")
if (-not $heading.Success) { throw "CHANGELOG.md is missing a section for v$version." }
$start = $heading.Index + $heading.Length
$next = [regex]::Match($changelog.Substring($start), '(?m)^## ')
$body = if ($next.Success) { $changelog.Substring($start, $next.Index) } else { $changelog.Substring($start) }
$body = $body.Trim()
if ([string]::IsNullOrWhiteSpace($body)) { throw "Release notes cannot be empty." }

$readableSource = Join-Path $root "dist/index.html"
$selfExtractSource = Join-Path $root "dist/index.self-extract.html"
foreach ($source in @($readableSource, $selfExtractSource)) {
  if (-not (Test-Path -LiteralPath $source)) { throw "Build the standalone HTML before preparing the release: $source" }
}

New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$baseName = "htmlapps-music-cue-pad-v$version"
$readableOut = Join-Path $OutputDirectory "$baseName.html"
$selfExtractOut = Join-Path $OutputDirectory "$baseName.self-extract.html"
$zipOut = Join-Path $OutputDirectory "$baseName.zip"
$checksumsOut = Join-Path $OutputDirectory "SHA256SUMS.txt"
$notesOut = Join-Path $OutputDirectory "release-notes.md"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

Copy-Item -LiteralPath $readableSource -Destination $readableOut -Force
Copy-Item -LiteralPath $selfExtractSource -Destination $selfExtractOut -Force

$stage = Join-Path $OutputDirectory (".release-stage-" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $stage -Force | Out-Null
try {
  Copy-Item -LiteralPath $readableOut -Destination (Join-Path $stage ([System.IO.Path]::GetFileName($readableOut)))
  Copy-Item -LiteralPath $selfExtractOut -Destination (Join-Path $stage ([System.IO.Path]::GetFileName($selfExtractOut)))
  foreach ($name in @("README.md", "README.ja.md", "LICENSE", "THIRD_PARTY_NOTICES.md")) {
    Copy-Item -LiteralPath (Join-Path $root $name) -Destination (Join-Path $stage $name)
  }
  Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $zipOut -CompressionLevel Optimal -Force
} finally {
  Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue
}

$lines = @()
foreach ($artifact in @($readableOut, $selfExtractOut, $zipOut)) {
  $algorithm = [System.Security.Cryptography.SHA256]::Create()
  try {
    $stream = [System.IO.File]::OpenRead($artifact)
    try {
      $digest = $algorithm.ComputeHash($stream)
    } finally {
      $stream.Dispose()
    }
    $sha = ($digest | ForEach-Object { $_.ToString("x2") }) -join ""
  } finally {
    $algorithm.Dispose()
  }
  $lines += "$sha  $([System.IO.Path]::GetFileName($artifact))"
}
[System.IO.File]::WriteAllText($checksumsOut, ([string]::Join([Environment]::NewLine, $lines) + [Environment]::NewLine), $utf8NoBom)
[System.IO.File]::WriteAllText($notesOut, ($body + [Environment]::NewLine), $utf8NoBom)

Write-Host "[OK] Prepared Music Cue Pad v$version release assets."
Write-Host "[OK] Release assets: $OutputDirectory"
