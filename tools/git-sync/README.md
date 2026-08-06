# MW Gateway Git Sync

Windows용 간단한 Git 동기화 GUI 도구입니다 (.NET 8 WinForms, 단일 실행 파일).
Git 명령어를 몰라도 이 저장소를 새로고침/Pull/Commit&Push/Push 할 수 있도록
만든 사내용 유틸리티이며, MW Gateway Manager 애플리케이션 자체와는 무관한
개발 편의 도구입니다.

## 실행

빌드된 실행 파일(`MW Gateway Git Sync.exe`, 저장소 루트)을 그냥 더블클릭하면
됩니다. 실행 위치(또는 상위 폴더)에서 `.git` 폴더를 자동으로 찾아 저장소를
인식합니다. 찾지 못하면 폴더 선택 창이 뜹니다.

## 다시 빌드하기

```powershell
.\scripts\publish-git-sync.ps1
```

`release\git-sync\MW Gateway Git Sync.exe`에 생성됩니다. 저장소 루트에 두고
쓰려면 그 파일을 루트로 복사하세요. (`dotnet` SDK 8 이상 필요)

## 동작 원칙 (안전장치)

- **Pull은 `--ff-only`만 사용합니다.** Fast-forward가 불가능하면(원격/로컬이
  분기된 상태) 실패로 표시될 뿐, 강제로 합치거나 덮어쓰지 않습니다.
- 로컬에 커밋되지 않은 변경이 있으면 Pull 자체를 막습니다 (충돌 방지).
- 커밋할 변경이 없으면 "Commit & Push"가 조용히 넘어가지 않고 명시적으로
  "커밋할 변경 파일이 없습니다"라고 표시합니다.
- 자동 충돌 해결이나 강제 Push(`--force`)는 어떤 버튼으로도 수행하지 않습니다.
- "GitHub 열기"는 `git remote get-url origin`으로 실제 원격 주소를 읽어
  엽니다 (하드코딩된 URL 없음). `origin`이 아직 없으면 안내 메시지만 표시합니다.

## 소스 위치

`tools/git-sync/Program.cs` 하나에 전체 로직(진입점, Git 실행 래퍼, 창 UI)이
들어 있습니다. UI는 XAML 없이 코드로 구성된 WinForms입니다.
