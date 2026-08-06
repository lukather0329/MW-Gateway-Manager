import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type { ProgramDTO } from '@mw-gateway/shared';

export function ProgramsListPage() {
  const [programs, setPrograms] = useState<ProgramDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProgramDTO | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function reload() {
    api
      .get<ProgramDTO[]>('/programs')
      .then(setPrograms)
      .catch((err) => setError(err.message));
  }

  useEffect(reload, []);

  async function toggleEnabled(program: ProgramDTO) {
    setBusyId(program.id);
    try {
      await api.post(`/programs/${program.id}/${program.enabled ? 'disable' : 'enable'}`);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '처리 중 오류가 발생했습니다.');
    } finally {
      setBusyId(null);
    }
  }

  async function testConnection(program: ProgramDTO) {
    setBusyId(program.id);
    try {
      await api.post(`/programs/${program.id}/test`);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '연결 테스트 중 오류가 발생했습니다.');
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      await api.delete(`/programs/${deleteTarget.id}`);
      setDeleteTarget(null);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '삭제 중 오류가 발생했습니다.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>프로그램 관리</h1>
        <Link to="/programs/new" className="btn btn-primary">
          + 프로그램 등록
        </Link>
      </div>
      {error && <div className="alert alert-error">{error}</div>}

      <table className="table">
        <thead>
          <tr>
            <th>프로그램명</th>
            <th>도메인</th>
            <th>대상</th>
            <th>WebSocket</th>
            <th>SSL</th>
            <th>활성화</th>
            <th>설정 상태</th>
            <th>연결 상태</th>
            <th>작업</th>
          </tr>
        </thead>
        <tbody>
          {programs.map((program) => (
            <tr key={program.id}>
              <td>
                <Link to={`/programs/${program.id}`}>{program.name}</Link>
              </td>
              <td>{program.domain}</td>
              <td>
                {program.targetProtocol}://{program.targetHost}:{program.targetPort}
              </td>
              <td>{program.websocketEnabled ? '사용' : '미사용'}</td>
              <td>{program.sslEnabled ? '사용' : '미사용'}</td>
              <td>
                <StatusBadge status={String(program.enabled)} />
              </td>
              <td>
                <StatusBadge status={program.configStatus} />
              </td>
              <td>
                <StatusBadge status={program.healthStatus} />
              </td>
              <td className="actions-cell">
                <button className="btn btn-sm" disabled={busyId === program.id} onClick={() => testConnection(program)}>
                  연결 테스트
                </button>
                <button className="btn btn-sm" disabled={busyId === program.id} onClick={() => toggleEnabled(program)}>
                  {program.enabled ? '비활성화' : '활성화'}
                </button>
                <button className="btn btn-sm btn-danger" disabled={busyId === program.id} onClick={() => setDeleteTarget(program)}>
                  삭제
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {programs.length === 0 && <p className="muted">등록된 프로그램이 없습니다.</p>}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="프로그램 삭제"
        danger
        confirmLabel="삭제"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      >
        {deleteTarget && (
          <>
            <p>
              <strong>{deleteTarget.name}</strong> ({deleteTarget.domain})을(를) 삭제하시겠습니까?
            </p>
            <p className="muted">
              대상: {deleteTarget.targetProtocol}://{deleteTarget.targetHost}:{deleteTarget.targetPort}
              <br />
              설정 파일: {deleteTarget.configFileName}
            </p>
            <p>적용된 Apache 설정이 있다면 먼저 안전하게 제거한 뒤 삭제합니다.</p>
          </>
        )}
      </ConfirmDialog>
    </div>
  );
}
