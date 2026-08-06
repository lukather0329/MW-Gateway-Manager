import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface UserRow {
  id: string;
  username: string;
  createdAt: string;
  lockedUntil: string | null;
}

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reload() {
    api.get<UserRow[]>('/users').then(setUsers).catch((err) => setError(err.message));
  }

  useEffect(reload, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/users', { username, password });
      setUsername('');
      setPassword('');
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '계정 생성 중 오류가 발생했습니다.');
    } finally {
      setBusy(false);
    }
  }

  async function removeUser(id: string) {
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/users/${id}`);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '삭제 중 오류가 발생했습니다.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>사용자 관리</h1>
      <p className="muted">내부 관리자 계정만 생성할 수 있습니다 (회원가입 기능은 제공하지 않습니다).</p>
      {error && <div className="alert alert-error">{error}</div>}

      <section className="panel">
        <h2>관리자 계정 추가</h2>
        <form className="form form-inline" onSubmit={handleSubmit}>
          <label>
            아이디
            <input value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} />
          </label>
          <label>
            비밀번호
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={10} />
          </label>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            추가
          </button>
        </form>
      </section>

      <table className="table">
        <thead>
          <tr>
            <th>아이디</th>
            <th>생성일</th>
            <th>잠금 상태</th>
            <th>작업</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.username}</td>
              <td>{new Date(u.createdAt).toLocaleString()}</td>
              <td>{u.lockedUntil && new Date(u.lockedUntil) > new Date() ? '잠김' : '정상'}</td>
              <td>
                <button
                  className="btn btn-sm btn-danger"
                  disabled={busy || u.id === currentUser?.id}
                  onClick={() => removeUser(u.id)}
                >
                  삭제
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
