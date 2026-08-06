$ErrorActionPreference = "Stop"
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$project = Join-Path $repositoryRoot "tools\git-sync\MwGatewayGitSync.csproj"
$output = Join-Path $repositoryRoot "release\git-sync"

& dotnet publish $project -c Release -r win-x64 --self-contained true `
    -p:PublishSingleFile=true -o $output
if ($LASTEXITCODE -ne 0) {
    throw "Git sync GUI publish failed with exit code $LASTEXITCODE"
}

Write-Host "Git sync GUI published to $output"
