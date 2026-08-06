interface StatusBadgeProps {
  status: string;
}

const STATUS_LABELS: Record<string, { text: string; tone: 'ok' | 'warn' | 'error' | 'neutral' }> = {
  APPLIED: { text: '적용됨', tone: 'ok' },
  NOT_APPLIED: { text: '미적용', tone: 'neutral' },
  PENDING: { text: '대기', tone: 'warn' },
  FAILED: { text: '오류', tone: 'error' },
  ROLLED_BACK: { text: '롤백됨', tone: 'error' },
  UNKNOWN: { text: '확인 안됨', tone: 'neutral' },
  CHECKING: { text: '확인 중', tone: 'warn' },
  UNREACHABLE: { text: '연결 불가', tone: 'error' },
  TCP_OK: { text: '포트 연결됨', tone: 'warn' },
  HTTP_OK: { text: 'HTTP 응답함', tone: 'ok' },
  HEALTHY: { text: '정상', tone: 'ok' },
  HEALTH_CHECK_FAILED: { text: '상태 확인 실패', tone: 'error' },
  true: { text: '활성', tone: 'ok' },
  false: { text: '비활성', tone: 'neutral' },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const info = STATUS_LABELS[status] ?? { text: status, tone: 'neutral' as const };
  return <span className={`badge badge-${info.tone}`}>{info.text}</span>;
}
