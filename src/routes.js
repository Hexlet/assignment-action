// @ts-check

const buildUrl = (part, apiUrl, baseUrl) => {
  const urlPath = `${apiUrl}/${part}`;
  const url = new URL(urlPath, baseUrl);
  return url.toString();
};

const buildBaseUrl = (locale, host) => {
  const [hostname] = host.split(':');
  const protocol = hostname === 'localhost' ? 'http' : 'https';
  const hostPrefix = locale === 'en' ? '' : `${locale}.`;
  return `${protocol}://${hostPrefix}${host}`;
};

const buildRoutes = (courseSlug, lessonSlug, locale, host = 'hexlet.io') => {
  const baseUrl = buildBaseUrl(locale, host);
  const apiUrl = `/api_internal/courses/${courseSlug}/lessons/${lessonSlug}/assignment`;

  return {
    checkValidatePath: buildUrl('check/validate', apiUrl, baseUrl),
    checkCreatePath: buildUrl('check', apiUrl, baseUrl),
  };
};

export default buildRoutes;
