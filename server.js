// @ts-check

import _ from 'lodash';

const userTokens = ['some-token'];

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
  fastify
    .post('/api_internal/course/:courseSlug/lesson/:lessonSlug/assignment/check/validate', async (req, reply) => {
      const { courseSlug, lessonSlug } = req.params;
      const token = req.headers['x-auth-key'];

      if (!userTokens.includes(token)) {
        reply.code(401);
        return { message: 'Invalid token passed.' };
      }

      const memberCourseVersion = _.get(memberCourseVersions, [courseSlug, lessonSlug]);
      const latestCourseVersion = _.get(latestCourseVersions, [courseSlug, lessonSlug]);

      if (!memberCourseVersion && !latestCourseVersion) {
        reply.code(404);
        return { message: 'Assignment not found.' };
      }

      if (!memberCourseVersion) {
        reply.code(422);
        return { message: 'You haven\'t started your assignment yet' };
      }

      return { version: memberCourseVersion };
    })
    .post('/api_internal/course/:courseSlug/lesson/:lessonSlug/assignment/check', async (req, reply) => {
      const { check } = req.body;
      const { state } = check;

      if (state !== 'fail' && state !== 'success') {
        reply.code(422);
        return { message: 'Invalid check state value. Please report to support.' };
      }

      reply.code(201);
      return { message: 'OK' };
    });
};
