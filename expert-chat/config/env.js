/**
 * config/env.js
 * ---------------------------------------------------------------------------
 * Single source of truth for this service's configuration.
 *
 * The production Render URLs used to be hardcoded across server.js and the
 * controllers, which is why the service could not run anywhere else. Every
 * value here is environment-driven with a local-development default.
 */

require('dotenv').config();

const PORT = parseInt(process.env.PORT || '5000', 10);

// Where the chat React app is served from. Used for CORS and for building
// user-facing links that the hub hands to students.
const CLIENT_URL = (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '');

// This service's own public base URL, used to build absolute file-upload links.
const SERVER_URL = (process.env.SERVER_URL || `http://localhost:${PORT}`).replace(/\/$/, '');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/scholarsync_chat';

// No insecure fallback: a JWT secret baked into the repo is not a secret.
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '30d';

const NODE_ENV = process.env.NODE_ENV || 'development';

/** Fail fast at boot rather than signing tokens with a public secret. */
function assertConfig() {
  if (!JWT_SECRET) {
    throw new Error(
      'JWT_SECRET is not set. Generate one with `openssl rand -hex 32` ' +
      'and add it to backend/.env (see .env.example).'
    );
  }
}

module.exports = {
  PORT,
  CLIENT_URL,
  SERVER_URL,
  MONGO_URI,
  JWT_SECRET,
  JWT_EXPIRES_IN,
  NODE_ENV,
  assertConfig,
};
