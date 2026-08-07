import { Buffer } from "node:buffer";
import type { Bridge } from "@serverkgg/bridge";
import { readSettings } from "./palworldSettings";

export const REST_API_PORT = 8212;

const REST_API_HOST = "127.0.0.1";

const REQUEST_TIMEOUT_MS = 10_000;

export class PalworldApiError extends Error {
	readonly status: number | null;

	constructor(status: number | null, message: string) {
		super(message);

		this.name = "PalworldApiError";
		this.status = status;
	}
}

const credentials = async (context: Bridge.Context) => {
	const settings = await readSettings(context);
	const password = String(settings.AdminPassword ?? "");
	const port = Number(settings.RESTAPIPort ?? REST_API_PORT);

	if (password.length === 0) {
		throw new PalworldApiError(null, "the admin password is not set, so the panel cannot reach the server");
	}

	return {
		password,
		port: Number.isFinite(port) && port > 0 ? port : REST_API_PORT,
	};
};

const request = async (context: Bridge.Context, method: string, path: string, body?: Bridge.Values) => {
	const { password, port } = await credentials(context);

	const headers: Record<string, string> = {
		accept: "application/json",
		authorization: `Basic ${Buffer.from(`admin:${password}`, "utf8").toString("base64")}`,
	};

	if (body !== undefined) {
		headers["content-type"] = "application/json";
	}

	const response = await fetch(`http://${REST_API_HOST}:${port}${path}`, {
		method,
		headers,
		body: body === undefined ? undefined : JSON.stringify(body),
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
	});

	if (!response.ok) {
		throw new PalworldApiError(response.status, `palworld rejected ${method} ${path} with ${response.status}`);
	}

	return response;
};

export const palworldGet = async <Result>(context: Bridge.Context, path: string) => {
	const response = await request(context, "GET", path);

	return (await response.json()) as Result;
};

export const palworldPost = async (context: Bridge.Context, path: string, body?: Bridge.Values) => {
	const response = await request(context, "POST", path, body);

	await response.text();
};
