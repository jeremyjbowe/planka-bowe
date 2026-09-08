/**
 * Thin fetch wrapper around the DTP Tasks (Planka fork) REST API.
 *
 * Auth modes, in order of preference:
 *   1. API key  - sent as `X-Api-Key`. Stateless, never touches the login
 *      endpoint, and is not subject to the terms-acceptance gate.
 *   2. Password - `POST /api/access-tokens` once per process; the bearer token
 *      is cached in memory for the life of the process (tokens last a year).
 *      There is a rate limiter on that endpoint, so we log in lazily, only
 *      once, and only re-login after a 401.
 *
 * All record ids in Planka are 64-bit snowflakes serialised as strings. They
 * are passed through as strings everywhere; never parse them as numbers.
 */

/** An API error carrying enough detail for the model to act on it. */
export class PlankaError extends Error {
  constructor(message, { status, code, path, method } = {}) {
    super(message);
    this.name = 'PlankaError';
    this.status = status;
    this.code = code;
    this.path = path;
    this.method = method;
  }
}

const TERMS_HELP =
  'The bot account has not accepted this instance\'s end-user terms, so password ' +
  'login is blocked. Fix it either by signing in once as the bot in the web UI ' +
  'and accepting the terms, or by having an admin mint an API key for the bot ' +
  '(POST /api/users/<botUserId>/api-key) and setting PLANKA_API_KEY in the env ' +
  'file instead of the password.';

export class PlankaClient {
  constructor({ baseUrl, apiKey = null, username = null, password = null, log = () => {} }) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
    this.username = username;
    this.password = password;
    this.log = log;

    this.token = null;
    this.loginPromise = null;

    // Short-lived cache for whole-board fetches. `overview` and a boardless
    // `find_cards` both walk every board, and a board payload is expensive.
    this.boardCache = new Map();
    this.boardCacheTtlMs = 5000;
  }

  get usesApiKey() {
    return Boolean(this.apiKey);
  }

  async login() {
    if (this.usesApiKey) {
      return null;
    }

    // Collapse concurrent logins into one request; the endpoint is rate limited.
    if (this.loginPromise) {
      return this.loginPromise;
    }

    this.loginPromise = (async () => {
      const url = `${this.baseUrl}/api/access-tokens`;
      let response;

      try {
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            emailOrUsername: this.username,
            password: this.password,
          }),
        });
      } catch (error) {
        throw new PlankaError(
          `Cannot reach DTP Tasks at ${this.baseUrl}: ${error.message}`,
          { path: '/api/access-tokens', method: 'POST' },
        );
      }

      const body = await safeJson(response);

      if (!response.ok) {
        if (body && body.step === 'accept-terms') {
          throw new PlankaError(`Login refused: terms acceptance required. ${TERMS_HELP}`, {
            status: response.status,
            code: body.code,
            path: '/api/access-tokens',
            method: 'POST',
          });
        }

        if (response.status === 429) {
          throw new PlankaError(
            'Login rate limited by the server. Wait a minute before retrying.',
            { status: 429, path: '/api/access-tokens', method: 'POST' },
          );
        }

        // Never echo the credentials themselves.
        throw new PlankaError(
          `Login failed (HTTP ${response.status}${body?.code ? `, ${body.code}` : ''}). ` +
            'Check PLANKA_USERNAME / PLANKA_PASSWORD in the env file.',
          { status: response.status, code: body?.code, path: '/api/access-tokens', method: 'POST' },
        );
      }

      if (!body || typeof body.item !== 'string') {
        throw new PlankaError('Login succeeded but no access token was returned.', {
          status: response.status,
          path: '/api/access-tokens',
          method: 'POST',
        });
      }

      this.token = body.item;
      this.log('authenticated with DTP Tasks via password login');
      return this.token;
    })();

    try {
      return await this.loginPromise;
    } finally {
      this.loginPromise = null;
    }
  }

  async authHeaders() {
    if (this.usesApiKey) {
      return { 'X-Api-Key': this.apiKey };
    }

    if (!this.token) {
      await this.login();
    }

    return { Authorization: `Bearer ${this.token}` };
  }

  /**
   * Perform an API call. `path` is relative to the server root and must start
   * with `/api/`. Returns the parsed JSON body.
   */
  async request(method, path, body = undefined, { retryOn401 = true } = {}) {
    const url = `${this.baseUrl}${path}`;
    const headers = { Accept: 'application/json', ...(await this.authHeaders()) };

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    let response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (error) {
      throw new PlankaError(`Cannot reach DTP Tasks at ${this.baseUrl}: ${error.message}`, {
        path,
        method,
      });
    }

    if (response.status === 401 && retryOn401 && !this.usesApiKey) {
      // Token expired or its session was revoked - log in again, once.
      this.token = null;
      await this.login();
      return this.request(method, path, body, { retryOn401: false });
    }

    const parsed = await safeJson(response);

    if (!response.ok) {
      throw new PlankaError(describeFailure(response, parsed, method, path), {
        status: response.status,
        code: parsed?.code,
        path,
        method,
      });
    }

    return parsed;
  }

  get(path) {
    return this.request('GET', path);
  }

  post(path, body) {
    return this.request('POST', path, body ?? {});
  }

  patch(path, body) {
    return this.request('PATCH', path, body ?? {});
  }

  delete(path) {
    return this.request('DELETE', path);
  }

  /** `GET /api/boards/:id`, memoised briefly so multi-board tools stay cheap. */
  async getBoard(boardId, { fresh = false } = {}) {
    const now = Date.now();
    const hit = this.boardCache.get(boardId);

    if (!fresh && hit && now - hit.at < this.boardCacheTtlMs) {
      return hit.value;
    }

    const value = await this.get(`/api/boards/${boardId}`);
    this.boardCache.set(boardId, { at: now, value });
    return value;
  }

  invalidateBoard(boardId) {
    if (boardId) {
      this.boardCache.delete(boardId);
    } else {
      this.boardCache.clear();
    }
  }
}

async function safeJson(response) {
  const text = await response.text().catch(() => '');

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 400) };
  }
}

function describeFailure(response, parsed, method, path) {
  const bits = [`${method} ${path} failed with HTTP ${response.status}`];

  if (parsed?.code) {
    bits.push(parsed.code);
  }

  const detail = parsed?.message || parsed?.problems || null;
  if (detail) {
    bits.push(typeof detail === 'string' ? detail : JSON.stringify(detail));
  }

  if (response.status === 404) {
    bits.push(
      '(Planka also answers 404 when the account may not see the record, ' +
        'so this can mean "no access" rather than "does not exist".)',
    );
  }

  if (response.status === 401) {
    bits.push('(Credentials rejected - check PLANKA_API_KEY or the bot username/password.)');
  }

  return bits.join(' - ');
}
