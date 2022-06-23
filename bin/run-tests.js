#!/usr/bin/env node

import core from '@actions/core';
import path from 'path';
import colors from 'ansi-colors';
import { runTests, buildErrorText } from '../src/index.js';

const verbose = core.getBooleanInput('verbose', { required: false });
const mountPath = core.getInput('mount_path', { required: true });
const apiHost = process.env.ACTION_API_HOST;
const projectPath = path.resolve(process.cwd(), process.env.ACTION_PROJECT_PATH || '');

const params = {
  verbose,
  mountPath,
  apiHost,
  projectPath,
};

try {
  await runTests(params);
} catch (e) {
  const errorText = 'The tests have failed. Examine what they have to say. Inhale deeply. Exhale. Fix the code.';
  console.error(colors.red(errorText));
  console.error(buildErrorText(e));

  // NOTE: бектрейс экшена пользователям не нужен
  if (verbose) {
    throw e;
  }
}
