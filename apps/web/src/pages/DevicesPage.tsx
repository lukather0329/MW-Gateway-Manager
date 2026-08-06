import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import type { DeviceDTO, ProgramDTO } from '@mw-gateway/shared';

const emptyForm = { name: '', deviceType: '', programId: '', location: '', memo: '', enabled: true };

export function DevicesPage() {
  const [devices, setDevices] = useState<DeviceDTO[]>([]);
  const [programs, setPrograms] = useState<ProgramDTO[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [tokenResult, setTokenResult] = useState<{ deviceId: string; token: string } | null>(null);
  const [busy, setBusy] = useState(false);

  function reload() {
    api.get<DeviceDTO[]>('/devices').then(setDevices).catch((err) => setError(err.message));
    api.get<ProgramDTO[]>('/programs').then(setPrograms).catch(() => undefined);
  }

  useEffect(reload, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/devices', { ...form, programId: form.programId || null });
      setForm(emptyForm);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '장비 등록 중 오류가 발생했습니다.');
    } finally {
      setBusy(false);
    }
  }

  async function removeDevice(id: string) {
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/devices/${id}`);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '삭제 중 오류가 발생했습니다.');
    } finally {
      setBusy(false);
    }
  }

  async function regenerateToken(id: string) {
    setBusy(true);
    setError(null);
    try {
      const result = await api.post<{ deviceId: string; token: string }>(`/devices/${id}/regenerate-token`);
      setTokenResult(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '토큰 생성 중 오류가 발생했습니다.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>장비 관리</h1>
      <p className="muted">
        여기 등록되는 장비는 프로그램에 연결되는 실제 장치(라즈베리파이, ESP32, 카메라 등)의 기본 정보입니다. 장비를
        추가한다고 해서 Apache VirtualHost가 생성되지는 않습니다. 실제 MQTT/펌웨어 통신 기능은 이번 범위에 포함되지
        않습니다.
      </p>
      {error && <div className="alert alert-error">{error}</div>}

      <section className="panel">
        <h2>장비 등록</h2>
        <form className="form form-inline" onSubmit={handleSubmit}>
          <label>
            장비명
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label>
            장비 유형
            <input
              value={form.deviceType}
              onChange={(e) => setForm({ ...form, deviceType: e.target.value })}
              placeholder="raspberrypi, esp32, camera..."
              required
            />
          </label>
          <label>
            연결 프로그램
            <select value={form.programId} onChange={(e) => setForm({ ...form, programId: e.target.value })}>
              <option value="">(없음)</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            설치 장소
            <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </label>
          <label>
            메모
            <input value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} />
          </label>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            등록
          </button>
        </form>
      </section>

      {tokenResult && (
        <div className="alert alert-warn">
          <p>
            새 토큰이 발급되었습니다. 이 화면을 벗어나면 다시 확인할 수 없으니 지금 안전한 곳에 저장하세요.
          </p>
          <pre className="code-block">
            deviceId: {tokenResult.deviceId}
            {'\n'}token: {tokenResult.token}
          </pre>
        </div>
      )}

      <table className="table">
        <thead>
          <tr>
            <th>장비명</th>
            <th>유형</th>
            <th>연결 프로그램</th>
            <th>장소</th>
            <th>활성화</th>
            <th>마지막 접속</th>
            <th>작업</th>
          </tr>
        </thead>
        <tbody>
          {devices.map((device) => (
            <tr key={device.id}>
              <td>{device.name}</td>
              <td>{device.deviceType}</td>
              <td>{programs.find((p) => p.id === device.programId)?.name ?? '-'}</td>
              <td>{device.location ?? '-'}</td>
              <td>
                <StatusBadge status={String(device.enabled)} />
              </td>
              <td>{device.lastConnectedAt ? new Date(device.lastConnectedAt).toLocaleString() : '-'}</td>
              <td className="actions-cell">
                <button className="btn btn-sm" disabled={busy} onClick={() => regenerateToken(device.id)}>
                  토큰 재발급
                </button>
                <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => removeDevice(device.id)}>
                  삭제
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {devices.length === 0 && <p className="muted">등록된 장비가 없습니다.</p>}
    </div>
  );
}
