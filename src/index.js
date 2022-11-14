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
import {
  getCourseData, getFullImageName, getFilesData, getAssignmentContents,
} from './utils.js';

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

  let passed = false;
  let exception = null;

  try {
    core.info(colors.yellow(`${taskToAction[task]} assignment "${assignmentName}" started.`));
    await exec(
      `docker compose -f docker-compose.yml run --rm -v ${assignmentPath}:${assignmentDistPath} project make ${task}-current ASSIGNMENT=${lessonName}`,
      null,
      { cwd: coursePath, listeners },
    );
    passed = true;
    core.info(colors.green(`${taskToAction[task]} assignment "${assignmentName}" completed successfully.`));
  } catch (e) {
    exception = e;
    core.info(colors.red(`${taskToAction[task]} assignment "${assignmentName}" completed with errors.`));
  }

  core.info('─'.repeat(40));

  return { output: outputParts.join(''), passed, exception };
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
  const testData = await runTesting(options);
  const lintData = await runLinting(options);

  return { testData, lintData };
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
  core.saveState('checkState', 'fail');

  await prepareCourseDirectory({ verbose, coursePath, imageName });
  const filesData = await getFilesData(coursePath, lessonSlug);
  core.saveState('filesData', JSON.stringify(filesData));
  core.saveState('assignmentPath', assignmentPath);

  const checkData = await checkAssignment({ assignmentPath, coursePath });
  core.saveState('checkData', JSON.stringify(checkData));

  const { testData } = checkData;
  // NOTE: важен только результат запуска тестов. Проверка линтером не должна вызывать ошибку.
  if (!testData.passed) {
    throw testData.exception;
  }

  core.saveState('checkState', 'success');
};

export const runPostActions = async ({ hexletToken }) => {
  const checkDataContent = core.getState('checkData');

  // NOTE: в таком случае экшн отработал с непредвиденными ошибками до запуска тестов
  // дальнейшая нормальная работа экшна невозможна
  if (_.isEmpty(checkDataContent)) {
    core.info(colors.cyan('The assignment checking hasn\'t started. No data to send.'));
    return;
  }

  const checkCreatePath = core.getState('checkCreatePath');
  const checkState = core.getState('checkState');
  const filesData = JSON.parse(core.getState('filesData'));
  const assignmentPath = core.getState('assignmentPath');

  const checkData = JSON.parse(checkDataContent);
  const assignmentContents = await getAssignmentContents(assignmentPath, filesData);

  const http = new HttpClient();
  const headers = { 'X-Auth-Key': hexletToken };
  const body = { check: { ...checkData, ...assignmentContents, state: checkState } };
  const response = await http.postJson(checkCreatePath, body, headers);

  // NOTE: любые ответы которые не вызвали падение клиента и не являются успешными - неизвестные
  if (response.statusCode !== 201) {
    const responseData = JSON.stringify(response, null, 2);
    throw new Error(`An unrecognized connection error has occurred. Please report to support.\n${responseData}`);
  }

  core.info(colors.cyan('The result of the assignment checking has submitted successfully.'));
};
