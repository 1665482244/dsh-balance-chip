/**
 * Balance-chip host half: exposes the DeepSeek account balance to the web
 * client through one same-origin route. The API key and endpoint resolve
 * exactly like the built-in deepseek provider — the stored `DEEPSEEK_API_KEY`
 * credential (or the ambient environment) against `https://api.deepseek.com`
 * (or a trusted `DEEPSEEK_BASE_URL` launch layer).
 *
 * No external imports on purpose: out-of-tree plugin host halves resolve from
 * their real directory, which sits outside the profile's node_modules walk,
 * so everything reachable comes from the injected services (`webServer`,
 * `credentials`, `launchEnvironment`) instead.
 */

/** Stable Cordis plugin name (also the loader patch entry id). */
export const name = 'ui-balance-chip'
/** Service required before the route can be registered. */
export const inject = ['webServer']

/** Same-origin route the client half polls. */
export const BALANCE_ROUTE = '/api/dsh/balance'
const DEFAULT_API_KEY_ENV = 'DEEPSEEK_API_KEY'
const BASE_URL_ENV = 'DEEPSEEK_BASE_URL'
const PUBLIC_BASE_URL = 'https://api.deepseek.com'
const FETCH_TIMEOUT_MS = 8_000
/** Coalesce concurrent browser polls; the client polls every 15s anyway. */
const CACHE_TTL_MS = 3_000

function json(res, status, body) {
	res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
	res.end(JSON.stringify(body))
}

function sameOrigin(req) {
	if (req.headers['sec-fetch-site'] === 'cross-site') return false
	const origin = req.headers.origin
	if (typeof origin !== 'string' || origin === '' || origin === 'null') return true
	const host = req.headers.host
	if (typeof host !== 'string' || host === '') return false
	try {
		return new URL(origin).host === host
	} catch {
		return false
	}
}

/**
 * Read one launch-environment value, mirroring launchEnvironmentOf(): the
 * launcher's snapshot when present, the process environment otherwise.
 */
function launchValue(ctx, name) {
	const environment = ctx.get('launchEnvironment')
	if (environment !== void 0) {
		const hit = environment.get(name)
		if (hit !== void 0) return hit.value
	}
	return process.env[name]
}

/**
 * Resolve the DeepSeek API key through the same seams as the provider: the
 * credentials service (process env → stored values → fallbacks), or the
 * ambient environment when no credentials service is present.
 */
async function resolveApiKey(ctx, ref) {
	const credentials = ctx.get('credentials')
	if (credentials !== void 0) {
		const hit = await credentials.resolve(ref)
		if (hit !== void 0 && typeof hit.value === 'string' && hit.value !== '') return hit.value
		return void 0
	}
	const ambient = launchValue(ctx, ref)
	return typeof ambient === 'string' && ambient !== '' ? ambient : void 0
}

/** Register the balance route with lifecycle-owned cleanup. */
export function apply(ctx) {
	ctx.effect(() => {
		const baseURL = (launchValue(ctx, BASE_URL_ENV) ?? PUBLIC_BASE_URL).replace(/\/+$/u, '')
		let cache = null

		const route = {
			kind: 'exact',
			path: BALANCE_ROUTE,
			async handler(req, res) {
				if (!sameOrigin(req)) {
					json(res, 403, { ok: false, error: 'cross-site-request-rejected' })
					return
				}
				if (req.method !== 'GET') {
					json(res, 405, { ok: false, error: 'method-not-allowed' })
					return
				}
				if (cache !== null && Date.now() - cache.at < CACHE_TTL_MS) {
					json(res, 200, cache.value)
					return
				}

				let value
				try {
					const apiKey = await resolveApiKey(ctx, DEFAULT_API_KEY_ENV)
					if (apiKey === void 0) {
						value = {
							ok: false,
							error: 'no-credential',
							message: `未配置 ${DEFAULT_API_KEY_ENV} 凭据（请在设置页 Models 中填写）`,
						}
					} else {
						const controller = new AbortController()
						const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
						try {
							const response = await fetch(`${baseURL}/user/balance`, {
								headers: {
									authorization: `Bearer ${apiKey}`,
									accept: 'application/json',
								},
								signal: controller.signal,
							})
							if (response.ok) {
								value = { ok: true, balance: await response.json() }
							} else {
								value = { ok: false, error: `http-${response.status}`, status: response.status }
							}
						} finally {
							clearTimeout(timer)
						}
					}
				} catch (error) {
					value = {
						ok: false,
						error: 'network',
						message: error instanceof Error ? error.message : String(error),
					}
				}
				// Only successful responses are cached: a fixed credential gap must
				// not linger behind a stale error after the user stores the key.
				if (value !== null && typeof value === 'object' && value.ok === true) {
					cache = { at: Date.now(), value }
				}
				json(res, 200, value)
			},
		}

		return ctx.webServer.register(route)
	}, 'ui-balance-chip: balance route')
}
