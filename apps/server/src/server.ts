import { createApp } from './app';
import { env } from './config/env';
import { services } from './services/container';

const app = createApp();

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`MW Gateway Manager server listening on port ${env.port} (${env.nodeEnv})`);
  // eslint-disable-next-line no-console
  console.log(`Apache command runner mode: ${env.apacheCommandRunner}`);
});

services.healthCheckScheduler.start();
// eslint-disable-next-line no-console
console.log(`Health check scheduler running every ${env.healthCheckIntervalMs}ms`);
