# Gateway Git Sync

Windows에서 이 저장소를 간단히 동기화할 수 있게 만든 Git GUI 도구입니다 (.NET 8 WinForms, 단일 실행 파일).
Git 명령어를 잘 몰라도 현재 저장소 상태를 새로고침하고, Pull, Commit & Push, Push, GitHub 열기를 바로 실행할 수 있습니다.

## 실행

저장소 루트의 `Gateway Git Sync.exe`를 더블클릭하면 실행됩니다.
실행 위치 또는 실행 파일의 상위 경로를 기준으로 `.git` 폴더를 자동으로 찾아 현재 프로젝트 저장소를 인식합니다.
그래도 찾지 못하면 폴더 선택 창이 열립니다.

## 다시 빌드하기

```powershell
.\scripts\publish-git-sync.ps1
```

빌드 결과는 `release\git-sync\Gateway Git Sync.exe`에 생성되고, 같은 파일이 저장소 루트의
`Gateway Git Sync.exe`로도 복사됩니다. `dotnet` SDK 8 이상이 필요합니다.

## 동작 장치 (안전장치)

- `Pull`은 `--ff-only`만 사용합니다. fast-forward가 불가능하면 실패로 표시하고 강제 병합은 하지 않습니다.
- 로컬 변경 파일이 있으면 `Pull`을 막아 충돌 가능성을 줄입니다.
- 커밋할 변경이 없으면 `Commit & Push`는 중단되고 안내 메시지를 보여줍니다.
- 강제 Push(`--force`)나 자동 충돌 해결은 어떤 버튼으로도 수행하지 않습니다.
- `GitHub 열기`는 하드코딩된 주소가 아니라 실제 `origin` 원격 URL을 읽어 엽니다.

## 소스 위치

핵심 로직과 UI는 [tools/git-sync/Program.cs](D:/Claude/MW-Gateway-Manager/tools/git-sync/Program.cs)에 있습니다.
빌드 설정은 [tools/git-sync/MwGatewayGitSync.csproj](D:/Claude/MW-Gateway-Manager/tools/git-sync/MwGatewayGitSync.csproj),
배포 스크립트는 [scripts/publish-git-sync.ps1](D:/Claude/MW-Gateway-Manager/scripts/publish-git-sync.ps1)를 사용합니다.
