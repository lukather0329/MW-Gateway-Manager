# Codex 리뷰 가이드

작성일: 2026-08-06. Codex가 2026-08-09 이후 이 저장소를 리뷰할 때 빠르게
맥락을 잡을 수 있도록 작성했습니다. Claude가 단독으로 설계·구현·테스트까지
수행했습니다 (지시서 참고).

## 프로젝트 개요

Windows Server 2019 + XAMPP Apache 환경에서, 신규 프로그램을 등록하면
Reverse Proxy용 VirtualHost 설정을 자동 생성하고 백업 → 문법 검사 → 안전
적용 → 실패 시 자동 롤백까지 수행하는 내부 관리 도구입니다. 전체 배경은
[docs/ENVIRONMENT_ANALYSIS.md](docs/ENVIRONMENT_ANALYSIS.md), 사용법은
[README.md](README.md)를 참고하세요.

**중요한 제약**: 이 코드는 실제 Windows Server 2019 (운영 서버)에는 접근할 수
없는 개발 환경에서 작성되었습니다. 다만 2026-08-07에 이 개발 머신(Windows 11)에
실제 XAMPP Apache 2.4.58이 설치되어, `APACHE_COMMAND_RUNNER=real`로 전환해
**진짜 `httpd.exe`(Windows 서비스로 등록해 실행 중인 상태)를 대상으로 전체
파이프라인(프로그램 등록 → 미리보기 → 적용 → 문법검사 → reload → 실제 라우팅
확인 → 안전한 삭제)을 성공적으로 종단간 검증했습니다** (아래 "실제 Apache로
검증한 내용과 발견한 문제" 참고). 그 과정에서 코드 버그 1개와, Windows에서
**반드시 필요한 배포 전제 조건 2개**(Apache를 Windows 서비스로 등록해야 함,
그리고 reload 명령 자체를 `-k graceful`이 아닌 `-k restart`로 바꿔야 함)를
발견해 모두 수정/반영했습니다. 다만 이 검증은 여전히 Windows 11 개발 머신
기준이며, **실제 운영 Windows Server 2019에서는 아직 검증되지 않았습니다.**
아래 "실제 서버 테스트 절차"를 반드시 운영 서버에서도 수행해야 합니다.

## 실제 Apache로 검증한 내용과 발견한 문제 (2026-08-07)

개발 머신에 XAMPP Apache 2.4.58 (Win64)이 설치된 뒤 `APACHE_COMMAND_RUNNER=real`로
전환하여 확인한 내용입니다.

1. **모듈 파싱 버그 발견 및 수정** — 실제 `httpd -M` 출력은 첫 줄이
   `Loaded Modules:` 헤더로 시작하는데, `ApacheModuleInspector`가 이 줄까지
   모듈명으로 잘못 파싱했습니다 (Mock 테스트 데이터에는 이 헤더 줄이 없어서
   발견되지 않았음). `(static)`/`(shared)`로 끝나는 줄만 모듈로 인정하도록
   수정하고, 회귀 테스트를 추가했습니다
   (`apps/server/src/services/apache/ApacheModuleInspector.ts`,
   `apps/server/tests/unit/ApacheModuleInspector.test.ts`).
2. **필수 모듈 검사가 실제로 정확하게 동작함을 확인** — 이 XAMPP 설치는 기본
   상태에서 `proxy_http_module`, `proxy_wstunnel_module`이 비활성화되어
   있었고, 시스템이 정확히 이를 감지해 WebSocket 미지원으로 표시했습니다
   (지시서 5절이 요구한 동작 그대로).
3. **최초 설정 마법사·IncludeOptional 적용을 실제 파일에 대해 검증** — 실제
   `httpd-vhosts.conf`에 기존 내용을 전혀 건드리지 않고 `IncludeOptional` 한
   줄만 추가되는 것을 확인했습니다.
4. **⚠️ Apache는 Windows 서비스로 등록되어 있어야 함 (필수 배포 전제조건)** —
   Apache를 (XAMPP 기본 실행 방식처럼) `httpd.exe`를 그냥 콘솔/백그라운드
   프로세스로 띄운 상태에서는 `-k graceful`/`-k restart` 모두 다음 오류로
   실패합니다.
   ```
   AH00436: No installed service named "Apache2.4".
   ```
   이 상태에서 실제로 프로그램을 등록→적용해봤더니, 문법 검사는
   통과했지만(`Syntax OK`) reload가 이 오류로 실패했고, **시스템이 설계대로
   정확히 자동 롤백을 수행**했습니다 (`configStatus: ROLLED_BACK`) — 안전장치
   자체는 완벽히 작동했습니다. 관리자 권한으로 `httpd.exe -k install` 후
   `net start Apache2.4`로 서비스 등록/시작한 뒤에는 이 오류가 사라집니다.
   운영 배포 전 **필수 사전 조건**으로 DEPLOY_WINDOWS_SERVER.md와
   APACHE_SETUP.md에 반영했습니다.
5. **⚠️ 버그 발견 및 수정: Windows(mpm_winnt)는 `-k graceful`을 지원하지
   않음** — Apache를 서비스로 등록한 뒤에도 `-k graceful`은 여전히 실패했는데,
   이번엔 다른 오류였습니다.
   ```
   AH00072: make_sock: could not bind to address 0.0.0.0:8080
   AH00451: no listening sockets available, shutting down
   ```
   원인은 Windows의 Apache MPM(`mpm_winnt`)이 Unix식 무중단(graceful) 재적재를
   지원하지 않기 때문입니다 — `-k graceful`을 서비스로 실행 중인 인스턴스에
   보내면 기존 프로세스에 신호를 보내는 대신 새 리스너를 바인드하려다 포트
   충돌로 실패합니다. `-k restart`는 (관리자 권한 여부와 무관하게, `-n` 옵션도
   불필요하게) 정상 동작하는 것을 확인했습니다. **`RealApacheCommandRunner.
   gracefulReload()`가 실제로 실행하는 명령을 `-k graceful`에서 `-k restart`로
   수정했습니다** (인터페이스/메서드명은 호출부 영향을 최소화하기 위해
   `gracefulReload`로 유지, 실제 실행 명령만 교체). Windows에서 `-k restart`는
   Unix graceful과 달리 진행 중이던 연결을 짧게 끊을 수 있다는 점을 UI/문서에
   명시했습니다 (완전 무중단 방식이 Windows에는 없음 — 대안 없음).
6. **✅ 위 두 가지를 모두 해결한 뒤, 전체 파이프라인이 실제로 성공하는 것을
   확인함** — 문법 검사 통과 → reload 성공 → 프로세스 확인 →
   `configStatus: APPLIED`. 실제 도메인으로 Host 헤더를 지정해 `https://<서버>`에
   요청을 보내보니 응답의 오류 페이지 하단에
   `Server at camera.roboworks.co.kr Port 443`가 표시되어, Apache가 우리가
   생성한 VirtualHost를 정확히 매칭해 프록시를 시도했음을 확인했습니다 (백엔드가
   실제로 없어 503을 반환한 것은 정상 — 대상 프로그램 미기동을 Apache 설정
   문제로 오판하지 않는다는 정책과 일치). 이어서 프로그램 삭제(안전한 conf 제거
   + reload)까지 성공을 확인했습니다.
7. **포트 충돌 확인** — 이 개발 머신은 Windows 기본 IIS(W3SVC)가 80번 포트를
   이미 점유하고 있어 Apache가 80번으로 뜨지 못했습니다 (443번은 비어있었음).
   개발 검증 목적으로 `Listen 8080`으로 임시 변경해 우회했습니다. 운영
   서버에서도 다른 서비스가 80/443을 점유하고 있지 않은지 사전 확인이
   필요합니다 (`netstat -ano`로 확인).

이 검증에 사용한 httpd.conf 변경(모듈 2개 활성화, Listen 포트 변경, 서비스 등록)은
이 개발 머신에만 적용된 것이며, 저장소에는 커밋되지 않습니다 (Apache 설치
자체는 이 프로젝트의 일부가 아님). 코드 변경(모듈 파싱 수정,
`-k restart`로 전환)만 커밋되었습니다.

## 현재 구현 범위

- 관리자 로그인/로그아웃, 로그인 실패 잠금, 세션 쿠키, CSRF, 요청 속도 제한
- 프로그램 CRUD (등록/목록/상세/수정/삭제), 입력 검증(도메인/호스트/포트/상태
  확인 경로), 도메인 중복 차단, 포트 중복 경고(차단 아님)
- Apache VirtualHost 생성기 (HTTP/HTTPS, WebSocket, SSL, 로그 파일명)
- 설정 미리보기 (파일에 쓰지 않고 내용만 반환)
- 안전 적용 파이프라인: 백업 → 파일 쓰기/삭제 → `httpd -t` → `httpd -k restart`
  (Windows mpm_winnt는 graceful 미지원 — 실측 확인) → 프로세스 상태 확인 →
  실패 시 자동 롤백
- Apache 모듈 검사 (`httpd -M` 파싱), 부족한 모듈이 있으면 적용 자체를 차단하고
  화면에 원인 표시
- 최초 설정 마법사 (경로/모듈/인증서/문법/IncludeOptional 존재 여부 점검,
  관리자 승인 후에만 IncludeOptional 1줄 추가)
- 연결 테스트 (TCP → HTTP → 상태 확인 경로, 5단계 상태 구분)
- 설정 백업 목록/수동 백업/특정 시점 복구 (자동 적용 시 생성되는 백업도 모두
  DB에 기록됨)
- 변경 이력(AuditLog) 조회
- 시스템 설정 화면 (Apache 경로들, SSL 경로, 기본값 편집)
- 장비(Device) 기본 CRUD, 토큰 발급(1회만 평문 노출)
- 관리자 계정 관리 (추가 관리자 생성/삭제, 공개 회원가입 없음)
- 대시보드 (등록/활성/정상/오류 프로그램 수, Apache 상태, 최근 변경/오류/백업)
- React 관리 화면 전체 (로그인, 대시보드, 프로그램 등록 위저드/상세/미리보기/적용
  확인창, Apache 상태, 백업, 변경이력, 설정, 장비, 사용자)
- 단위/통합/API 테스트 59개 (`npm test`)

## 미구현 범위

`NEXT_STEPS.md`에 상세 목록이 있습니다. 요약:

- 실제 MQTT/장비 통신, 장비 실시간 상태 갱신
- 백그라운드 자동 헬스체크(스케줄러) — 현재는 수동/적용 직후 트리거만 있음
- 백업 자동 정리(retention)
- 세분화된 사용자 권한(역할은 필드만 존재, 로직 없음)
- 비밀번호 재설정 플로우
- 인증서 자동 갱신/만료 경고
- 설정 변경 이력 diff 뷰어 (데이터는 `ApacheConfigRevision`에 이미 저장됨)

## 주요 설계 결정

### 1. 적용 파이프라인의 구체적 순서 (지시서 6.7의 해석)

지시서는 "임시 설정 파일 생성 → 백업 → 문법 검사(임시 파일 포함) → 정상일 때만
실제 파일로 교체"라는 순서를 제시합니다. 이를 문자 그대로 구현하려면 Apache
설정 트리 전체를 별도 스테이징 디렉터리에 복제해 `httpd -t -f <staging>`으로
검사해야 하는데, 이는 이번 MVP 범위(지시서 3.2 "과도한 마이크로서비스 구조
지양")에 비해 과도하다고 판단했습니다.

대신 다음과 같이 구현했습니다 (`ApacheApplyService.applyAndVerify`):

1. 현재 상태 전체 백업 (`ApacheBackupService.createBackup`)
2. 대상 `.conf` 파일을 **실제 경로에 직접 씀** (아직 Apache는 reload되지
   않았으므로 운영 중인 프로세스에는 영향 없음 — 디스크에 쓰는 것과 Apache가
   그 내용을 실제로 로드하는 것은 별개)
3. `httpd -t` 실행
4. 실패 시 즉시 백업에서 복원 (파일 원복) 후 종료 — reload는 절대 실행하지 않음
5. 성공 시 `httpd -k restart` 실행 (Windows mpm_winnt는 graceful을 지원하지
   않아, 실측 확인 후 이 명령으로 확정 — 아래 "실제 Apache로 검증한 내용과
   발견한 문제" 5번 참고)
6. reload 실패 또는 프로세스 미확인 시 백업에서 복원 + 재검사 + 재-reload 시도
7. 모두 성공하면 완료

이 방식의 핵심 안전 불변식: **`httpd -t`가 통과하지 않으면 reload 명령을
절대 호출하지 않는다.** 이는 지시서의 핵심 요구사항(장애 방지)을 그대로
만족시키면서 구현 복잡도를 크게 낮춥니다. Codex 리뷰 시 이 트레이드오프가
타당한지, 혹은 실제 운영 환경에서 "디스크에 쓰는 순간과 reload 사이의 시간
간격"이 문제가 될 수 있는 시나리오(예: 동시에 다른 프로세스가 같은 파일을
읽는 경우)가 있는지 검토를 부탁드립니다.

### 2. Apache 명령 실행 구조 — `ApacheCommandRunner` 인터페이스

`apps/server/src/services/apache/ApacheCommandRunner.ts`가 인터페이스를
정의하고, 두 구현체가 있습니다.

- `RealApacheCommandRunner` — `node:child_process.execFile`로 `httpd.exe`를
  실행. **인수는 항상 배열로 분리**하며 (`execFile(path, ['-t'])` 등) 사용자
  입력을 명령 문자열에 결합하지 않습니다.
- `MockApacheCommandRunner` — 실제 프로세스를 절대 실행하지 않고, 테스트/설정
  가능한 결과를 반환. 로컬 개발과 모든 자동화 테스트는 이것만 사용합니다.

선택은 `apacheRunnerFactory.ts`에서 `APACHE_COMMAND_RUNNER` 환경변수로
결정됩니다. 운영 서버에서는 반드시 `real`로 설정해야 실제로 Apache가
제어됩니다 (기본값은 안전한 `mock`).

### 3. 설정 생성 구조 — `ApacheConfigGenerator`

순수 함수형 서비스로, 이미 검증된 입력(`utils/validation.ts`를 통과한 도메인/
호스트/포트)만 받는다고 가정합니다. SSL 여부·WebSocket 여부에 따라 4가지
조합의 VirtualHost 블록을 문자열 템플릿으로 조립합니다. 파일 시스템에 접근하지
않으며, 반환값(`{fileName, filePath, content}`)을 호출자가 쓰거나 미리보기로
보여줍니다.

### 4. 백업/롤백 구조

- `ApacheBackupService` — 매 적용/삭제 시도 전 `httpd-vhosts.conf` 전체와
  `mw-sites/*.conf` 전체를 타임스탬프 폴더로 복사 (+ `manifest.json`). 항상
  **적용 대상 파일 하나만이 아니라 전체 스냅샷**을 뜹니다 — 특정 프로그램의
  변경이 (이론상으로는 있어서는 안 되지만) 다른 파일에 영향을 주는 경우까지
  대비.
- `ApacheRollbackService` — `shouldAutoRollback()`은 실패 사유별 자동 롤백
  여부를 결정하는 순수 함수입니다 (지시서 6.8 정책: Apache 문법/프로세스 문제는
  자동 롤백, 대상 프로그램 연결 실패는 설정 유지). 실제 롤백 실행
  (`rollbackTo`)은 백업 복원 → 재검사 → 재-reload를 수행합니다.
- 모든 적용/삭제 파이프라인 실행은 성공 여부와 무관하게 `ApacheBackup` 테이블에
  기록됩니다 (`utils/recordApplyBackup.ts`) — 백업 화면/대시보드에서 수동 백업과
  동일하게 보입니다.

## 보안상 주의할 부분

- **명령어 삽입**: `RealApacheCommandRunner`는 `execFile`만 사용, 인수 배열
  분리. 셸 문자열 결합 없음.
- **경로/설정 삽입**: 도메인·호스트·상태확인경로는 모두
  `utils/validation.ts`의 화이트리스트 정규식 + 위험 문자 차단
  (`"`, `'`, `;`, `|`, `&`, `` ` ``, `<`, `>`, `$()`, CRLF, `../`, `..\`)을
  통과해야만 저장됩니다. 사용자가 Apache 설정문을 자유 입력하는 기능은
  존재하지 않습니다 (지시서 9절 요구사항).
- **CSRF**: 더블서브밋 토큰 (`GET /api/auth/csrf-token` → `x-csrf-token`
  헤더). 세션 쿠키는 `SameSite=Lax` + `httpOnly`.
- **인증**: bcrypt(12 rounds), 로그인 실패 N회(기본 5회) 시 계정 잠금, 존재하지
  않는 계정과 잘못된 비밀번호에 대해 **동일한 오류 메시지 + 유사한 응답 시간**을
  반환하도록 처리(사용자 열거 공격 완화 — 완벽하지는 않음, 아래 "알려진 문제"
  참고).
- **비밀정보**: SSL 개인키 파일 **내용**은 절대 DB/로그에 저장하지 않고 경로만
  저장. 감사 로그(`AuditService.log`)는 `password`, `passwordHash`, `token`,
  `tokenHash`, `secret` 키를 자동으로 `[REDACTED]` 처리.
- **운영 환경 오류 노출**: `NODE_ENV=production`일 때 500 오류 응답에서 실제
  오류 메시지 대신 일반 메시지만 반환 (`middleware/errorHandler.ts`).
- **CORS**: `WEB_ORIGIN` 하나만 허용, `credentials: true`.
- **보안 헤더**: `helmet()` 기본 설정 적용.

## Apache 명령 실행 구조 (파일 위치 요약)

```text
apps/server/src/services/apache/
  ApacheCommandRunner.ts        인터페이스
  RealApacheCommandRunner.ts    execFile 기반 실제 구현
  MockApacheCommandRunner.ts    테스트/개발용 모킹 구현
  apacheRunnerFactory.ts        env로 real/mock 선택
  ApacheConfigGenerator.ts      VirtualHost 문자열 생성
  ApacheConfigValidator.ts      httpd -t 래퍼
  ApacheModuleInspector.ts      httpd -M 파싱
  ApacheBackupService.ts        백업 생성/복원
  ApacheRollbackService.ts      롤백 정책 + 실행
  ApacheApplyService.ts         전체 파이프라인 오케스트레이션
  ApacheSetupWizardService.ts   최초 설정 마법사 검사/IncludeOptional 적용
```

## 테스트 현황

`npm test` (apps/server, Vitest) — **59개 테스트, 모두 통과.**

- `tests/unit/` — 검증 로직, 설정 생성기(HTTP/HTTPS/WS/SSL 4조합), 롤백 정책
  순수함수, 모듈 파싱 (33개)
- `tests/integration/` — 실제 임시 디렉터리 + `MockApacheCommandRunner`로
  백업/적용/롤백 파이프라인 전체 (성공/문법실패/reload실패/프로세스미확인/
  UPDATE실패시 이전 내용 복원까지) (11개), 실제 로컬 임시 TCP/HTTP 서버로
  헬스체크 5단계 구분 (5개)
- `tests/integration/api/` — Vitest `globalSetup`으로 임시 SQLite DB를 만들고
  `supertest`로 실제 HTTP 요청: 로그인/잠금, 프로그램 등록/중복 도메인 차단/
  위험 문자 차단/포트 경고/미리보기/적용 성공, CSRF 미검증 요청 차단,
  미인증 접근 차단 (12개)

**실제 운영 Apache는 테스트 중 절대 실행되지 않습니다** — `APACHE_COMMAND_RUNNER`가
테스트 전역에서 강제로 `mock`입니다.

## 알려진 문제 / 한계

1. **사용자 열거 타이밍 차이**: `AuthService.login`은 존재하지 않는 계정에
   대해 더미 bcrypt 비교를 수행해 응답 시간을 비슷하게 맞추려 했지만, DB 조회
   자체의 시간차 등 완벽한 상수시간 보장은 아닙니다. 엄격한 요구사항이면 추가
   검토 필요.
2. **세션 저장소가 MemoryStore**: 서버 재시작 시 모든 로그인 세션이 끊깁니다.
   관리자 1~3명 규모에서는 허용 가능하다고 판단했으나, 무중단 배포가 중요해지면
   교체 필요 (NEXT_STEPS.md).
3. **동시 적용(concurrency) 미고려**: 두 관리자가 동시에 서로 다른 프로그램을
   "적용"하면 백업/파일쓰기/reload가 겹칠 수 있습니다. 락(잠금) 메커니즘이
   없습니다. 관리자가 1~3명인 소규모 운영 전제라 위험도는 낮다고 판단했지만,
   Codex가 더 엄격한 리뷰를 원한다면 `ApacheApplyService`에 간단한 뮤텍스를
   추가하는 것을 권장합니다.
4. **`RealApacheCommandRunner`는 Windows 11 개발 머신에서 전체 파이프라인
   1회 성공 검증, Windows Server 2019 운영 서버에서는 아직 미검증**: 위 "실제
   Apache로 검증한 내용과 발견한 문제" 참고. `tasklist` 파싱 기반 프로세스
   확인 로직과 reload(`-k restart`) 모두 정상 동작을 확인했지만, **Apache가
   Windows 서비스로 등록되어 있어야만** reload가 동작한다는 전제조건이 있으므로
   **운영 서버에서 Apache가 서비스로 등록되어 있는지 배포 전 반드시 확인해야
   합니다** (DEPLOY_WINDOWS_SERVER.md 참고).
5. **npm audit 경고**: 초기 `npm install` 시 5~7건의 취약점 경고가 표시됩니다
   (대부분 개발 의존성/전이 의존성). 운영 배포 전 `npm audit` 결과를 재검토하고
   필요한 것만 업데이트하는 것을 권장합니다 (breaking change 위험이 있어 이번
   세션에서는 임의로 `--force` 업데이트하지 않았습니다).
6. **린트 미실행**: ESLint 설정 파일은 추가했지만 `npm run lint`를 전체
   실행/정리하지는 않았습니다.

## 리뷰가 필요한 파일 목록 (우선순위 순)

1. `apps/server/src/services/apache/ApacheApplyService.ts` — 안전성의 핵심.
   위 "설계 결정 1"의 트레이드오프를 특히 검토해주세요.
2. `apps/server/src/services/apache/ApacheRollbackService.ts` — 롤백 정책.
3. `apps/server/src/utils/validation.ts` — 입력 검증/위험 문자 차단 전체.
4. `apps/server/src/services/apache/RealApacheCommandRunner.ts` — 실서버에서
   가장 먼저 실전 검증이 필요한 파일.
5. `apps/server/src/controllers/programController.ts` — 도메인 변경/삭제 시
   기존 Apache 설정을 안전하게 정리하는 로직.
6. `apps/server/src/middleware/csrf.ts`, `middleware/session.ts` — 인증/CSRF.
7. `apps/server/src/services/apache/ApacheSetupWizardService.ts` — 최초 1회
   `httpd-vhosts.conf` 수정 로직 (기존 파일을 절대 덮어쓰지 않는지 재확인).

## 우선 검토 항목

- [ ] `ApacheApplyService`의 "디스크에 먼저 쓰고 이후 검사" 방식이 실제 운영
      환경에서도 안전한지 (설계 결정 1 참고)
- [ ] 동시 적용에 대한 락 필요 여부 (알려진 문제 3)
- [ ] **Apache가 Windows 서비스로 등록되어 있는지 운영 서버에서 확인** — 아니면
      모든 "적용"이 reload 단계에서 실패 후 자동 롤백됩니다 (알려진 문제 4 참고,
      개발 머신에서 이 실패/롤백과 서비스 등록 후 성공 모두 실제로 확인함)
- [ ] `RealApacheCommandRunner`의 Windows 프로세스 상태 확인 로직·reload
      (`-k restart`)는 개발 머신에서 전체 파이프라인 성공까지 확인됨 — 운영
      Windows Server 2019에서 재검증 권장
- [ ] 세션 저장소를 MemoryStore 이상으로 바꿔야 하는 시점 판단
- [ ] `npm audit` 결과 재검토

## 실제 서버 테스트 절차

운영 배포 전 실제 Windows Server 2019 + XAMPP에서 반드시 아래 순서로
확인하세요 (DEPLOY_WINDOWS_SERVER.md 10절과 동일).

0. **Apache가 Windows 서비스로 등록되어 실행 중인지 먼저 확인** (`services.msc`
   에서 확인, 아니면 `httpd.exe -k install` + `net start Apache2.4`). 이게
   안 되어 있으면 뒤의 모든 "적용" 테스트가 reload 단계에서 실패합니다.
1. `.env`의 모든 `APACHE_*`, `SSL_*` 경로를 실제 서버 값으로 설정하고
   `APACHE_COMMAND_RUNNER=real`로 설정.
2. 앱을 기동하고 로그인.
3. **Apache 상태 > 최초 설정 마법사 검사**에서 모든 항목이 ✔인지 확인
   (httpd.exe 존재, 모듈, SSL 파일, 문법 상태 등).
4. 문제 없으면 IncludeOptional 적용 (기존 `httpd-vhosts.conf` 내용이 보존되는지
   직접 파일을 열어 확인).
5. 테스트용 프로그램 1개(실제로 존재하는 사내 서비스)를 등록 → 미리보기 →
   적용까지 수행하고, 실제 도메인으로 접속해 정상 프록시되는지 확인.
6. 의도적으로 존재하지 않는 도메인/포트로 프로그램을 만들어 "연결 테스트"가
   UNREACHABLE을 정확히 반환하는지, 이것이 Apache 설정 자체에는 영향을 주지
   않는지 확인.
7. (선택, 위험도 있음) 백업 폴더의 `.conf` 파일 하나를 일부러 손상시킨 뒤
   "이 시점으로 복구"가 아닌 일반 적용을 시도해, 문법 검사 실패 → 자동 롤백이
   실제로 동작하는지 확인. **이 테스트는 신중하게, 가능하면 트래픽이 적은
   시간대에 수행하세요.**
