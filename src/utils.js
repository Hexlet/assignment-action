// @ts-check

import _ from 'lodash';
import StackTracey from 'stacktracey';

const availableLocales = ['ru'];

export const buildErrorText = (e) => {
  const stack = new StackTracey(e);
  const { message } = e;
  const traceLine = _.head(stack.items).beforeParse;
  return `${message}\n${traceLine}`;
};

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
