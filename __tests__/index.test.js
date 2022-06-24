// @ts-check

import nock from 'nock';
import fsp from 'fs/promises';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { exec } from '@actions/exec';
import fse from 'fs-extra';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectSourcePath = path.join(__dirname, '..');
const serviceDirPaths = ['tmp', 'node_modules']
  .map((name) => path.join(projectSourcePath, name));
const filterCopyDirs = (src) => !serviceDirPaths.includes(src);

let currentDataPath;
let runTests;

beforeAll(() => {
  nock.disableNetConnect();
});

beforeEach(async () => {
  const tmpDirPath = await fsp.mkdtemp(path.join(os.tmpdir(), 'course-'));
  const projectPath = path.join(tmpDirPath, 'project');
  currentDataPath = path.join(projectPath, '.current.json');

  runTests = () => (
    exec('node bin/run-tests.js', null, {
      cwd: projectSourcePath,
      env: {
        INPUT_VERBOSE: true,
        INPUT_MOUNT_PATH: tmpDirPath,
        ACTION_PROJECT_PATH: projectPath,
        PATH: process.env.PATH,
      },
    })
  );

  await fse.copy(projectSourcePath, projectPath, {
    filter: filterCopyDirs,
  });
});

it('run-tests assignment with right solution', async () => {
  await fse.writeJSON(currentDataPath, {
    assignment: 'hexlet-course-source-ci/basics',
  });

  await expect(runTests()).resolves.not.toThrow();
}, 50000);

it('run-tests assignment with wrong solution', async () => {
  await fse.writeJSON(currentDataPath, {
    assignment: 'hexlet-course-source-ci/first-program',
  });

  await expect(runTests()).rejects.toThrow();
}, 50000);

it('run-tests assignment with incorrect path in .current.json', async () => {
  await fse.writeJSON(currentDataPath, {
    assignment: 'wrong-course/wrong-assignment',
  });

  await expect(runTests()).rejects.toThrow();
}, 50000);
