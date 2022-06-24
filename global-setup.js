// eslint-disable-next-line
import { setup } from 'jest-dev-server';

export default async () => {
  await setup({
    command: 'make run-test-api-server',
    launchTimeout: 20000,
    port: 3000,
    debug: false,
  });
};
