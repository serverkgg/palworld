import { Buffer } from "node:buffer";
import { type Bridge, BridgeNetError, BridgeUserError } from "@serverkgg/bridge";
import { LoopbackMethod, type LoopbackOptions, loopbackText } from "@serverkgg/bridge/net";
import { readSettings } from "./palworldSettings";

export const REST_API_PORT = 8212;

const REST_API_HOST = "127.0.0.1";

const REQUEST_TIMEOUT_MS = 10_000;

const UNAUTHORIZED_STATUS = 401;

const NOT_ANSWERING: Bridge.Text = {
	ar: "السيرفر ما يرد على اللوحة الحين. إذا توه شغّال انتظر شوي، وبعدين جرّب مرة ثانية.",
	en: "The server is not answering the panel right now. If it just started, wait a bit, then try again.",
};

const PASSWORD_CHANGED: Bridge.Text = {
	ar: "كلمة مرور الأدمن تغيّرت والسيرفر لسا شغّال بالقديمة. أعد تشغيل السيرفر عشان تنطبق.",
	en: "The admin password changed while the server still runs with the old one. Restart the server so it takes effect.",
};

export const restFailure = (error: unknown): unknown => {
	if (!(error instanceof BridgeNetError)) {
		return error;
	}

	if (error.status === null) {
		return new BridgeUserError(NOT_ANSWERING, {
			cause: error,
		});
	}

	if (error.status === UNAUTHORIZED_STATUS) {
		return new BridgeUserError(PASSWORD_CHANGED, {
			cause: error,
		});
	}

	return error;
};

export const restCredentials = (settings: Bridge.Values) => {
	const password = String(settings.AdminPassword ?? "");
	const port = Number(settings.RESTAPIPort ?? REST_API_PORT);

	if (password.length === 0) {
		throw new BridgeNetError(null, "the admin password is not set, so the panel cannot reach the server");
	}

	return {
		password,
		port: Number.isFinite(port) && port > 0 ? port : REST_API_PORT,
	};
};

const restRequest = async (context: Bridge.Context, path: string) => {
	const { password, port } = restCredentials(await readSettings(context));

	return {
		headers: {
			accept: "application/json",
			authorization: `Basic ${Buffer.from(`admin:${password}`, "utf8").toString("base64")}`,
		},
		url: `http://${REST_API_HOST}:${port}${path}`,
	};
};

const restCall = async (url: string, options: LoopbackOptions) => {
	try {
		return await loopbackText(url, options);
	} catch (error) {
		throw restFailure(error);
	}
};

export const palworldGet = async <Result>(context: Bridge.Context, path: string) => {
	const { headers, url } = await restRequest(context, path);
	const text = await restCall(url, {
		headers,
		method: LoopbackMethod.Get,
		timeoutMs: REQUEST_TIMEOUT_MS,
	});

	try {
		return JSON.parse(text) as Result;
	} catch {
		throw new BridgeNetError(null, `the palworld rest api did not answer ${path} with json`);
	}
};

export const palworldPost = async (context: Bridge.Context, path: string, body?: Bridge.Values) => {
	const { headers, url } = await restRequest(context, path);

	await restCall(url, {
		headers:
			body === undefined
				? headers
				: {
						...headers,
						"content-type": "application/json",
					},
		method: LoopbackMethod.Post,
		timeoutMs: REQUEST_TIMEOUT_MS,
		...(body === undefined
			? {}
			: {
					body: JSON.stringify(body),
				}),
	});
};
