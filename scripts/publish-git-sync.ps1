$ErrorActionPreference = "Stop"
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$project = Join-Path $repositoryRoot "tools\git-sync\MwGatewayGitSync.csproj"
$output = Join-Path $repositoryRoot "release\git-sync"
$rootExe = Join-Path $repositoryRoot "Gateway Git Sync.exe"
$publishedExe = Join-Path $output "Gateway Git Sync.exe"

if (Test-Path $output) {
    Remove-Item -LiteralPath $output -Recurse -Force
}

& dotnet publish $project -c Release -r win-x64 --self-contained true `
    -p:PublishSingleFile=true -o $output
if ($LASTEXITCODE -ne 0) {
    throw "Git sync GUI publish failed with exit code $LASTEXITCODE"
}

if (-not (Test-Path $publishedExe)) {
    throw "Published EXE not found: $publishedExe"
}

Copy-Item -LiteralPath $publishedExe -Destination $rootExe -Force
Write-Host "Git sync GUI published to $output"
Write-Host "Project EXE copied to $rootExe"
