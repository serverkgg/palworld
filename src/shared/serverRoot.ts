import type { Bridge } from "@serverkgg/bridge";
import { execDetail } from "@serverkgg/bridge/utils";

export const serverRoot = async (context: Bridge.Context) => {
	const result = await context.exec([
		"pwd",
	]);

	if (result.code !== 0) {
		throw new Error(`the server directory could not be resolved — ${execDetail(result)}`);
	}

	return result.stdout.trim();
};
