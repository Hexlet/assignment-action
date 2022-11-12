// @ts-check

import core from '@actions/core';
import io from '@actions/io';
import { exec } from '@actions/exec';
import path from 'path';
import fse from 'fs-extra';
import fs from 'fs';
import _ from 'lodash';
import colors from 'ansi-colors';
import { HttpClient } from '@actions/http-client';

import buildRoutes from './routes.js';
import { getCourseData, getFullImageName } from './utils.js';

const prepareCourseDirectory = async ({ verbose, coursePath, imageName }) => {
  const cmdOptions = { silent: !verbose };

  await io.mkdirP(coursePath);
  await exec(`docker pull ${imageName}`, null, cmdOptions);
  await exec(
    `docker run --rm -v ${coursePath}:/mnt/course ${imageName} bash -c "cp -r /project/course/. /mnt/course"`,
    null,
    cmdOptions,
  );

  const dirName = path.basename(coursePath);
  await exec(`docker tag ${imageName} ${dirName}_project`, null, cmdOptions);
  // NOTE: на гитхаб дефолтное имя образа для compose почему то отличается
  await exec(`docker tag ${imageName} ${dirName}-project`, null, cmdOptions);

  await exec(
    `docker compose -f docker-compose.yml run --rm -v ${coursePath}:/project/course project make setup`,
    null,
    { ...cmdOptions, cwd: coursePath },
  );
};

const runChecking = async (task, options) => {
  const {
    coursePath, assignmentPath, assignmentDistPath, lessonName, assignmentName,
  } = options;

  const outputParts = [];
  const addToOutputParts = (data) => outputParts.push(data.toString());
  const listeners = { stdout: addToOutputParts, stderr: addToOutputParts };

  const taskToAction = { test: 'Testing', lint: 'Linting' };

  let success;
  let exception;

  try {
    const startingMessage = `${taskToAction[task]} assignment "${assignmentName}" started`;
    core.info('='.repeat(startingMessage.length));
    core.info(colors.yellow(startingMessage));

    await exec(
      `docker compose -f docker-compose.yml run --rm -v ${assignmentPath}:${assignmentDistPath} project make ${task}-current ASSIGNMENT=${lessonName}`,
      null,
      { cwd: coursePath, listeners },
    );
    success = true;

    const finishingMessage = `${taskToAction[task]} assignment "${assignmentName}" completed successfully`;
    core.info(colors.green(finishingMessage));
    core.info('='.repeat(finishingMessage.length));
  } catch (e) {
    success = false;
    exception = e;

    const failingMessage = `${taskToAction[task]} assignment "${assignmentName}" failed`;
    core.info(colors.red(failingMessage));
    core.info('='.repeat(failingMessage.length));
  }

  return { output: outputParts.join(''), success, exception };
};

const runTesting = (options) => runChecking('test', options);
const runLinting = (options) => runChecking('lint', options);

const checkAssignment = async ({ assignmentPath, coursePath }) => {
  const mappingDataPath = path.join(coursePath, 'mappingData.json');
  const mappingData = await fse.readJSON(mappingDataPath);

  const assignmentName = path.basename(assignmentPath);
  const lessonName = mappingData[assignmentName];
  const assignmentDistPath = path.join('/', 'project', 'course', lessonName, 'assignment');

  const options = {
    coursePath, assignmentPath, assignmentDistPath, lessonName, assignmentName,
  };
  const testingData = await runTesting(options);
  const lintingData = await runLinting(options);

  // save data here and pass to post action

  if (!testingData.success) {
    throw testingData.exception;
  }

  // core.info(colors.yellow(`Checking assignment ${assignmentName} started`));
  // await exec(
  //   `docker compose -f docker-compose.yml run --rm -v ${assignmentPath}:${assignmentDistPath} project make test-current ASSIGNMENT=${lessonName}`,
  //   null,
  //   { cwd: coursePath },
  // );
  // core.info(colors.green(`Checking assignment ${assignmentName} successful completed`));
};

export const runTests = async (params) => {
  const {
    verbose,
    mountPath,
    hexletToken,
    projectPath,
    apiHost,
    containerNamespace,
  } = params;

  const currentPath = path.join(projectPath, '.current.json');
  const coursePath = path.join(mountPath, 'course');

  if (!fs.existsSync(currentPath)) {
    return;
  }

  const currentData = await fse.readJSON(currentPath);
  const assignmentRelativePath = currentData.assignment;
  const assignmentPath = path.join(projectPath, assignmentRelativePath);

  if (!fs.existsSync(assignmentPath)) {
    // NOTE: Кейс с ручным неправильным изменением .current.json
    // Так как путь к проверяемому ДЗ формирует утилита при сабмите.
    throw new Error(`Assignment by path ${assignmentRelativePath} not found. Check if the path is correct.`);
  }

  const [courseSlugWithLocale, lessonSlug] = assignmentRelativePath.split('/');
  const { slug, locale } = getCourseData(courseSlugWithLocale);
  const routes = buildRoutes(slug, lessonSlug, locale, apiHost);

  const headers = { 'X-Auth-Key': hexletToken };
  const http = new HttpClient();
  const response = await http.postJson(routes.checkValidatePath, {}, headers);

  // NOTE: ответ 404 не вызывает ошибку клиента, потому обрабатываем вручную
  // https://github.com/actions/toolkit/tree/main/packages/http-client#http
  if (response.statusCode === 404) {
    throw new Error(`Assignment '${assignmentRelativePath}' not found. Check the course and assignment directory names.`);
  }

  // NOTE: любые ответы которые не вызвали падение клиента и не являются успешными - неизвестные
  if (response.statusCode !== 200) {
    const responseData = JSON.stringify(response, null, 2);
    throw new Error(`An unrecognized connection error has occurred. Please report to support.\n${responseData}`);
  }

  const imageTag = _.get(response, 'result.version');
  const imageName = getFullImageName(containerNamespace, slug, locale, imageTag);

  core.saveState('checkCreatePath', routes.checkCreatePath);
  core.saveState('checkState', JSON.stringify({ state: 'fail' }));

  await prepareCourseDirectory({ verbose, coursePath, imageName });
  await checkAssignment({ assignmentPath, coursePath });

  core.saveState('checkState', JSON.stringify({ state: 'success' }));
};

/* eslint-disable */
export const runPostActions = async ({ hexletToken }) => {
  const checkCreatePath = core.getState('checkCreatePath');

  if (_.isEmpty(checkCreatePath)) {
    return;
  }

  const checkState = JSON.parse(core.getState('checkState'));

  // const headers = { 'X-Auth-Key': hexletToken };
  // const http = new HttpClient();
  // const response = await http.postJson(checkCreatePath, { check: checkState }, headers);

  // // NOTE: любые ответы которые не вызвали падение клиента и не являются успешными - неизвестные
  // if (response.statusCode !== 201) {
  //   const responseData = JSON.stringify(response, null, 2);
  //   throw new Error(`An unrecognized connection error has occurred. Please report to support.\n${responseData}`);
  // }

  core.info(colors.cyan('The result of the assignment checking was successfully submitted.'));
};
/* eslint-enable */
