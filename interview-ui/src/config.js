/**
 * config.js
 * ---------------------------------------------------------------------------
 * Single source of truth for the API base URL.
 *
 * Every page used to declare its own `API_URL` constant, and the fallbacks had
 * drifted apart: three pages defaulted to a deleted Azure Container Apps host
 * and three to `http://localhost:8000` — which was itself wrong, because the
 * call sites omit the `/api` segment.
 *
 * The interview backend is now mounted into the main ScholarSync hub under
 * `/interview`, so the base must include that prefix and the `/api` segment:
 *
 *     http://localhost:8000/interview/api
 */

const DEFAULT_API_BASE = 'http://localhost:8000/interview/api';

export const API_BASE = (process.env.REACT_APP_API_URL || DEFAULT_API_BASE).replace(/\/$/, '');

export default API_BASE;
