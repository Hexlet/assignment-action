// @ts-check

import core from '@actions/core';
import io from '@actions/io';
import { exec } from '@actions/exec';
import path from 'path';
import fse from 'fs-extra';
import fs from 'fs';
import StackTracey from 'stacktracey';
import _ from 'lodash';
import colors from 'ansi-colors';
import { HttpClient } from '@actions/http-client';

import buildRoutes from './routes.js';

export const buildErrorText = (e) => {
  const stack = new StackTracey(e);
  const { message } = e;
  const traceLine = _.head(stack.items).beforeParse;
  return `${message}\n${traceLine}`;
};

const getCourseData = (slugWithLocale) => {
  const availableLocales = ['ru'];

  const slugParts = slugWithLocale.split('-');
  const lastSlugPart = _.last(slugParts);

  if (!availableLocales.includes(lastSlugPart)) {
    return { locale: '', slug: slugWithLocale };
  }

  const replaceRegExp = new RegExp(`-${lastSlugPart}$`);
  return {
    locale: lastSlugPart,
    slug: slugWithLocale.replace(replaceRegExp, ''),
  };
};

const prepareCourseDirectory = async ({ verbose, coursePath, imageName }) => {
  const cmdOptions = { silent: !verbose };

  await io.mkdirP(coursePath);
  await exec(`docker pull ${imageName}`, null, cmdOptions);
  await exec(
    `docker run -v ${coursePath}:/mnt/course ${imageName} bash -c "cp -r /course/. /mnt/course"`,
    null,
    cmdOptions,
  );

  const composeImageName = `${path.basename(coursePath)}_course`;
  await exec(`docker tag ${imageName} ${composeImageName}`, null, cmdOptions);

  await exec(
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
  await exec(
    `docker compose -f docker-compose.yml run -v ${assignmentPath}:${assignmentDistPath} course make check-current ASSIGNMENT=${lessonName}`,
    null,
    { cwd: coursePath },
  );
  core.info(colors.green(`Checking assignment ${assignmentName} successful completed`));
};

export const runTests = async (params) => {
  const {
    verbose,
    mountPath,
    hexletToken,
    projectPath,
    apiHost,
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
  const courseData = getCourseData(courseSlugWithLocale);
  const routes = buildRoutes(courseData.slug, lessonSlug, courseData.locale, apiHost);

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
  const imageName = `hexletprograms/${courseSlugWithLocale}:${imageTag}`;

  core.exportVariable('checkCreatePath', routes.checkCreatePath);
  core.exportVariable('checkState', JSON.stringify({ state: 'fail' }));

  await prepareCourseDirectory({ verbose, coursePath, imageName });
  await checkAssignment({ assignmentPath, coursePath });

  core.exportVariable('checkState', JSON.stringify({ state: 'success' }));
};

export const runPostActions = async ({ hexletToken }) => {
  const { checkCreatePath, checkState } = process.env;

  if (!checkCreatePath) {
    return;
  }

  const headers = { 'X-Auth-Key': hexletToken };
  const http = new HttpClient();
  const response = await http.postJson(checkCreatePath, { check: checkState }, headers);

  // NOTE: любые ответы которые не вызвали падение клиента и не являются успешными - неизвестные
  if (response.statusCode !== 201) {
    const responseData = JSON.stringify(response, null, 2);
    throw new Error(`An unrecognized connection error has occurred. Please report to support.\n${responseData}`);
  }
};
