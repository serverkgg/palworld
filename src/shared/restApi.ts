import { Buffer } from "node:buffer";
import { type Bridge, BridgeNetError } from "@serverkgg/bridge";
import { LoopbackMethod, loopbackJson, loopbackText } from "@serverkgg/bridge/net";
import { readSettings } from "./palworldSettings";

export const REST_API_PORT = 8212;

const REST_API_HOST = "127.0.0.1";

const REQUEST_TIMEOUT_MS = 10_000;

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

export const palworldGet = async <Result>(context: Bridge.Context, path: string) => {
	const { headers, url } = await restRequest(context, path);

	return await loopbackJson<Result>(url, {
		headers,
		method: LoopbackMethod.Get,
		timeoutMs: REQUEST_TIMEOUT_MS,
	});
};

export const palworldPost = async (context: Bridge.Context, path: string, body?: Bridge.Values) => {
	const { headers, url } = await restRequest(context, path);

	await loopbackText(url, {
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
