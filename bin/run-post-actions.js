#!/usr/bin/env node

import core from '@actions/core';
import cleanStack from 'clean-stack';

import { runPostActions } from '../src/index.js';

const verbose = core.getBooleanInput('verbose', { required: false });
const hexletToken = core.getInput('hexlet_token', { required: true });

const params = {
  hexletToken,
};

try {
  await runPostActions(params);
} catch (e) {
  // NOTE: бектрейс экшена пользователям не нужен
  if (!verbose) {
    e.stack = cleanStack(e.stack);
  }
  throw e;
}
