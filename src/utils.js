// @ts-check

import _ from 'lodash';
import fse from 'fs-extra';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';

const availableLocales = ['ru'];

export const getCourseData = (slugWithLocale) => {
  const slugParts = slugWithLocale.split('-');
  const lastSlugPart = _.last(slugParts);
  const locale = availableLocales.includes(lastSlugPart) ? lastSlugPart : 'en';

  const replaceRegExp = new RegExp(`-${locale}$`);
  const slug = slugWithLocale.replace(replaceRegExp, '');

  return { locale, slug };
};

export const getFullImageName = (namespace, slug, locale, tag) => {
  const imageName = availableLocales.includes(locale)
    ? `${namespace}/${slug}-${locale}`
    : `${namespace}/${slug}`;

  return `${imageName}:${tag}`;
};

export const getFilesData = async (coursePath, lessonSlug) => {
  const filesDataPath = path.join(coursePath, 'filesData.json');

  if (!fs.existsSync(filesDataPath)) {
    return { sourceFiles: [], testFiles: [] };
  }

  const filesData = await fse.readJSON(filesDataPath);
  return filesData[lessonSlug];
};

export const getAssignmentContents = async (assignmentPath, filesData) => {
  const getContent = async (filePath) => {
    const fullPath = path.join(assignmentPath, filePath);
    const content = fs.existsSync(fullPath) ? (await fsp.readFile(fullPath)).toString() : '';
    return { [filePath]: content };
  };

  const sourceContents = await Promise.all(filesData.sourceFiles.map(getContent));
  const testContents = await Promise.all(filesData.testFiles.map(getContent));

  return {
    sourceContents: sourceContents.reduce(_.merge, {}),
    testContents: testContents.reduce(_.merge, {}),
  };
};
