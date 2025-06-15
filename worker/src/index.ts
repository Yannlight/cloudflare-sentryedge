import { Env } from "./env";
import { withCors, corsHeaders } from "./cors";
import { parseLogLine } from "./log-parsers";

export default {
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext
	): Promise<Response | undefined> {
		const { pathname, searchParams } = new URL(request.url);

		// Handle preflight
		if (request.method === 'OPTIONS') {
			return withCors(new Response(null, { status: 204 }))
		}

		if (request.method === 'POST' && pathname === '/logs') {
			try {

				// Always read as text, then try to parse as JSON
				let rawBody = await request.text();
				let data: any;
				let isJson = false;
				try {
					data = JSON.parse(rawBody);
					isJson = true;
				} catch {
					data = rawBody;
				}

				let log;
				try {
					log = selectLog(data, isJson);
				} catch (e: any) {
					if (e && e.message === 'Invalid base64 in raw_b64') {
						return withCors(new Response('Invalid base64 in raw_b64', { status: 400 }));
					}
					throw e;
				}
				// Helper moved outside handler for efficiency
				function parseMaybeBase64(input: string) {
					try {
						const decoded = atob(input);
						if (/^[\x09\x0A\x0D\x20-\x7E]*$/.test(decoded) && decoded.length > 0) {
							return parseLogLine(decoded);
						}
					} catch { }
					return parseLogLine(input);
				}

				function selectLog(data: any, isJson: boolean) {

					console.log("Received log data:", data);
					if (isJson && typeof data === 'object' && data !== null && !Array.isArray(data)) {
						console.log("Data is JSON object, processing keys:", Object.keys(data));
						// Always prefer the raw key if present, regardless of value
						if (Object.prototype.hasOwnProperty.call(data, 'raw')) {
							// Unwrap recursively if raw is itself a JSON string or object with a raw key
							let raw = data.raw;
							// If raw is a string that looks like JSON, try to parse it
							while (typeof raw === 'string') {
								try {
									const parsed = JSON.parse(raw);
									// If parsed is an object with a raw key, unwrap again
									if (parsed && typeof parsed === 'object' && Object.prototype.hasOwnProperty.call(parsed, 'raw')) {
										raw = parsed.raw;
										continue;
									}
								} catch { }
								break;
							}
							if (typeof raw === 'string') {
								return parseLogLine(raw || "");
							} else if (raw !== null && typeof raw !== 'undefined') {
								return parseLogLine(JSON.stringify(raw));
							} else {
								return parseLogLine("");
							}
						}
						console.log("No 'raw' key found, checking for raw_b64, message, service, and level keys");
						const { raw_b64, message, service, level } = data;
						if (typeof raw_b64 === 'string') {
							try {
								console.log("Found 'raw_b64' key, decoding base64 value");
								return parseLogLine(atob(raw_b64));
							} catch {
								const err = new Error('Invalid base64 in raw_b64');
								err.message = 'Invalid base64 in raw_b64';
								throw err;
							}
						}
						console.log("No 'raw_b64' found, checking for message, service, and level keys");
						if (message && (!service || !level)) {
							console.log("Found 'message' key, parsing it as a log line");
							return parseLogLine(message);
						} else if (service && level && message) {
							console.log("Found 'service', 'level', and 'message' keys, returning structured log");
							return { service, level, message, timestamp: new Date().toISOString() };
						} else {
							// If the object has only one key and it's not a known log field, try to parse its value
							console.log("No raw_b64 or message, checking for single key log format");
							const keys = Object.keys(data ? data : {});
							console.log("Log keys:", keys);
							if (keys.length === 1 && !['raw_b64', 'raw', 'message', 'service', 'level'].includes(keys[0])) {
								console.log("Single key log, parsing value:", data[keys[0]]);
								const val = data[keys[0]];
								if (typeof val === 'string') {
									console.log("Parsing single key value as string:", val);
									return parseLogLine(val || "");
								} else if (typeof val !== 'undefined') {
									console.log("Parsing single key value as JSON:", val);
									return parseLogLine(JSON.stringify(val));
								}
							}
							console.log("No raw_b64 or message, falling back to stringifying the whole object:", data);
							// Otherwise, fallback to stringifying the whole object
							return parseLogLine(JSON.stringify(data));
						}
					} else if (typeof data === 'string') {
						console.log("Data is a string, parsing it as a log line:", data);
						return parseMaybeBase64(data);
					} else {
						console.log("Data is neither JSON object nor string, falling back to empty log line");
						return parseLogLine("");
					}
				}

				// Always store timestamp in ISO 8601 format, regardless of input
				let ts: string = new Date().toISOString();
				if (log.timestamp) {
					// Try to parse and reformat any incoming timestamp
					const d = new Date(log.timestamp);
					if (!isNaN(d.getTime())) {
						ts = d.toISOString();
					}
				}
				await env.DB.prepare(
					`INSERT INTO logs (service, level, message, timestamp) VALUES (?, ?, ?, ?)`
				).bind(log.service, log.level, log.message, ts).run();

				return withCors(new Response('OK', { status: 200 }));
			} catch (err: any) {
				return withCors(new Response('Error: ' + err.message, { status: 500 }));
			}
		}

		if (request.method === 'GET' && pathname === '/logs') {
			const limit = parseInt(searchParams.get('limit') || '20');
			const offset = parseInt(searchParams.get('offset') || '0');
			const level = searchParams.get('level');
			const service = searchParams.get('service');

			let query = `SELECT * FROM logs`;
			const conditions = [];
			const bindings = [];

			if (level) {
				conditions.push(`level = ?`);
				bindings.push(level);
			}

			if (service) {
				conditions.push(`service = ?`);
				bindings.push(service);
			}

			if (conditions.length > 0) {
				query += ` WHERE ` + conditions.join(' AND ');
			}

			query += ` ORDER BY timestamp DESC LIMIT ? OFFSET ?`;
			bindings.push(limit, offset);

			const { results } = await env.DB.prepare(query).bind(...bindings).all();

			return withCors(
				new Response(JSON.stringify(results), {
					headers: { "Content-Type": "application/json", ...corsHeaders }
				})
			);
		}

		return withCors(new Response('Not Found', { status: 404 }));
	}
};
