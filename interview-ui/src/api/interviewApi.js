/**
 * api/interviewApi.js
 * ---------------------------------------------------------------------------
 * Every backend call the interview UI makes, in one place.
 *
 * Pages previously built URLs inline with axios, which spread the base URL and
 * the request shapes across five files. Each function here returns response
 * data directly, so pages deal in values rather than HTTP.
 */

import axios from 'axios';

import { API_BASE } from '../config';

const client = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

/** Unwrap an axios response to its payload. */
const data = (res) => res.data;

// ── Problems and topics ──

export const fetchProblem = (problemId) =>
  client.get(`/problem/${problemId}`).then(data);

export const fetchTopics = () =>
  client.get('/questions/topics').then(data);

export const fetchQuestionsByTopic = (topicSlug) =>
  client.get(`/questions/${topicSlug}`).then(data);

// ── Interviewer AI ──

export const requestWelcome = ({ problemId, code = '' }) =>
  client.post('/ai/welcome', { code, problemId }).then(data);

/**
 * Ask the interviewer for a nudge, a hint, or a final evaluation.
 * `kind` is one of 'periodic' | 'hint' | 'evaluation'.
 */
export const requestAnalysis = (kind, payload) =>
  client.post(`/ai/${kind}`, payload).then(data);

export const sendChatMessage = (payload) =>
  client.post('/ai/chat', payload).then(data);

// ── Code execution and session sync ──

/**
 * Compile and run the candidate's submission.
 * `language` is stated explicitly so the backend never has to guess from the
 * source text ('cpp' | 'python').
 */
export const runCode = ({ code, input, language = 'cpp' }) =>
  client.post('/run', { code, input, language }).then(data);

export const syncCode = (payload) =>
  client.post('/update_code', payload).then(data);

// ── Results ──

export const fetchSessionAnalysis = (sessionId) =>
  client.get(`/session/${sessionId}/analysis`).then(data);

export const fetchCandidateHistory = (params) =>
  client.get('/candidate/history', { params }).then(data);

// ── Resume ──

export const parseResume = ({ file, sessionId, userId }) => {
  const form = new FormData();
  form.append('file', file);
  if (sessionId) form.append('session_id', sessionId);
  if (userId) form.append('user_id', userId);

  // Let the browser set the multipart boundary.
  return client
    .post('/ai/parse_resume', form, { headers: { 'Content-Type': undefined } })
    .then(data);
};

export default client;
