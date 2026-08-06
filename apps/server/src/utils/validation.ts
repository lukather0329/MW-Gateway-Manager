import {
  DANGEROUS_CHARS_REGEX,
  DOMAIN_REGEX,
  HOST_REGEX,
  MAX_PORT,
  MIN_PORT,
} from '@mw-gateway/shared';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/** Lowercases and trims a raw domain input. Does not validate shape. */
export function normalizeDomain(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * A domain must be a bare hostname: no protocol, no path, no port, no
 * dangerous/shell/traversal characters, and must match a conservative
 * label-based regex (labels 1-63 chars, alnum + hyphen, at least two labels).
 */
export function assertValidDomain(rawDomain: string): string {
  const domain = normalizeDomain(rawDomain);

  if (!domain) {
    throw new ValidationError('도메인을 입력해야 합니다.');
  }
  if (domain.includes('://')) {
    throw new ValidationError('도메인에는 프로토콜을 포함할 수 없습니다.');
  }
  if (domain.includes('/') || domain.includes('\\')) {
    throw new ValidationError('도메인에는 경로(/, \\)를 포함할 수 없습니다.');
  }
  if (domain.includes(':')) {
    throw new ValidationError('도메인에는 포트를 포함할 수 없습니다.');
  }
  if (DANGEROUS_CHARS_REGEX.test(domain)) {
    throw new ValidationError('도메인에 허용되지 않는 문자가 포함되어 있습니다.');
  }
  if (!DOMAIN_REGEX.test(domain)) {
    throw new ValidationError('도메인 형식이 올바르지 않습니다.');
  }
  return domain;
}

/**
 * Converts a validated domain into a filesystem-safe Apache config file
 * name. Because the domain has already passed assertValidDomain, the only
 * remaining characters are [a-z0-9.-], which are safe on Windows/NTFS.
 */
export function domainToConfigFileName(domain: string): string {
  const safe = domain.replace(/[^a-z0-9.-]/g, '');
  if (safe !== domain || safe.includes('..')) {
    throw new ValidationError('도메인을 안전한 파일명으로 변환할 수 없습니다.');
  }
  return `${safe}.conf`;
}

/**
 * Target host/IP validation. Allows IPv4, "localhost", and simple
 * hostnames. Rejects shell metacharacters, quotes, whitespace/newlines and
 * anything that could be interpreted as an Apache directive.
 */
export function assertValidHost(rawHost: string): string {
  const host = rawHost.trim();

  if (!host) {
    throw new ValidationError('대상 IP 또는 호스트를 입력해야 합니다.');
  }
  if (/\s/.test(host)) {
    throw new ValidationError('대상 IP/호스트에는 공백이나 줄바꿈을 포함할 수 없습니다.');
  }
  if (DANGEROUS_CHARS_REGEX.test(host)) {
    throw new ValidationError('대상 IP/호스트에 허용되지 않는 문자가 포함되어 있습니다.');
  }
  if (!HOST_REGEX.test(host)) {
    throw new ValidationError('대상 IP/호스트 형식이 올바르지 않습니다.');
  }
  return host;
}

export interface PortCheckResult {
  port: number;
  isSystemPort: boolean;
}

export function assertValidPort(rawPort: number | string): PortCheckResult {
  const port = typeof rawPort === 'string' ? Number(rawPort) : rawPort;

  if (!Number.isInteger(port)) {
    throw new ValidationError('포트는 숫자여야 합니다.');
  }
  if (port < MIN_PORT || port > MAX_PORT) {
    throw new ValidationError(`포트는 ${MIN_PORT}~${MAX_PORT} 범위여야 합니다.`);
  }
  return { port, isSystemPort: port === 80 || port === 443 };
}

/** Health check path must be a root-relative path with no dangerous chars. */
export function assertValidHealthCheckPath(rawPath?: string): string {
  const path = (rawPath ?? '/').trim();
  if (!path.startsWith('/')) {
    throw new ValidationError('상태 확인 경로는 /로 시작해야 합니다.');
  }
  if (DANGEROUS_CHARS_REGEX.test(path) || /\s/.test(path)) {
    throw new ValidationError('상태 확인 경로에 허용되지 않는 문자가 포함되어 있습니다.');
  }
  return path;
}

export function containsDangerousChars(value: string): boolean {
  return DANGEROUS_CHARS_REGEX.test(value);
}
