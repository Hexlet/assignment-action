// eslint-disable-next-line
import { setup } from 'jest-dev-server';

export default async () => {
  await setup({
    command: 'fastify start server.js -l info -P',
    launchTimeout: 20000,
    port: 3000,
    debug: true,
  });
};
