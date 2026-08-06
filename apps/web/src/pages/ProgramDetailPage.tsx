import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type { ProgramDTO } from '@mw-gateway/shared';

interface PreviewResult {
  fileName: string;
  filePath: string;
  content: string;
  moduleCheck: { missingRequired: string[]; websocketSupported: boolean };
  precheckIssues: string[];
}

interface ApplyOutcome {
  success: boolean;
  message: string;
  syntaxTestRaw: string;
  rolledBack: boolean;
}

interface TestOutcome {
  status: string;
  tcpOk: boolean;
  httpOk: boolean;
  healthOk: boolean | null;
  statusCode?: number;
  responseTimeMs: number;
  errorMessage?: string;
}

export function ProgramDetailPage() {
  const { id } = useParams();
  const [program, setProgram] = useState<ProgramDTO | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [applyOutcome, setApplyOutcome] = useState<ApplyOutcome | null>(null);
  const [testOutcome, setTestOutcome] = useState<TestOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmApplyOpen, setConfirmApplyOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  function reload() {
    if (!id) return;
    api
      .get<ProgramDTO>(`/programs/${id}`)
      .then(setProgram)
      .catch((err) => setError(err.message));
  }

  useEffect(reload, [id]);

  async function loadPreview() {
    if (!id) return;
    setError(null);
    setBusy(true);
    try {
      const result = await api.post<PreviewResult>(`/programs/${id}/preview`);
      setPreview(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '미리보기를 불러오지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  async function doApply() {
    if (!id) return;
    setConfirmApplyOpen(false);
    setBusy(true);
    setError(null);
    try {
      const result = await api.post<{ outcome: ApplyOutcome }>(`/programs/${id}/apply`);
      setApplyOutcome(result.outcome);
      reload();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('설정 적용 중 오류가 발생했습니다.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function doTest() {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.post<TestOutcome>(`/programs/${id}/test`);
      setTestOutcome(result);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '연결 테스트 중 오류가 발생했습니다.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleEnabled() {
    if (!id || !program) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/programs/${id}/${program.enabled ? 'disable' : 'enable'}`);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '처리 중 오류가 발생했습니다.');
    } finally {
      setBusy(false);
    }
  }

  if (!program) return <p>불러오는 중...</p>;

  return (
    <div>
      <div className="page-header">
        <h1>{program.name}</h1>
        <div className="actions-cell">
          <Link to={`/programs/${program.id}/edit`} className="btn">
            수정
          </Link>
          <button className="btn" disabled={busy} onClick={doTest}>
            연결 테스트
          </button>
          <button className="btn" disabled={busy} onClick={loadPreview}>
            설정 미리보기
          </button>
          <button className="btn" disabled={busy} onClick={toggleEnabled}>
            {program.enabled ? '비활성화' : '활성화'}
          </button>
          <Link to={`/audit-logs?targetId=${program.id}`} className="btn">
            로그 보기
          </Link>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <section className="panel">
        <h2>기본 정보</h2>
        <dl className="detail-grid">
          <dt>도메인</dt>
          <dd>{program.domain}</dd>
          <dt>대상</dt>
          <dd>
            {program.targetProtocol}://{program.targetHost}:{program.targetPort}
          </dd>
          <dt>WebSocket</dt>
          <dd>{program.websocketEnabled ? '사용' : '미사용'}</dd>
          <dt>SSL</dt>
          <dd>{program.sslEnabled ? '사용' : '미사용'}</dd>
          <dt>상태 확인 경로</dt>
          <dd>{program.healthCheckPath}</dd>
          <dt>활성화</dt>
          <dd>
            <StatusBadge status={String(program.enabled)} />
          </dd>
          <dt>설정 상태</dt>
          <dd>
            <StatusBadge status={program.configStatus} />
          </dd>
          <dt>연결 상태</dt>
          <dd>
            <StatusBadge status={program.healthStatus} />
          </dd>
          <dt>마지막 확인 시각</dt>
          <dd>{program.lastHealthCheckedAt ? new Date(program.lastHealthCheckedAt).toLocaleString() : '-'}</dd>
          <dt>등록일</dt>
          <dd>{new Date(program.createdAt).toLocaleString()}</dd>
          <dt>수정일</dt>
          <dd>{new Date(program.updatedAt).toLocaleString()}</dd>
        </dl>
      </section>

      {testOutcome && (
        <section className="panel">
          <h2>연결 테스트 결과</h2>
          <p>
            상태: <StatusBadge status={testOutcome.status} /> · 응답시간 {testOutcome.responseTimeMs}ms
            {testOutcome.statusCode !== undefined && ` · HTTP ${testOutcome.statusCode}`}
          </p>
          {testOutcome.errorMessage && <p className="muted">{testOutcome.errorMessage}</p>}
        </section>
      )}

      {preview && (
        <section className="panel">
          <h2>설정 미리보기</h2>
          <p>생성될 파일: {preview.filePath}</p>
          {preview.precheckIssues.length > 0 && (
            <div className="alert alert-warn">
              <ul>
                {preview.precheckIssues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </div>
          )}
          <pre className="code-block">{preview.content}</pre>
          <button className="btn btn-primary" disabled={busy} onClick={() => setConfirmApplyOpen(true)}>
            적용
          </button>
        </section>
      )}

      {applyOutcome && (
        <section className="panel">
          <h2>적용 결과</h2>
          <p>
            <StatusBadge status={applyOutcome.success ? 'HEALTHY' : 'HEALTH_CHECK_FAILED'} /> {applyOutcome.message}
          </p>
          <pre className="code-block">{applyOutcome.syntaxTestRaw}</pre>
        </section>
      )}

      <ConfirmDialog
        open={confirmApplyOpen}
        title="설정 적용"
        confirmLabel="적용"
        onCancel={() => setConfirmApplyOpen(false)}
        onConfirm={doApply}
      >
        <p>다음 내용으로 Apache 설정을 적용합니다:</p>
        <ul>
          <li>도메인: {program.domain}</li>
          <li>
            대상 IP/포트: {program.targetHost}:{program.targetPort}
          </li>
          <li>설정 파일: {program.configFileName}</li>
        </ul>
        <p>적용 전 현재 설정이 자동으로 백업되며, 문법 오류나 Apache 재시작 실패 시 자동으로 이전 설정으로 복구됩니다.</p>
      </ConfirmDialog>
    </div>
  );
}
