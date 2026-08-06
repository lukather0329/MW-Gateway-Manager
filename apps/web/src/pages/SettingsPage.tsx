import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import type { SystemSettingDTO } from '@mw-gateway/shared';

export function SettingsPage() {
  const [form, setForm] = useState<SystemSettingDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get<SystemSettingDTO>('/settings').then(setForm).catch((err) => setError(err.message));
  }, []);

  function update<K extends keyof SystemSettingDTO>(key: K, value: SystemSettingDTO[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await api.put<SystemSettingDTO>('/settings', form);
      setForm(updated);
      setMessage('저장되었습니다.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '저장 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!form) return <p>불러오는 중...</p>;

  return (
    <div>
      <h1>시스템 설정</h1>
      <p className="muted">
        아래 값들은 실제 운영 서버(Windows Server 2019 + XAMPP)의 경로와 일치해야 합니다. 이 개발 환경에서는 실제 D:\xampp
        경로를 확인할 수 없어 가정값으로 초기화되어 있습니다.
      </p>
      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-ok">{message}</div>}

      <form className="form" onSubmit={handleSubmit}>
        <label>
          Apache 루트 경로
          <input value={form.apacheRootPath} onChange={(e) => update('apacheRootPath', e.target.value)} />
        </label>
        <label>
          httpd.exe 경로
          <input value={form.apacheExecutablePath} onChange={(e) => update('apacheExecutablePath', e.target.value)} />
        </label>
        <label>
          httpd-vhosts.conf 경로
          <input value={form.apacheVhostsPath} onChange={(e) => update('apacheVhostsPath', e.target.value)} />
        </label>
        <label>
          mw-sites 폴더 경로
          <input value={form.managedSitesPath} onChange={(e) => update('managedSitesPath', e.target.value)} />
        </label>
        <label>
          백업 폴더 경로
          <input value={form.backupPath} onChange={(e) => update('backupPath', e.target.value)} />
        </label>
        <label>
          SSL 인증서 경로
          <input value={form.sslCertificatePath} onChange={(e) => update('sslCertificatePath', e.target.value)} />
        </label>
        <label>
          SSL 개인키 경로
          <input value={form.sslCertificateKeyPath} onChange={(e) => update('sslCertificateKeyPath', e.target.value)} />
        </label>
        <label>
          기본 도메인 접미사
          <input value={form.defaultDomainSuffix} onChange={(e) => update('defaultDomainSuffix', e.target.value)} />
        </label>
        <label>
          상태 확인 기본 타임아웃(ms)
          <input
            type="number"
            value={form.defaultHealthCheckTimeoutMs}
            onChange={(e) => update('defaultHealthCheckTimeoutMs', Number(e.target.value))}
          />
        </label>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            저장
          </button>
        </div>
      </form>
    </div>
  );
}
