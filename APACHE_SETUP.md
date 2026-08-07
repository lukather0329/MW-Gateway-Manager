# Apache 연동 설정 가이드

## 1. 필요한 Apache 모듈

MW Gateway Manager가 생성하는 VirtualHost 설정은 다음 모듈을 사용합니다.

| 모듈 | 용도 |
|---|---|
| `mod_proxy` | Reverse Proxy 기본 |
| `mod_proxy_http` | HTTP(S) 백엔드로의 프록시 |
| `mod_proxy_wstunnel` | WebSocket 사용 시에만 필요 |
| `mod_rewrite` | HTTP→HTTPS 리다이렉트, WebSocket 업그레이드 분기 |
| `mod_ssl` | SSL 사용 시에만 필요 |

XAMPP는 기본적으로 이 모듈들을 `httpd.conf`에 이미 포함하고 있는 경우가 많지만,
**이 애플리케이션은 절대 가정하지 않고 매번 `httpd.exe -M`으로 실제 활성화 여부를
조회합니다.** 필수 모듈이 비활성 상태면 **설정 미리보기/적용 화면에 정확히 어떤
모듈이 빠졌는지 표시**하며, 자동으로 `httpd.conf`를 수정해 모듈을 활성화하지
**않습니다** (지시서 5절 요구사항).

모듈이 비활성 상태라면 `D:\xampp\apache\conf\httpd.conf`에서 해당 `LoadModule`
줄의 주석(`#`)을 관리자가 직접 제거한 뒤 Apache를 재시작하세요.

```apache
LoadModule proxy_module modules/mod_proxy.so
LoadModule proxy_http_module modules/mod_proxy_http.so
LoadModule proxy_wstunnel_module modules/mod_proxy_wstunnel.so
LoadModule rewrite_module modules/mod_rewrite.so
LoadModule ssl_module modules/mod_ssl.so
```

## 2. IncludeOptional 초기 설정

이 시스템은 프로그램별 VirtualHost를 `httpd-vhosts.conf`에 직접 추가하지 않고,
별도 폴더(`mw-sites`, 기본 가정 경로 `D:\xampp\apache\conf\mw-sites`)에 도메인당
파일 하나씩 생성합니다. 이 폴더를 Apache가 읽도록 하려면 `httpd-vhosts.conf`에
아래 한 줄이 있어야 합니다.

```apache
IncludeOptional "D:/xampp/apache/conf/mw-sites/*.conf"
```

- **관리 화면(Apache 상태 > 최초 설정 마법사 검사)에서 이 줄이 있는지 자동으로
  확인**하며, 없을 때만 "IncludeOptional 적용" 버튼이 나타납니다.
- 버튼을 누르면 파일 맨 끝에 위 줄만 추가합니다. **기존 내용은 절대 수정/삭제하지
  않습니다.**
- 이미 줄이 존재하면 중복으로 추가하지 않습니다 (문자열 `mw-sites` 포함 여부로 판단).
- 이 적용은 관리자가 화면에서 명시적으로 버튼을 눌러야만 실행되며, 시스템이
  자동으로/임의로 수정하지 않습니다.

## 3. SSL 인증서 설정

시스템 설정 화면(또는 `.env`)의 `SSL_CERTIFICATE_PATH` / `SSL_CERTIFICATE_KEY_PATH`가
실제 인증서/개인키 파일 경로를 가리켜야 합니다. SSL을 사용하는 프로그램을 등록하면
생성되는 `:443` VirtualHost에 이 경로가 그대로 삽입됩니다.

```apache
SSLEngine on
SSLCertificateFile "D:/certs/roboworks_wildcard/_.roboworks.co.kr-crt.pem"
SSLCertificateKeyFile "D:/certs/roboworks_wildcard/_.roboworks.co.kr-key.pem"
```

**개인키 파일의 내용 자체는 이 시스템의 DB나 로그 어디에도 저장되지 않습니다.**
경로 문자열만 저장/사용합니다. "최초 설정 마법사 검사"는 두 파일이 실제로
존재하는지만 확인합니다 (내용을 읽지 않습니다).

## 4. WebSocket 설정

프로그램 등록 시 "WebSocket 사용"을 켜면 생성되는 설정에 업그레이드 헤더 기반
분기 규칙이 추가됩니다.

```apache
RewriteEngine On
RewriteCond %{HTTP:Upgrade} =websocket [NC]
RewriteRule ^/(.*)$ ws://127.0.0.1:3101/$1 [P,L]
RewriteCond %{HTTP:Upgrade} !=websocket [NC]
RewriteRule ^/(.*)$ http://127.0.0.1:3101/$1 [P,L]
```

대상 프로토콜이 `https`이면 `ws://` 대신 `wss://`를 사용합니다. `mod_proxy_wstunnel`이
비활성 상태이면 **적용 자체를 막고** 어떤 모듈이 필요한지 화면에 표시합니다.

## 5. 문법 검사

```powershell
D:\xampp\apache\bin\httpd.exe -t
```

관리 화면이 설정을 실제로 반영하기 전 항상 이 명령을 실행하며, `Syntax OK`가
아니면 반영하지 않고 직전 상태로 되돌립니다. **Apache 상태** 메뉴에서 수동으로도
실행할 수 있습니다.

## 6. 설정 재적용 (reload)

```powershell
D:\xampp\apache\bin\httpd.exe -k restart
```

이 시스템은 설정을 반영할 때 위 명령을 실행합니다. **Unix/Linux Apache와
달리 `-k restart`를 씁니다 (`-k graceful`이 아님).** 처음에는 지시서를 따라
`-k graceful`(무중단 재적재)을 기본값으로 구현했지만, 개발 중 실제 XAMPP
Apache로 검증하는 과정에서 두 가지를 확인하고 코드를 수정했습니다.

### ⚠️ 확인된 사실 1: Windows는 `-k graceful`을 지원하지 않습니다

Windows의 Apache MPM(`mpm_winnt`)은 애초에 Unix식 무중단(graceful) 재적재를
구현하지 않습니다. 서비스로 정상 실행 중인 Apache에 `-k graceful`을 보내면
기존 프로세스에 신호를 보내는 대신 새 리스너를 열려다 실패합니다.

```text
AH00072: make_sock: could not bind to address 0.0.0.0:80
AH00451: no listening sockets available, shutting down
```

`-k restart`는 정상 동작합니다 (관리자 권한 여부, `-n <서비스명>` 옵션 여부와
무관하게 확인됨). 이 시스템의 `RealApacheCommandRunner`는 항상 `-k restart`를
사용합니다. **Windows에서는 완전 무중단 재적재 자체가 불가능하므로, 설정을
반영하는 순간 진행 중이던 연결이 짧게 끊길 수 있습니다.** (전체 재시작
`net stop`+`net start`보다는 짧고, XAMPP/mpm_winnt 환경에서 쓸 수 있는
대안이 없습니다.)

### ⚠️ 확인된 사실 2: Apache가 Windows 서비스로 등록되어 있어야 합니다

`-k restart`(와 `-k graceful`) 모두 **Apache가 Windows 서비스로 등록되어 그
서비스로 실행 중일 때만 동작합니다.** XAMPP를 기본 방식대로 (`apache_start.bat`
더블클릭이나 XAMPP Control Panel의 일반 Start 버튼으로) 그냥 프로세스로 띄운
상태에서 실행하면 다음과 같이 실패합니다.

```text
AH00436: No installed service named "Apache2.4".
```

이 경우 이 시스템은 (의도대로) 문법 검사까지는 통과시키지만 reload 단계에서
실패를 감지해 자동으로 이전 설정으로 롤백합니다 — 즉 **안전장치는 정상
작동하지만, 이 상태로는 어떤 프로그램도 실제로 적용할 수 없습니다.**

운영 서버 배포 전 관리자 권한으로 한 번 서비스로 등록하세요.

```powershell
cd C:\xampp\apache\bin   # 또는 실제 설치 경로
.\httpd.exe -k install    # "Apache2.4" 서비스 등록
net start Apache2.4       # 서비스로 시작
```

이후 `services.msc`에서 "Apache2.4" 서비스가 "실행 중"인지 확인하세요. XAMPP
Control Panel을 쓴다면 Apache 행의 "Service" 체크박스를 켜서 서비스로 등록/시작할
수도 있습니다.

두 조건(서비스 등록 + `-k restart`)을 모두 충족한 뒤, 실제로 프로그램을
등록→미리보기→적용까지 실행해 `configStatus: APPLIED`로 성공하는 것과, 생성된
도메인으로 접속 시 Apache가 해당 VirtualHost를 정확히 매칭하는 것(오류 페이지
하단의 `Server at <도메인>` 표시로 확인 가능)까지 확인했습니다.

## 7. 수동 복구 방법

시스템의 자동 롤백이 실패했거나(예: 디스크 쓰기 오류), 시스템 자체에 접근할 수
없는 극단적 상황이라면 다음을 수동으로 수행합니다.

1. `D:\xampp\apache\conf\mw-backups\<타임스탬프>\` 폴더에서 가장 최근의 정상
   백업을 찾습니다 (`manifest.json`에 백업 시각/사유가 기록되어 있습니다).
2. 해당 폴더의 `httpd-vhosts.conf`를 `D:\xampp\apache\conf\extra\httpd-vhosts.conf`로,
   `mw-sites\*.conf` 전체를 `D:\xampp\apache\conf\mw-sites\`로 덮어씁니다.
3. `D:\xampp\apache\bin\httpd.exe -t`로 문법을 확인합니다.
4. 정상이면 `D:\xampp\apache\bin\httpd.exe -k restart`로 반영합니다.
5. 관리 화면의 **설정 백업** 메뉴에서 같은 백업을 "이 시점으로 복구" 버튼으로
   실행해도 동일한 절차가 자동으로 수행됩니다 (문법 검사 통과 시에만 reload).

더 구체적인 오류별 대응은 [TROUBLESHOOTING.md](TROUBLESHOOTING.md)를 참고하세요.
