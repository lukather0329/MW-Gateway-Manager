import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { ConfirmDialog } from '../components/ConfirmDialog';

interface ApacheStatus {
  processStatus: { running: boolean; pid?: number };
  version: string;
  moduleCheck: { loadedModules: string[]; missingRequired: string[]; websocketSupported: boolean };
}

interface SetupCheck {
  apacheRootPathExists: boolean;
  httpdExecutableExists: boolean;
  vhostsFileExists: boolean;
  managedSitesPathWritable: boolean;
  backupPathWritable: boolean;
  apacheVersion: string | null;
  sslCertificateExists: boolean;
  sslCertificateKeyExists: boolean;
  currentSyntaxValid: boolean | null;
  currentSyntaxRaw: string | null;
  includeOptionalLinePresent: boolean;
  includeOptionalLine: string;
}

function CheckRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <li className={ok ? 'check-ok' : 'check-fail'}>
      {ok ? '✔' : '✘'} {label}
    </li>
  );
}

export function ApacheStatusPage() {
  const [status, setStatus] = useState<ApacheStatus | null>(null);
  const [setupCheck, setSetupCheck] = useState<SetupCheck | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmIncludeOpen, setConfirmIncludeOpen] = useState(false);

  function reload() {
    api.get<ApacheStatus>('/apache/status').then(setStatus).catch((err) => setError(err.message));
    api.get<SetupCheck>('/apache/setup-check').then(setSetupCheck).catch((err) => setError(err.message));
  }

  useEffect(reload, []);

  async function runTestConfig() {
    setBusy(true);
    setError(null);
    try {
      await api.post('/apache/test-config');
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '문법 검사 중 오류가 발생했습니다.');
    } finally {
      setBusy(false);
    }
  }

  async function runGraceful() {
    setBusy(true);
    setError(null);
    try {
      await api.post('/apache/graceful');
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'graceful reload 중 오류가 발생했습니다.');
    } finally {
      setBusy(false);
    }
  }

  async function applyIncludeOptional() {
    setConfirmIncludeOpen(false);
    setBusy(true);
    setError(null);
    try {
      await api.post('/apache/setup-apply-include-optional');
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'IncludeOptional 적용 중 오류가 발생했습니다.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>Apache 상태</h1>
      {error && <div className="alert alert-error">{error}</div>}

      {status && (
        <section className="panel">
          <h2>현재 상태</h2>
          <p>
            프로세스: <StatusBadge status={String(status.processStatus.running)} />{' '}
            {status.processStatus.pid && `(PID ${status.processStatus.pid})`}
          </p>
          <p>버전: {status.version}</p>
          <p>
            필수 모듈:{' '}
            {status.moduleCheck.missingRequired.length === 0 ? (
              <StatusBadge status="HEALTHY" />
            ) : (
              <>
                <StatusBadge status="HEALTH_CHECK_FAILED" /> ({status.moduleCheck.missingRequired.join(', ')} 비활성)
              </>
            )}
          </p>
          <p>WebSocket 모듈(mod_proxy_wstunnel): {status.moduleCheck.websocketSupported ? '사용 가능' : '비활성'}</p>
          <div className="actions-cell">
            <button className="btn" disabled={busy} onClick={runTestConfig}>
              문법 검사 실행
            </button>
            <button className="btn" disabled={busy} onClick={runGraceful}>
              Graceful Reload 실행
            </button>
          </div>
        </section>
      )}

      {setupCheck && (
        <section className="panel">
          <h2>최초 설정 마법사 검사</h2>
          <ul className="check-list">
            <CheckRow label="Apache 설치 경로 존재" ok={setupCheck.apacheRootPathExists} />
            <CheckRow label="httpd.exe 존재" ok={setupCheck.httpdExecutableExists} />
            <CheckRow label="httpd-vhosts.conf 존재" ok={setupCheck.vhostsFileExists} />
            <CheckRow label="mw-sites 폴더 생성 가능" ok={setupCheck.managedSitesPathWritable} />
            <CheckRow label="백업 폴더 생성 가능" ok={setupCheck.backupPathWritable} />
            <CheckRow label="SSL 인증서 파일 존재" ok={setupCheck.sslCertificateExists} />
            <CheckRow label="SSL 개인키 파일 존재" ok={setupCheck.sslCertificateKeyExists} />
            <CheckRow label="IncludeOptional 설정 적용됨" ok={setupCheck.includeOptionalLinePresent} />
          </ul>
          {!setupCheck.includeOptionalLinePresent && (
            <div className="alert alert-warn">
              <p>httpd-vhosts.conf에 다음 줄이 아직 없습니다. 확인 후 적용하세요:</p>
              <pre className="code-block">{setupCheck.includeOptionalLine}</pre>
              <button className="btn btn-primary" disabled={busy} onClick={() => setConfirmIncludeOpen(true)}>
                IncludeOptional 적용
              </button>
            </div>
          )}
        </section>
      )}

      <ConfirmDialog
        open={confirmIncludeOpen}
        title="IncludeOptional 설정 추가"
        confirmLabel="적용"
        onCancel={() => setConfirmIncludeOpen(false)}
        onConfirm={applyIncludeOptional}
      >
        <p>httpd-vhosts.conf 파일 끝에 다음 한 줄을 추가합니다 (기존 내용은 변경되지 않습니다):</p>
        <pre className="code-block">{setupCheck?.includeOptionalLine}</pre>
      </ConfirmDialog>
    </div>
  );
}
