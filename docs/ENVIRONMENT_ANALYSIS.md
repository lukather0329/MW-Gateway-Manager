# 환경 분석 결과 (Stage 1)

작성일: 2026-08-05

> **2026-08-07 업데이트**: 이 문서 작성 이후, 이 개발 머신(Windows 11)에 실제
> XAMPP Apache 2.4.58이 `C:\xampp\apache`에 설치되었다 (D 드라이브가 아닌 C
> 드라이브 — 아래 3절의 `D:\xampp\apache` 가정과 다름, 개발 머신 한정 사실이며
> 운영 Windows Server 2019의 실제 경로는 여전히 별도 확인 필요). 이를 이용해
> `APACHE_COMMAND_RUNNER=real`로 전환해 실제 `httpd.exe`에 대한 종단간 검증을
> 1회 수행했고, 그 결과와 발견한 문제(모듈 파싱 버그, Windows 서비스 등록
> 필요성)는 [REVIEW_FOR_CODEX.md](../REVIEW_FOR_CODEX.md#실제-apache로-검증한-내용과-발견한-문제-2026-08-07)에
> 정리했다. 아래 4절의 "실제 Apache 미검증" 위험은 개발 머신 기준으로는 부분
> 해소되었으나, 운영 Windows Server 2019 기준으로는 여전히 유효하다.

## 1. 현재 환경 분석 결과

이 세션이 실행 중인 개발 머신을 조사한 결과는 다음과 같다.

| 항목 | 결과 |
|---|---|
| 작업 폴더 | `C:\work\MW-Gateway_Mgr` (Git 저장소 아님, `.claude` 폴더만 존재하는 빈 프로젝트) |
| OS | Windows 11 Pro 10.0.26200 (개발 머신, Windows Server 2019 아님) |
| Node.js | v24.14.0 |
| npm | 11.9.0 |
| git | 2.54.0.windows.1 |
| `D:\xampp\apache` | 존재하지 않음 (D 드라이브 자체가 없음) |
| `C:\xampp` | 존재하지 않음 |

**결론: 이 개발 머신에는 실제 운영용 XAMPP/Apache가 설치되어 있지 않다.** 즉, 이 세션에서는 실제 운영 서버(Windows Server 2019 + XAMPP)에 접근할 수 없으며, Apache 관련 기능은 명세서 3.1/9단계 지시에 따라 **가정값 + 설정 가능한 값**으로 구현하고, 실제 동작 검증은 운영 서버 배포 후 관리자가 수행해야 한다.

## 2. 확인된 사실

- 개발 머신에서 Node.js/npm/git은 정상 사용 가능하며 프로젝트를 초기화하고 빌드/테스트를 실행할 수 있다.
- 프로젝트 폴더는 비어 있어 새 저장소 구조를 처음부터 생성해야 한다 (지시서 21번 항목).
- Git 저장소가 아직 없으므로 `git init`부터 시작해야 한다.

## 3. 가정한 사항 (운영 서버 관련 — 반드시 설정값으로 분리)

아래 값들은 실제 운영 서버를 확인할 수 없어 지시서 3.1/8절의 기본값을 그대로 가정한 것이다. 모두 `SystemSetting` 테이블과 `.env`로 분리하여 배포 시 수정 가능하게 한다.

- Apache 루트: `D:\xampp\apache`
- httpd 실행파일: `D:\xampp\apache\bin\httpd.exe`
- vhosts 파일: `D:\xampp\apache\conf\extra\httpd-vhosts.conf`
- 프로그램별 설정 폴더: `D:\xampp\apache\conf\mw-sites`
- 백업 폴더: `D:\xampp\apache\conf\mw-backups`
- SSL 인증서 경로: `D:\certs\roboworks_wildcard\_.roboworks.co.kr-crt.pem`
- SSL 개인키 경로: `D:\certs\roboworks_wildcard\_.roboworks.co.kr-key.pem`
- 필요 모듈: `mod_proxy`, `mod_proxy_http`, `mod_proxy_wstunnel`, `mod_rewrite`, `mod_ssl` — 실제 활성화 여부는 코드가 가정하지 않고, `httpd.exe -M` 결과를 실행 시점에 조회하여 판단한다 (`ApacheModuleInspector`).
- Apache 버전: 가정하지 않음. `httpd.exe -v`를 실행 시점에 조회한다.
- 기존 VirtualHost/도메인 목록: 알 수 없음. 시스템은 기존 `httpd-vhosts.conf`를 절대 덮어쓰거나 파싱/수정하지 않고, `IncludeOptional` 한 줄 존재 여부만 문자열 검사로 확인 후 없을 때만 관리자 승인을 받아 추가한다.
- Apache 실행 계정: 알 수 없음. 배포 문서(`DEPLOY_WINDOWS_SERVER.md`)에서 실행 계정 확인 절차와 최소 권한 부여 방법을 안내한다.

## 4. 위험 요소

1. **실제 Apache 미검증**: 이 개발 세션에서는 `httpd.exe -t`, `-k graceful`, `-M` 등을 실제로 실행/검증할 수 없다. 따라서 `ApacheCommandRunner`를 인터페이스로 분리하고, 실제 실행 구현체(`RealApacheCommandRunner`)와 테스트/미검증 환경용 목 구현체(`MockApacheCommandRunner`)를 분리한다. **운영 서버 배포 후 관리자가 반드시 수동으로 1회 이상 전체 시나리오를 재검증해야 한다** (`docs/APACHE_SETUP.md`의 절차 참고).
2. **권한 문제**: Node 프로세스가 Apache 설정 파일 쓰기 및 서비스 제어 권한이 필요하다. MVP는 지시서 10절의 4번(관리자 권한으로 실행 + 위험 문서화) 방식을 채택하고, 향후 서비스 계정 최소 권한으로 전환하는 방법을 문서화한다.
3. **명령어 삽입 위험**: 모든 외부 프로세스 실행은 `execFile`/`spawn`으로 인수를 배열로 분리하며, 문자열 결합으로 쉘에 전달하지 않는다.
4. **기존 서비스 영향**: `httpd-vhosts.conf`는 절대 전체 덮어쓰기하지 않고, 새 conf는 별도 `mw-sites` 폴더에만 생성/수정한다.
5. **가정값 오류 가능성**: 위 3번 가정값이 실제 운영 서버와 다를 수 있으므로, 최초 실행 시 설정 마법사(12절)가 실제 경로 존재 여부를 검사하고 관리자가 직접 확인/수정하도록 강제한다.

## 5. 구현 단계

지시서 16절의 1~8단계를 그대로 따른다 (본 문서가 1단계 산출물). 이후 단계별로 진행 상황을 보고한다.

## 6. 생성하거나 수정할 파일 목록 (1차)

- `docs/ENVIRONMENT_ANALYSIS.md` (본 파일)
- 모노레포 루트: `package.json`, `tsconfig.base.json`, `.gitignore`, `.editorconfig`
- `apps/server/*` (Express+TS+Prisma 백엔드 전체)
- `apps/web/*` (React+TS 프론트엔드 전체)
- `packages/shared/*` (공용 타입/스키마)
- `docs/*.md` (README, DEPLOY_WINDOWS_SERVER, APACHE_SETUP, TROUBLESHOOTING, NEXT_STEPS, REVIEW_FOR_CODEX)
