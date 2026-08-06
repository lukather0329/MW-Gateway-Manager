import { env } from '../../config/env';
import { ApacheCommandRunner } from './ApacheCommandRunner';
import { RealApacheCommandRunner } from './RealApacheCommandRunner';
import { MockApacheCommandRunner } from './MockApacheCommandRunner';

export function createApacheCommandRunner(): ApacheCommandRunner {
  if (env.apacheCommandRunner === 'real') {
    return new RealApacheCommandRunner(env.apacheExecutablePath);
  }
  return new MockApacheCommandRunner({
    statusResult: { running: env.apacheMockProcessRunning, pid: env.apacheMockProcessRunning ? 1 : undefined },
  });
}
