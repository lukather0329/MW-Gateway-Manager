import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { ProgramDTO, ProgramInput } from '@mw-gateway/shared';

const emptyForm: ProgramInput = {
  name: '',
  description: '',
  domain: '',
  targetProtocol: 'http',
  targetHost: '',
  targetPort: 80,
  healthCheckPath: '/',
  websocketEnabled: false,
  sslEnabled: true,
  enabled: true,
};

export function ProgramFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState<ProgramInput>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.get<ProgramDTO>(`/programs/${id}`).then((program) => {
      setForm({
        name: program.name,
        description: program.description ?? '',
        domain: program.domain,
        targetProtocol: program.targetProtocol,
        targetHost: program.targetHost,
        targetPort: program.targetPort,
        healthCheckPath: program.healthCheckPath ?? '/',
        websocketEnabled: program.websocketEnabled,
        sslEnabled: program.sslEnabled,
        enabled: program.enabled,
      });
    });
  }, [id]);

  function update<K extends keyof ProgramInput>(key: K, value: ProgramInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setWarnings([]);
    setSubmitting(true);
    try {
      const payload = { ...form, targetPort: Number(form.targetPort) };
      const result = isEdit
        ? await api.put<{ program: ProgramDTO; warnings: string[] }>(`/programs/${id}`, payload)
        : await api.post<{ program: ProgramDTO; warnings: string[] }>('/programs', payload);
      if (result.warnings.length > 0) {
        setWarnings(result.warnings);
      }
      navigate(`/programs/${result.program.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '저장 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1>{isEdit ? '프로그램 수정' : '프로그램 등록'}</h1>
      {error && <div className="alert alert-error">{error}</div>}
      {warnings.length > 0 && (
        <div className="alert alert-warn">
          <ul>
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <form className="form" onSubmit={handleSubmit}>
        <fieldset>
          <legend>1. 기본정보</legend>
          <label>
            프로그램명
            <input value={form.name} onChange={(e) => update('name', e.target.value)} required />
          </label>
          <label>
            설명
            <textarea value={form.description} onChange={(e) => update('description', e.target.value)} rows={2} />
          </label>
        </fieldset>

        <fieldset>
          <legend>2. 연결 대상</legend>
          <label>
            대상 프로토콜
            <select value={form.targetProtocol} onChange={(e) => update('targetProtocol', e.target.value as 'http' | 'https')}>
              <option value="http">http</option>
              <option value="https">https</option>
            </select>
          </label>
          <label>
            대상 IP / 호스트
            <input value={form.targetHost} onChange={(e) => update('targetHost', e.target.value)} placeholder="127.0.0.1" required />
          </label>
          <label>
            대상 포트
            <input
              type="number"
              min={1}
              max={65535}
              value={form.targetPort}
              onChange={(e) => update('targetPort', Number(e.target.value))}
              required
            />
          </label>
        </fieldset>

        <fieldset>
          <legend>3. 도메인과 SSL</legend>
          <label>
            도메인
            <input value={form.domain} onChange={(e) => update('domain', e.target.value)} placeholder="camera.roboworks.co.kr" required />
          </label>
          <label className="checkbox-label">
            <input type="checkbox" checked={form.sslEnabled} onChange={(e) => update('sslEnabled', e.target.checked)} />
            SSL 사용 (https로 자동 리다이렉트)
          </label>
        </fieldset>

        <fieldset>
          <legend>4. WebSocket</legend>
          <label className="checkbox-label">
            <input type="checkbox" checked={form.websocketEnabled} onChange={(e) => update('websocketEnabled', e.target.checked)} />
            WebSocket 사용
          </label>
        </fieldset>

        <fieldset>
          <legend>5. 상태 확인</legend>
          <label>
            상태 확인 경로
            <input value={form.healthCheckPath} onChange={(e) => update('healthCheckPath', e.target.value)} placeholder="/api/health" />
          </label>
          <label className="checkbox-label">
            <input type="checkbox" checked={form.enabled} onChange={(e) => update('enabled', e.target.checked)} />
            활성화
          </label>
        </fieldset>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? '저장 중...' : '저장하고 미리보기로 이동'}
          </button>
        </div>
      </form>
    </div>
  );
}
