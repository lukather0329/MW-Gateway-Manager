# MW Gateway Manager

브라우저에서 프로그램 정보를 입력하면 Apache(XAMPP) Reverse Proxy 설정을 자동으로
생성하고, 백업 → 문법 검사 → 안전 적용 → 실패 시 자동 롤백까지 수행하는 내부 관리
도구입니다. Windows Server 2019 + XAMPP Apache 환경을 대상으로 하며, 기존
`httpd-vhosts.conf`와 기존 사이트는 건드리지 않고 별도의 `mw-sites` 폴더에만
설정을 생성/수정합니다.

> 개발 배경과 설계 결정, 현재 구현 범위는 [docs/ENVIRONMENT_ANALYSIS.md](docs/ENVIRONMENT_ANALYSIS.md)와
> [REVIEW_FOR_CODEX.md](REVIEW_FOR_CODEX.md)를 참고하세요.

## 프로젝트 목적

- 신규 프로그램 등록 시 수기로 `httpd-vhosts.conf`를 편집하며 발생하던 문법 오류,
  포트/도메인 충돌, WebSocket 설정 누락, Apache 재시작 실패로 인한 기존 서비스
  장애를 없애는 것이 목표입니다.
- 1차 MVP는 "적용 전 검증 + 백업 + 문법 검사 통과 시에만 반영 + 실패 시 자동 복구"라는
  안전 원칙을 최우선으로 구현합니다. 화려한 기능보다 기존 서비스에 장애를 일으키지
  않는 것이 더 중요합니다.

## 기술 스택

| 영역 | 기술 |
|---|---|
| Frontend | React + TypeScript (Vite) |
| Backend | Node.js + Express + TypeScript |
| DB | SQLite (Prisma ORM) |
| 인증 | 세션 쿠키(express-session) + bcrypt, CSRF 더블서브밋 토큰 |
| Apache 제어 | `child_process.execFile` (인수 배열 분리, 쉘 문자열 결합 없음) |

모노레포 구조 (`npm workspaces`):

```text
apps/server   Express + TypeScript API 서버, Prisma 스키마
apps/web      React + TypeScript 관리 화면
packages/shared  프런트/백엔드 공용 타입, 상수
docs/         환경 분석, 배포/운영 문서
```

## 설치

```bash
npm install
```

루트 `npm install` 한 번으로 모든 워크스페이스(`apps/server`, `apps/web`,
`packages/shared`)의 의존성이 설치됩니다.

### 환경변수

`.env.example`을 `apps/server/.env`로 복사한 뒤 값을 채우세요.

```bash
cp .env.example apps/server/.env
```

`.env.example`의 Apache 관련 경로(`APACHE_ROOT_PATH` 등)는 **실제 운영 서버를
확인하지 못한 상태에서의 가정값**입니다. 반드시 실제 Windows Server 2019 + XAMPP
경로와 일치하는지 확인 후 사용하세요 (자세한 내용은
[docs/ENVIRONMENT_ANALYSIS.md](docs/ENVIRONMENT_ANALYSIS.md)).

`APACHE_COMMAND_RUNNER` 환경변수로 Apache 제어 방식을 전환합니다.

- `mock` (기본값): 실제 `httpd.exe`를 실행하지 않습니다. 로컬 개발/자동화 테스트용.
- `real`: 실제 `httpd.exe -t`, `-k restart` 등을 실행합니다. **운영 Windows Server
  에서만 사용하세요.** (Windows는 무중단 graceful 재적재를 지원하지 않아
  `-k restart`를 씁니다 — 자세한 내용은 APACHE_SETUP.md 6절. 또한 Apache가
  Windows 서비스로 등록되어 있어야 동작합니다.)

### 데이터베이스 초기화

```bash
cd apps/server
npx prisma migrate deploy   # 최초 1회, 또는 npx prisma migrate dev (개발용)
```

### 초기 관리자 계정 생성

회원가입 화면은 존재하지 않습니다 (스펙 요구사항). 최초 관리자 계정은 시드
스크립트로 1회 생성합니다.

```bash
cd apps/server
npx tsx prisma/seed.ts --username admin --password "충분히-길고-고유한-비밀번호"
```

- 비밀번호는 10자 이상이어야 하며, `password`, `admin123` 같은 흔한 값은 거부됩니다.
- 이후 추가 관리자 계정(최대 2~3명)은 로그인 후 **시스템 설정 > 사용자 관리** 화면에서
  생성할 수 있습니다 (역시 별도의 공개 회원가입 API는 없습니다).

## 개발 실행

두 개의 터미널에서 각각 실행합니다.

```bash
npm run dev:server   # http://localhost:4000
npm run dev:web      # http://localhost:5173 (Vite, /api는 4000으로 프록시)
```

브라우저에서 `http://localhost:5173`로 접속해 로그인합니다.

## 테스트

```bash
npm test
```

`apps/server`의 Vitest 스위트를 실행합니다. 단위 테스트는 검증 로직/설정 생성기를,
통합 테스트는 임시 디렉터리 + Mock Apache 실행기로 백업/적용/롤백 파이프라인 전체를,
API 테스트는 임시 SQLite DB에 대해 실제 HTTP 요청(supertest)으로 회원 인증·프로그램
등록·중복 도메인 차단 등을 검증합니다. **실제 운영 Apache는 테스트 중 절대 실행되지
않습니다** (`APACHE_COMMAND_RUNNER=mock`이 테스트 전역에 강제 적용됩니다).

자세한 테스트 목록과 실행 방법은 [REVIEW_FOR_CODEX.md](REVIEW_FOR_CODEX.md#테스트-현황)를
참고하세요.

## 빌드

```bash
npm run build
```

`packages/shared` → `apps/server` → `apps/web` 순서로 빌드합니다.

## 운영 실행

Windows Server 2019 배포 절차는 [DEPLOY_WINDOWS_SERVER.md](DEPLOY_WINDOWS_SERVER.md)를,
Apache 최초 연결(IncludeOptional 설정, SSL, WebSocket 모듈 확인)은
[APACHE_SETUP.md](APACHE_SETUP.md)를 참고하세요.

## 주의사항

- 이 시스템은 서버의 Apache 설정 파일을 직접 수정하고 Apache 프로세스를 제어합니다.
  관리 화면은 사내망/VPN 등 제한된 네트워크에서만 접근 가능하도록 구성해야 합니다
  (자세한 내용은 DEPLOY_WINDOWS_SERVER.md의 "관리자 접근 제한" 참고).
- 기존 `httpd-vhosts.conf` 전체를 덮어쓰지 않습니다. `IncludeOptional` 한 줄만
  (최초 1회, 관리자 승인 후) 추가하고, 이후 모든 프로그램별 설정은 `mw-sites` 폴더에만
  생성/수정합니다.
- 문법 검사(`httpd.exe -t`)를 통과하지 못하면 어떤 설정도 실제로 반영되지 않으며,
  설정 재적용(`-k restart`) 실패나 Apache 프로세스 미확인 시 자동으로 이전
  설정으로 복구됩니다. Windows는 무중단(graceful) 재적재를 지원하지 않아 설정
  반영 순간 연결이 짧게 끊길 수 있습니다 (APACHE_SETUP.md 6절 참고). 반면
  **대상 프로그램 자체의 연결 실패는 Apache 설정을 롤백하지 않고 경고만
  표시**합니다 (프로그램이 아직 켜지지 않았을 수 있으므로).
- Apache는 반드시 Windows 서비스로 등록되어 실행 중이어야 합니다. 그렇지
  않으면 설정 재적용이 항상 실패합니다 (DEPLOY_WINDOWS_SERVER.md 참고).
- SSL 개인키 내용은 DB나 로그에 저장하지 않습니다. 설정 화면에는 인증서/키
  **파일 경로**만 저장합니다.
