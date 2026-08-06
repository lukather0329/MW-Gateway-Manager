import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';

interface DashboardData {
  programCounts: { total: number; active: number; healthy: number; errored: number };
  apache: {
    processStatus: { running: boolean; pid?: number };
    lastSyntaxCheck: { valid: boolean; raw: string };
  };
  lastConfigChange: { fileName: string; action: string; createdAt: string; createdBy: string } | null;
  recentHealthErrors: Array<{
    id: string;
    status: string;
    checkedAt: string;
    errorMessage?: string;
    program: { name: string; domain: string };
  }>;
  recentBackups: Array<{ id: string; folderName: string; reason: string; createdAt: string; createdBy: string }>;
}

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<DashboardData>('/dashboard')
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!data) return <p>불러오는 중...</p>;

  return (
    <div>
      <h1>대시보드</h1>
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-value">{data.programCounts.total}</div>
          <div className="stat-label">등록 프로그램 수</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{data.programCounts.active}</div>
          <div className="stat-label">활성 프로그램 수</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{data.programCounts.healthy}</div>
          <div className="stat-label">정상 프로그램 수</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{data.programCounts.errored}</div>
          <div className="stat-label">오류 프로그램 수</div>
        </div>
      </div>

      <section className="panel">
        <h2>Apache 상태</h2>
        <p>
          프로세스: <StatusBadge status={String(data.apache.processStatus.running)} />{' '}
          {data.apache.processStatus.pid && `(PID ${data.apache.processStatus.pid})`}
        </p>
        <p>
          마지막 문법 검사: <StatusBadge status={data.apache.lastSyntaxCheck.valid ? 'HEALTHY' : 'HEALTH_CHECK_FAILED'} />
        </p>
        <pre className="code-block">{data.apache.lastSyntaxCheck.raw}</pre>
      </section>

      <section className="panel">
        <h2>최근 설정 변경</h2>
        {data.lastConfigChange ? (
          <p>
            {data.lastConfigChange.action} · {data.lastConfigChange.fileName} · {data.lastConfigChange.createdBy} ·{' '}
            {new Date(data.lastConfigChange.createdAt).toLocaleString()}
          </p>
        ) : (
          <p className="muted">변경 이력이 없습니다.</p>
        )}
      </section>

      <section className="panel">
        <h2>최근 연결 오류</h2>
        {data.recentHealthErrors.length === 0 ? (
          <p className="muted">최근 연결 오류가 없습니다.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>프로그램</th>
                <th>상태</th>
                <th>메시지</th>
                <th>시각</th>
              </tr>
            </thead>
            <tbody>
              {data.recentHealthErrors.map((entry) => (
                <tr key={entry.id}>
                  <td>
                    {entry.program.name} ({entry.program.domain})
                  </td>
                  <td>
                    <StatusBadge status={entry.status} />
                  </td>
                  <td>{entry.errorMessage ?? '-'}</td>
                  <td>{new Date(entry.checkedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel">
        <h2>최근 백업 결과</h2>
        {data.recentBackups.length === 0 ? (
          <p className="muted">백업 이력이 없습니다.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>폴더</th>
                <th>사유</th>
                <th>수행자</th>
                <th>시각</th>
              </tr>
            </thead>
            <tbody>
              {data.recentBackups.map((backup) => (
                <tr key={backup.id}>
                  <td>{backup.folderName}</td>
                  <td>{backup.reason}</td>
                  <td>{backup.createdBy}</td>
                  <td>{new Date(backup.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
