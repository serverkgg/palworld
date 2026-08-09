import type { BridgeDriver } from "@serverkgg/bridge";
import { backup } from "./backup";
import { players } from "./collections";
import { install } from "./install";
import { lifecycle } from "./lifecycle";
import { panel } from "./panel";
import { query } from "./query";
import { settings } from "./settings";
import { terminal } from "./terminal";

export const driver: BridgeDriver = {
	install,
	lifecycle,
	query,
	backup,
	terminal,
	panel,
	modules: {
		settings,
		players,
	},
};
