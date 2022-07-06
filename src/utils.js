// @ts-check

import _ from 'lodash';

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
