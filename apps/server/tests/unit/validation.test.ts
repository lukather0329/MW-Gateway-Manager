import { describe, expect, it } from 'vitest';
import {
  assertValidDomain,
  assertValidHealthCheckPath,
  assertValidHost,
  assertValidPort,
  containsDangerousChars,
  domainToConfigFileName,
  normalizeDomain,
  ValidationError,
} from '../../src/utils/validation';

describe('assertValidDomain', () => {
  it('accepts a normal two-label domain and lowercases it', () => {
    expect(assertValidDomain('Camera.RoboWorks.co.kr')).toBe('camera.roboworks.co.kr');
  });

  it('rejects an empty domain', () => {
    expect(() => assertValidDomain('')).toThrow(ValidationError);
    expect(() => assertValidDomain('   ')).toThrow(ValidationError);
  });

  it('rejects a domain containing a protocol', () => {
    expect(() => assertValidDomain('https://camera.roboworks.co.kr')).toThrow(ValidationError);
  });

  it('rejects a domain containing a path', () => {
    expect(() => assertValidDomain('camera.roboworks.co.kr/admin')).toThrow(ValidationError);
    expect(() => assertValidDomain('camera.roboworks.co.kr\\admin')).toThrow(ValidationError);
  });

  it('rejects a domain containing a port', () => {
    expect(() => assertValidDomain('camera.roboworks.co.kr:8080')).toThrow(ValidationError);
  });

  it('rejects a single-label value (not a real domain)', () => {
    expect(() => assertValidDomain('localhost')).toThrow(ValidationError);
  });

  it('rejects path-traversal and shell metacharacters', () => {
    for (const bad of ['cam era.roboworks.co.kr', 'camera"..roboworks.co.kr', 'camera;rm.roboworks.co.kr']) {
      expect(() => assertValidDomain(bad)).toThrow(ValidationError);
    }
  });
});

describe('normalizeDomain', () => {
  it('trims and lowercases without validating', () => {
    expect(normalizeDomain('  Foo.BAR  ')).toBe('foo.bar');
  });
});

describe('domainToConfigFileName', () => {
  it('converts a validated domain into a <domain>.conf filename', () => {
    expect(domainToConfigFileName('camera.roboworks.co.kr')).toBe('camera.roboworks.co.kr.conf');
  });

  it('throws if the domain still contains unsafe characters (defense in depth)', () => {
    expect(() => domainToConfigFileName('camera/../etc.co.kr')).toThrow(ValidationError);
  });
});

describe('assertValidHost', () => {
  it('accepts a loopback IP, a plain hostname, and localhost', () => {
    expect(assertValidHost('127.0.0.1')).toBe('127.0.0.1');
    expect(assertValidHost('192.168.0.30')).toBe('192.168.0.30');
    expect(assertValidHost('internal-server.local')).toBe('internal-server.local');
    expect(assertValidHost('localhost')).toBe('localhost');
  });

  it('rejects empty input', () => {
    expect(() => assertValidHost('')).toThrow(ValidationError);
  });

  it('rejects shell metacharacters and command-injection attempts', () => {
    const malicious = [
      '127.0.0.1; rm -rf /',
      '127.0.0.1 && echo pwned',
      '127.0.0.1 | cat /etc/passwd',
      '127.0.0.1`whoami`',
      '127.0.0.1$(whoami)',
      '"127.0.0.1"',
      "'127.0.0.1'",
      '127.0.0.1\r\nSetHandler malicious',
    ];
    for (const value of malicious) {
      expect(() => assertValidHost(value)).toThrow(ValidationError);
    }
  });

  it('rejects whitespace-containing values', () => {
    expect(() => assertValidHost('127.0.0.1 8080')).toThrow(ValidationError);
  });
});

describe('assertValidPort', () => {
  it('accepts ports within 1-65535 and flags system ports', () => {
    expect(assertValidPort(3101)).toEqual({ port: 3101, isSystemPort: false });
    expect(assertValidPort(80)).toEqual({ port: 80, isSystemPort: true });
    expect(assertValidPort(443)).toEqual({ port: 443, isSystemPort: true });
    expect(assertValidPort('8080')).toEqual({ port: 8080, isSystemPort: false });
  });

  it('rejects out-of-range and non-integer ports', () => {
    expect(() => assertValidPort(0)).toThrow(ValidationError);
    expect(() => assertValidPort(65536)).toThrow(ValidationError);
    expect(() => assertValidPort(-1)).toThrow(ValidationError);
    expect(() => assertValidPort(3101.5)).toThrow(ValidationError);
    expect(() => assertValidPort('not-a-port')).toThrow(ValidationError);
  });
});

describe('assertValidHealthCheckPath', () => {
  it('defaults to "/" when omitted', () => {
    expect(assertValidHealthCheckPath(undefined)).toBe('/');
  });

  it('accepts a normal root-relative path', () => {
    expect(assertValidHealthCheckPath('/api/health')).toBe('/api/health');
  });

  it('rejects paths not starting with /', () => {
    expect(() => assertValidHealthCheckPath('api/health')).toThrow(ValidationError);
  });

  it('rejects dangerous characters and whitespace', () => {
    expect(() => assertValidHealthCheckPath('/api/health;rm')).toThrow(ValidationError);
    expect(() => assertValidHealthCheckPath('/api/ health')).toThrow(ValidationError);
  });
});

describe('containsDangerousChars', () => {
  it('flags quotes, shell metacharacters, and path traversal', () => {
    for (const value of ['"x"', "'x'", 'a;b', 'a|b', 'a&b', 'a`b', 'a<b', 'a>b', 'a$(b)', '../etc', '..\\win']) {
      expect(containsDangerousChars(value)).toBe(true);
    }
  });

  it('does not flag ordinary values', () => {
    for (const value of ['camera.roboworks.co.kr', '127.0.0.1', '/api/health', 'My Program']) {
      expect(containsDangerousChars(value)).toBe(false);
    }
  });
});
