// @ts-check

import _ from 'lodash';

const userTokens = ['some_token'];

const latestCourseVersions = {
  'hexlet-course-source-ci': {
    basics: 'release',
    'first-program': 'release',
    'not-started': 'release',
  },
};

const memberCourseVersions = {
  'hexlet-course-source-ci': {
    basics: 'release',
    'first-program': 'release',
  },
};

// eslint-disable-next-line
export default async (fastify, _options) => {
  fastify.post('/api/course/:courseSlug/lesson/:lessonSlug/assignment/check/validate', async (req, reply) => {
    const { courseSlug, lessonSlug } = req.params;
    const token = req.headers['x-auth-key'];

    if (!userTokens.includes(token)) {
      reply.code(401);
      return { message: 'Invalid token passed.' };
    }

    const memberCourseVersion = _.get(memberCourseVersions, [courseSlug, lessonSlug]);
    const latestCourseVersion = _.get(latestCourseVersions, [courseSlug, lessonSlug]);

    console.log(req.headers);

    if (!memberCourseVersion && !latestCourseVersion) {
      reply.code(404);
      return { message: 'Assignment not found. Check the course and assignment directory names.' };
    }

    if (!memberCourseVersion) {
      reply.code(404);
      return { message: 'You haven\'t started your assignment yet' };
    }

    return { version: memberCourseVersion };
  });
};
