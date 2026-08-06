# Windows Server 2019 배포 가이드

이 문서는 MW Gateway Manager를 실제 운영 Windows Server 2019 (XAMPP Apache가
이미 설치되어 있는 서버)에 배포하는 절차를 설명합니다.

이 저장소는 실제 운영 서버에 접근할 수 없는 개발 환경에서 작성되었습니다
(자세한 내용은 [docs/ENVIRONMENT_ANALYSIS.md](docs/ENVIRONMENT_ANALYSIS.md)).
아래 절차 중 "가정" 표시가 있는 항목은 실제 서버 상태에 맞게 조정하세요.

## 1. 사전 준비

| 항목 | 확인 방법 | 비고 |
|---|---|---|
| Node.js 설치 | `node -v` | LTS 20.x 이상 권장 |
| npm 설치 | `npm -v` | Node.js에 포함 |
| XAMPP Apache 존재 | `D:\xampp\apache\bin\httpd.exe` 존재 확인 | 경로는 가정값, 실제 확인 필요 |
| 관리자 권한 PowerShell | 서비스 등록, 방화벽 설정에 필요 | |

### Node.js 설치

1. https://nodejs.org 에서 Windows용 LTS 설치 파일 다운로드 (관리자가 직접 설치 —
   이 도구가 자동으로 설치하지 않습니다).
2. 설치 후 새 PowerShell 창에서 `node -v`, `npm -v`로 확인합니다.

## 2. 소스 배치 및 빌드

```powershell
cd D:\apps
git clone <내부 저장소 URL> mw-gateway-manager
cd mw-gateway-manager
npm install
npm run build
```

`npm run build`는 `packages/shared` → `apps/server` → `apps/web` 순서로 빌드하며,
`apps/server/dist`(Node 실행 산출물)와 `apps/web/dist`(정적 파일)가 생성됩니다.

## 3. 환경변수 설정

```powershell
Copy-Item .env.example apps\server\.env
notepad apps\server\.env
```

운영 환경에서 반드시 확인/수정할 값:

- `NODE_ENV=production`
- `DATABASE_URL` — 운영 DB 파일 경로 (예: `file:D:/apps/mw-gateway-manager/data/prod.db`)
- `SESSION_SECRET` — 충분히 긴 무작위 문자열로 교체 (예: `openssl rand -hex 32`)
- `WEB_ORIGIN` — 실제 관리 화면 접속 도메인/포트
- `APACHE_ROOT_PATH`, `APACHE_EXECUTABLE_PATH`, `APACHE_VHOSTS_PATH`,
  `APACHE_MANAGED_SITES_PATH`, `APACHE_BACKUP_PATH` — **실제 서버의 XAMPP 설치
  경로와 반드시 일치해야 합니다.**
- `SSL_CERTIFICATE_PATH`, `SSL_CERTIFICATE_KEY_PATH` — 실제 와일드카드/도메인
  인증서 경로
- `APACHE_COMMAND_RUNNER=real` — **운영 서버에서만 `real`로 설정합니다.** `mock`으로
  두면 Apache가 실제로 제어되지 않습니다.

## 4. 데이터베이스 마이그레이션 및 초기 관리자 생성

```powershell
cd apps\server
npx prisma migrate deploy
npx tsx prisma\seed.ts --username admin --password "운영용-강력한-비밀번호"
```

## 5. 서비스 등록 (Windows 서비스로 상시 실행)

Node.js 프로세스를 관리자가 로그아웃해도 계속 실행되도록 Windows 서비스로
등록합니다. [`node-windows`](https://github.com/coreybutler/node-windows) 또는
NSSM(Non-Sucking Service Manager) 사용을 권장합니다. 아래는 NSSM 예시입니다.

```powershell
# NSSM 다운로드/설치 후
nssm install MWGatewayManager "C:\Program Files\nodejs\node.exe" "D:\apps\mw-gateway-manager\apps\server\dist\server.js"
nssm set MWGatewayManager AppDirectory "D:\apps\mw-gateway-manager\apps\server"
nssm set MWGatewayManager AppEnvironmentExtra NODE_ENV=production
nssm start MWGatewayManager
```

프런트엔드(`apps/web/dist`)는 정적 파일이므로, 기존 XAMPP Apache에 별도
VirtualHost(관리 전용 도메인/포트)를 하나 만들어 정적 파일을 서빙하고
`/api`를 Node 프로세스(예: `127.0.0.1:4000`)로 프록시하거나, 별도의 경량
정적 파일 서버로 서빙합니다. 이 관리용 VirtualHost는 이 시스템이 관리하는
`mw-sites` 폴더가 아니라 관리자가 수동으로 한 번 구성합니다 (자기 자신을
등록 대상으로 삼지 않기 위함).

## 6. 방화벽

```powershell
New-NetFirewallRule -DisplayName "MW Gateway Manager (internal only)" `
  -Direction Inbound -Protocol TCP -LocalPort 4000 `
  -RemoteAddress 192.168.0.0/24 -Action Allow
```

`RemoteAddress`를 사내망 대역으로 제한하세요. 외부 인터넷에 4000번(API) 포트를
직접 노출하지 않습니다.

## 7. 관리자 접근 제한

관리 화면은 서버 설정 파일을 직접 변경하는 민감한 도구이므로, 다음 중 하나 이상을
반드시 적용합니다.

1. **사내 IP 대역 제한** — 위 방화벽 규칙, 또는 Apache 관리용 VirtualHost에
   `Require ip 192.168.0.0/24` 같은 접근 제어 추가.
2. **VPN 경유 접속** — 사내 VPN을 통해서만 관리용 도메인/포트에 도달 가능하도록 구성.
3. **관리자 전용 도메인 + IP 제한** — 일반 서비스 도메인과 분리된 별도 서브도메인을
   사용하고, 위 1/2와 함께 적용.

이 애플리케이션 자체는 세션 로그인, 로그인 시도 제한, CSRF, 보안 헤더(Helmet),
요청 속도 제한을 갖추고 있지만, **네트워크 수준의 접근 제한과 별개가 아니라 함께
적용해야 하는 방어선입니다.**

## 8. 로그 경로 / 백업 경로

- 애플리케이션 로그: NSSM/서비스 관리자의 stdout/stderr 리다이렉션 설정 또는
  `apps/server` 실행 시 표준출력을 파일로 리다이렉션.
- Apache 설정 백업: `.env`의 `APACHE_BACKUP_PATH` (기본 가정값
  `D:\xampp\apache\conf\mw-backups`) — 디스크 용량을 주기적으로 확인하세요. 이번
  MVP는 백업 자동 정리(오래된 백업 삭제) 기능이 없습니다 (NEXT_STEPS.md 참고).
- 변경 이력(AuditLog)/백업 메타데이터는 SQLite DB에 저장됩니다. DB 파일 자체도
  주기적으로 백업하세요.

## 9. 권한 설정 (중요 — 반드시 읽어주세요)

이번 MVP는 지시서 10절의 4번 방식, 즉 **관리자 권한으로 Node 프로세스를 실행하는
방식**을 채택했습니다 (Apache 설정 파일 쓰기 + `httpd.exe -k graceful` 실행에는
해당 파일/서비스에 대한 쓰기 및 제어 권한이 필요하기 때문입니다).

- **왜 필요한가**: `D:\xampp\apache\conf\...` 하위 파일 쓰기, `httpd.exe` 실행 권한이
  필요합니다.
- **위험**: Node 프로세스가 침해당할 경우 Apache 설정 전체 및 서버의 다른 파일에도
  영향을 줄 수 있는 권한을 갖게 됩니다. 애플리케이션에 있는 입력 검증/명령어 인수
  분리/CSRF/속도 제한 등은 이 위험을 줄이지만 없애지는 못합니다.
- **운영 배포 시 축소 방안 (우선순위 순)**:
  1. Node 프로세스를 **로컬 서비스 계정**(전용, 비관리자)으로 실행하고, 그 계정에
     `D:\xampp\apache\conf\extra`, `D:\xampp\apache\conf\mw-sites`,
     `D:\xampp\apache\conf\mw-backups` 폴더에 대한 쓰기 권한과 `httpd.exe` 실행 권한만
     `icacls`로 명시적으로 부여합니다.
     ```powershell
     icacls "D:\xampp\apache\conf\mw-sites" /grant "MWGatewaySvc:(OI)(CI)M"
     icacls "D:\xampp\apache\conf\mw-backups" /grant "MWGatewaySvc:(OI)(CI)M"
     ```
  2. 이것이 당장 어렵다면, 최소한 관리 화면 자체의 네트워크 노출을 7절처럼 강하게
     제한해 침해 경로를 최소화합니다.
  3. 장기적으로는 "별도 로컬 관리 에이전트가 제한된 명령만 수행" 구조로 전환하는
     것을 검토할 수 있습니다 (NEXT_STEPS.md 참고 — 이번 범위 아님).

## 10. 최초 배포 후 확인 절차

1. `http://<서버>:4000/api/health` 가 `{"ok":true}`를 반환하는지 확인.
2. 관리 화면에 로그인.
3. **Apache 상태** 메뉴에서 "최초 설정 마법사 검사"를 실행해 실제 경로/모듈/인증서가
   모두 정상(✔)인지 확인. (APACHE_SETUP.md 참고)
4. 문제가 없으면 IncludeOptional 적용 버튼으로 `httpd-vhosts.conf`에 include 라인을
   1회 추가.
5. 테스트용 프로그램 1개를 등록 → 미리보기 → 적용까지 실제로 수행해 정상 동작을
   확인합니다 (TROUBLESHOOTING.md에 문제 발생 시 대응 절차가 있습니다).
