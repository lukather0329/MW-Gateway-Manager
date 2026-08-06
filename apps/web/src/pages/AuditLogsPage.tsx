import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';

interface AuditLog {
  id: string;
  action: string;
  actorUsername: string | null;
  targetType: string | null;
  targetId: string | null;
  detail: string | null;
  result: string;
  createdAt: string;
}

export function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const targetIdFilter = searchParams.get('targetId');

  useEffect(() => {
    api
      .get<AuditLog[]>('/audit-logs?limit=200')
      .then(setLogs)
      .catch((err) => setError(err.message));
  }, []);

  const visibleLogs = targetIdFilter ? logs.filter((log) => log.targetId === targetIdFilter) : logs;

  return (
    <div>
      <h1>변경 이력</h1>
      {targetIdFilter && <p className="muted">대상 ID로 필터링됨: {targetIdFilter}</p>}
      {error && <div className="alert alert-error">{error}</div>}

      <table className="table">
        <thead>
          <tr>
            <th>시각</th>
            <th>동작</th>
            <th>수행자</th>
            <th>대상</th>
            <th>결과</th>
            <th>상세</th>
          </tr>
        </thead>
        <tbody>
          {visibleLogs.map((log) => (
            <tr key={log.id}>
              <td>{new Date(log.createdAt).toLocaleString()}</td>
              <td>{log.action}</td>
              <td>{log.actorUsername ?? '-'}</td>
              <td>
                {log.targetType ? `${log.targetType} (${log.targetId})` : '-'}
              </td>
              <td className={log.result === 'SUCCESS' ? 'check-ok' : 'check-fail'}>{log.result}</td>
              <td className="log-detail">{log.detail ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {visibleLogs.length === 0 && <p className="muted">이력이 없습니다.</p>}
    </div>
  );
}
