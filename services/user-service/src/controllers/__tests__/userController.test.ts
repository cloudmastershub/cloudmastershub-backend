/**
 * Tests for the user-service controllers that talk to course-service over
 * the internal network.
 *
 * Bug #2 (Apr 23 manual QA — "enrollment exists but /users/courses empty"):
 *   - `getUserCourses` used to hit ${courseServiceUrl}/user/:id/courses, but
 *     the course-service route is mounted under /courses, so the real path
 *     is /courses/user/:id/courses. The axios call 404'd, the catch block
 *     silently returned { data: [] }, and every enrolled user saw the
 *     "No Courses Yet" empty state.
 *   - Double fault: the catch's fallback to an empty-success shape masked
 *     ALL upstream errors (5xx, network, timeouts) as "no enrollments",
 *     hiding real failures indefinitely. Now returns 503 for upstream
 *     failures so the frontend can show a retry affordance.
 */

import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { getUserCourses } from '../userController';

jest.mock('axios');
jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('getUserCourses — Bug #2 regressions', () => {
  let req: any;
  let res: any;
  let next: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn().mockReturnThis();
    statusMock = jest.fn().mockReturnThis();
    res = { json: jsonMock, status: statusMock };
    req = { userId: 'user-abc-123' };
    next = jest.fn();
    mockedAxios.get.mockReset();
    // Scope the test envvar so assertions can match it deterministically.
    process.env.COURSE_SERVICE_URL = 'http://course-service:3002';
  });

  it('hits the correct course-service path under /courses (regression: used to be bare /user/...)', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { success: true, data: [] } });

    await getUserCourses(req as Request, res as Response, next);

    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    const url = mockedAxios.get.mock.calls[0][0];
    // MUST include /courses/user/<id>/courses. The bug URL was missing the
    // leading /courses mount prefix.
    expect(url).toBe('http://course-service:3002/courses/user/user-abc-123/courses');
    // Negative assertion guard against regressing to the bare `/user/<id>/...`
    // mount — i.e. no `host/user/...` path. (The FIXED URL ends with
    // `/user/<id>/courses` too, so we anchor on the host here, not the tail.)
    expect(url).not.toMatch(/^http:\/\/course-service:3002\/user\//);
  });

  it('forwards x-user-id and x-internal-service headers on the upstream call', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { success: true, data: [] } });

    await getUserCourses(req as Request, res as Response, next);

    const config = mockedAxios.get.mock.calls[0][1] as any;
    expect(config.headers['x-user-id']).toBe('user-abc-123');
    expect(config.headers['x-internal-service']).toBe('true');
  });

  it('passes through upstream enrollments to the response', async () => {
    const enrollments = [
      { id: 'c1', title: 'Docker', progress: 25 },
      { id: 'c2', title: 'Kubernetes', progress: 0 },
    ];
    mockedAxios.get.mockResolvedValueOnce({
      data: { success: true, data: enrollments },
    });

    await getUserCourses(req as Request, res as Response, next);

    expect(jsonMock).toHaveBeenCalledWith({
      success: true,
      data: enrollments,
    });
  });

  it('does NOT silently return empty data on upstream network failure (regression)', async () => {
    // Before the fix: this threw "Network Error" and the catch returned
    // { success: true, data: [] }. The enrolled user saw "No Courses Yet".
    mockedAxios.get.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    await getUserCourses(req as Request, res as Response, next);

    expect(statusMock).toHaveBeenCalledWith(503);
    const body = jsonMock.mock.calls[0][0];
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe('COURSES_UPSTREAM_FAILURE');
    // Critical: we are NOT shipping data: [] on failure.
    expect(body.data).toBeUndefined();
  });

  it('returns 503 for upstream 5xx (degraded, not empty)', async () => {
    const error: any = new Error('Request failed with status code 500');
    error.response = { status: 500, data: { message: 'upstream broke' } };
    mockedAxios.get.mockRejectedValueOnce(error);

    await getUserCourses(req as Request, res as Response, next);

    expect(statusMock).toHaveBeenCalledWith(503);
    const body = jsonMock.mock.calls[0][0];
    expect(body.success).toBe(false);
  });

  it('passes through upstream 4xx status to the caller (client-side fix is different)', async () => {
    // If the course-service explicitly 404s a user id we forwarded, that's
    // signal the caller's id is unknown; propagate it rather than faking a
    // 503. Lets the frontend handle "unknown user" distinctly if needed.
    const error: any = new Error('Request failed with status code 404');
    error.response = { status: 404, data: { message: 'not found' } };
    mockedAxios.get.mockRejectedValueOnce(error);

    await getUserCourses(req as Request, res as Response, next);

    expect(statusMock).toHaveBeenCalledWith(404);
  });

  it('400s when there is no authenticated userId on the request', async () => {
    req = {}; // no userId

    await getUserCourses(req as Request, res as Response, next);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });
});
