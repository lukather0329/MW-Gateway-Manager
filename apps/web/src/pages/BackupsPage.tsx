import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { ConfirmDialog } from '../components/ConfirmDialog';

interface Backup {
  id: string;
  folderName: string;
  reason: string;
  createdBy: string;
  createdAt: string;
  testResult: string | null;
  applyResult: string | null;
  restored: boolean;
  restoredAt: string | null;
}

export function BackupsPage() {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<Backup | null>(null);

  function reload() {
    api.get<Backup[]>('/backups').then(setBackups).catch((err) => setError(err.message));
  }

  useEffect(reload, []);

  async function createBackup() {
    setBusy(true);
    setError(null);
    try {
      await api.post('/backups');
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '백업 생성 중 오류가 발생했습니다.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmRestore() {
    if (!restoreTarget) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/backups/${restoreTarget.id}/restore`);
      setRestoreTarget(null);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '복구 중 오류가 발생했습니다.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>설정 백업</h1>
        <button className="btn btn-primary" disabled={busy} onClick={createBackup}>
          지금 백업
        </button>
      </div>
      {error && <div className="alert alert-error">{error}</div>}

      <table className="table">
        <thead>
          <tr>
            <th>폴더명</th>
            <th>사유</th>
            <th>수행자</th>
            <th>생성 시각</th>
            <th>복구 여부</th>
            <th>작업</th>
          </tr>
        </thead>
        <tbody>
          {backups.map((backup) => (
            <tr key={backup.id}>
              <td>{backup.folderName}</td>
              <td>{backup.reason}</td>
              <td>{backup.createdBy}</td>
              <td>{new Date(backup.createdAt).toLocaleString()}</td>
              <td>{backup.restored ? `복구됨 (${backup.restoredAt ? new Date(backup.restoredAt).toLocaleString() : ''})` : '-'}</td>
              <td>
                <button className="btn btn-sm" disabled={busy} onClick={() => setRestoreTarget(backup)}>
                  이 시점으로 복구
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {backups.length === 0 && <p className="muted">백업 이력이 없습니다.</p>}

      <ConfirmDialog
        open={restoreTarget !== null}
        title="설정 복구"
        danger
        confirmLabel="복구"
        onCancel={() => setRestoreTarget(null)}
        onConfirm={confirmRestore}
      >
        <p>
          <strong>{restoreTarget?.folderName}</strong> 시점으로 Apache 설정을 복구합니다. 복구 후 문법 검사가 정상일 때만
          설정 재적용(reload)이 실행됩니다.
        </p>
      </ConfirmDialog>
    </div>
  );
}
