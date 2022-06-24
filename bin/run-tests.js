#!/usr/bin/env node

import core from '@actions/core';
import path from 'path';
import colors from 'ansi-colors';
import { runTests, buildErrorText } from '../src/index.js';

const verbose = core.getBooleanInput('verbose', { required: false });
const mountPath = core.getInput('mount_path', { required: true });
const apiHost = process.env.ACTION_API_HOST;
const projectPath = path.resolve(process.cwd(), process.env.ACTION_PROJECT_PATH || '');
const hexletToken = core.getInput('hexlet_token', { required: true });

const params = {
  verbose,
  mountPath,
  hexletToken,
  apiHost,
  projectPath,
};

try {
  await runTests(params);
} catch (e) {
  const errorText = [
    colors.red('The tests have failed. Examine what they have to say. Inhale deeply. Exhale. Fix the code.'),
    '',
    buildErrorText(e),
  ].join('\n');
  core.setFailed(errorText);

  // NOTE: бектрейс экшена пользователям не нужен
  if (verbose) {
    throw e;
  }
}
