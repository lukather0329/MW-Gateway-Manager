import { createApp } from './app';
import { env } from './config/env';

const app = createApp();

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`MW Gateway Manager server listening on port ${env.port} (${env.nodeEnv})`);
  // eslint-disable-next-line no-console
  console.log(`Apache command runner mode: ${env.apacheCommandRunner}`);
});
