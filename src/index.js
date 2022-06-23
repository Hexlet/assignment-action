// @ts-check

import core from '@actions/core';
import io from '@actions/io';
import exec from '@actions/exec';
import path from 'path';
import fse from 'fs-extra';
import fs from 'fs';
import StackTracey from 'stacktracey';
import _ from 'lodash';
import colors from 'ansi-colors';

export const buildErrorText = (e) => {
  const stack = new StackTracey(e);
  const message = e.message;
  const traceLine = _.head(stack.items).beforeParse;
  return `${message}\n${traceLine}`;
};

const prepareCourseDirectory = async ({ verbose, coursePath, imageName }) => {
  const cmdOptions = { silent: !verbose };

  await io.mkdirP(coursePath);
  await exec.exec(`docker pull ${imageName}`, null, cmdOptions);
  await exec.exec(
    `docker run -v ${coursePath}:/mnt/course ${imageName} bash -c "cp -r /course/. /mnt/course"`,
    null,
    cmdOptions,
  );

  const composeImageName = `${path.basename(coursePath)}_course`;
  await exec.exec(`docker tag ${imageName} ${composeImageName}`, null, cmdOptions);

  await exec.exec(
    `docker compose -f docker-compose.yml run -v ${coursePath}:/course course make setup`,
    null,
    { cwd: coursePath },
  );
};

const checkAssignment = async ({ assignmentPath, coursePath }) => {
  const mappingDataPath = path.join(coursePath, 'mappingData.json');
  const mappingData = await fse.readJSON(mappingDataPath);

  const assignmentName = path.basename(assignmentPath);
  const lessonName = mappingData[assignmentName];
  const assignmentDistPath = path.join('/', 'course', lessonName, 'assignment');

  core.info(colors.yellow(`Checking assignment ${assignmentName} started`));
  await exec.exec(
    `docker compose -f docker-compose.yml run -v ${assignmentPath}:${assignmentDistPath} course make check-current ASSIGNMENT=${lessonName}`,
    null,
    { cwd: coursePath },
  );
  core.info(colors.green(`Checking assignment ${assignmentName} successful completed`));
};

export const runTests = async (params) => {
  const { verbose, mountPath, projectPath } = params;

  const currentPath = path.join(projectPath, '.current.json');
  const coursePath = path.join(mountPath, 'course');

  if (!fs.existsSync(currentPath)) {
    return;
  }

  const currentData = await fse.readJSON(currentPath);
  const assignmentRelativePath = currentData.assignment;
  const assignmentPath = path.join(projectPath, assignmentRelativePath);

  if (!fs.existsSync(assignmentPath)) {
    // ошибка с понятным текстом, что нет домашки в репе
    return;
  }

  // запрос на апи: проверка возможности тестирования, получение версии образа 
  const imageName = `hexletprograms/hexlet-course-source-ci:release`;

  await prepareCourseDirectory({ verbose, coursePath, imageName });
  await checkAssignment({ assignmentPath, coursePath });
};
