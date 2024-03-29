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

const runPostActions = (env = {}) => (
  exec('node bin/run-post-actions.js', null, { cwd: projectSourcePath, env })
);

const runTests = (env = {}) => (
  exec('node bin/run-tests.js', null, { cwd: projectSourcePath, env })
);

let currentDataPath;
let env;

beforeAll(() => {
  nock.disableNetConnect();
});

afterAll(() => {
  nock.enableNetConnect();
});

beforeEach(async () => {
  const tmpDirPath = await fsp.mkdtemp(path.join(os.tmpdir(), 'course-'));
  const projectPath = path.join(tmpDirPath, 'project');
  currentDataPath = path.join(projectPath, '.current.json');

  env = {
    INPUT_VERBOSE: true,
    INPUT_HEXLET_TOKEN: 'some-token',
    ACTION_API_HOST: 'localhost:3000',
    PATH: process.env.PATH,
    INPUT_MOUNT_PATH: tmpDirPath,
    ACTION_PROJECT_PATH: projectPath,
  };

  await fse.copy(projectSourcePath, projectPath, {
    filter: filterCopyDirs,
  });
});

describe('run-tests assignment', () => {
  it('right solution', async () => {
    await fse.writeJSON(currentDataPath, {
      assignment: 'hexlet-course-source-ci/basics',
    });

    await expect(runTests(env)).resolves.not.toThrow();
  }, 50000);

  it('wrong solution', async () => {
    await fse.writeJSON(currentDataPath, {
      assignment: 'hexlet-course-source-ci/first-program',
    });

    await expect(runTests(env)).rejects.toThrow();
  }, 50000);

  it('incorrect path in .current.json', async () => {
    await fse.writeJSON(currentDataPath, {
      assignment: 'wrong-course/wrong-assignment',
    });

    await expect(runTests(env)).rejects.toThrow();
  }, 50000);
});

describe('run-post-actions', () => {
  const checkCreatePath = 'http://localhost:3000/api_internal/courses/hexlet-course-source-ci/lessons/basics/assignment/check';
  const checkData = {
    testData: { passed: true, output: 'some testing output', exception: null },
    lintData: { passed: false, output: 'some linting output', exception: new Error('linting failed') },
  };
  const assignmentRelativePath = 'hexlet-course-source-ci/basics';
  const filesData = {
    sourceFiles: ['src/main/java/exercise/App.java'],
    testFiles: ['src/test/java/exercise/AppTest.java'],
  };

  it('success test state', async () => {
    const states = {
      STATE_checkCreatePath: checkCreatePath,
      STATE_checkState: 'success',
      STATE_checkData: JSON.stringify(checkData),
      STATE_assignmentPath: path.join(env.ACTION_PROJECT_PATH, assignmentRelativePath),
      STATE_filesData: JSON.stringify(filesData),
    };

    await expect(runPostActions({ ...env, ...states })).resolves.not.toThrow();
  });

  it('fail test state', async () => {
    const states = {
      STATE_checkCreatePath: checkCreatePath,
      STATE_checkState: 'fail',
      STATE_checkData: JSON.stringify(checkData),
      STATE_assignmentPath: path.join(env.ACTION_PROJECT_PATH, assignmentRelativePath),
      STATE_filesData: JSON.stringify(filesData),
    };

    await expect(runPostActions({ ...env, ...states })).resolves.not.toThrow();
  });

  it('incorrect test state', async () => {
    const states = {
      STATE_checkCreatePath: checkCreatePath,
      STATE_checkState: 'invalid',
      STATE_checkData: JSON.stringify(checkData),
      STATE_assignmentPath: path.join(env.ACTION_PROJECT_PATH, assignmentRelativePath),
      STATE_filesData: JSON.stringify(filesData),
    };

    await expect(runPostActions({ ...env, ...states })).rejects.toThrow();
  });

  it('previous stage failed before testing', async () => {
    const states = {
      STATE_checkCreatePath: checkCreatePath,
      STATE_checkState: 'fail',
      STATE_assignmentPath: path.join(env.ACTION_PROJECT_PATH, assignmentRelativePath),
      STATE_filesData: JSON.stringify(filesData),
    };

    await expect(runPostActions({ ...env, ...states })).resolves.not.toThrow();
  });
});
