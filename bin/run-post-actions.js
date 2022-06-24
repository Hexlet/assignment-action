#!/usr/bin/env node

import core from '@actions/core';
import { runPostActions, buildErrorText } from '../src/index.js';

const verbose = core.getBooleanInput('verbose', { required: false });
const hexletToken = core.getInput('hexlet_token', { required: true });

const params = {
  hexletToken,
};

try {
  await runPostActions(params);
} catch (e) {
  const errorText = verbose ? e : buildErrorText(e); // NOTE: бектрейс экшена пользователям не нужен
  throw new Error(errorText);
}
