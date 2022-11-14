// @ts-check

import _ from 'lodash';
// eslint-disable-next-line
import Ajv from 'ajv';

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

const checkSchema = {
  type: 'object',
  properties: {
    state: { enum: ['fail', 'success'] },
    testData: {
      type: 'object',
      properties: {
        passed: { type: 'boolean' },
        output: { type: 'string', minLength: 1 },
        exception: { type: 'object', nullable: true },
      },
      required: ['passed', 'output', 'exception'],
      additionalProperties: false,
    },
    lintData: {
      type: 'object',
      properties: {
        passed: { type: 'boolean' },
        output: { type: 'string', minLength: 1 },
        exception: { type: 'object', nullable: true },
      },
      required: ['passed', 'output', 'exception'],
      additionalProperties: false,
    },
  },
  required: ['state', 'testData', 'lintData'],
  additionalProperties: false,
};

// eslint-disable-next-line
export default async (fastify, _options) => {
  fastify
    .post('/api_internal/courses/:courseSlug/lessons/:lessonSlug/assignment/check/validate', async (req, reply) => {
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
    .post('/api_internal/courses/:courseSlug/lessons/:lessonSlug/assignment/check', async (req, reply) => {
      const { check } = req.body;

      const ajv = new Ajv();
      const validate = ajv.compile(checkSchema);

      if (!validate(check)) {
        reply.code(422);
        return { message: 'Invalid check schema. Please report to support.' };
      }

      reply.code(201);
      return { message: 'OK' };
    });
};
