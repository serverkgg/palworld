import type { BridgeDriver } from "@serverkgg/bridge";
import { RCON_ACCESS_MODULE } from "@serverkgg/bridge/rcon";
import { rconAccess } from "./access";
import { live } from "./actions";
import { announce } from "./announce";
import { backup } from "./backup";
import { bans, players } from "./collections";
import { health, ue4ss } from "./details";
import { events } from "./events";
import { install } from "./install";
import { lifecycle } from "./lifecycle";
import { panel } from "./panel";
import { query } from "./query";
import { settings } from "./settings";
import { setup } from "./setup";
import { terminal } from "./terminal";
import { ue4ssMods } from "./ue4ss";

export const driver: BridgeDriver = {
	install,
	lifecycle,
	events,
	query,
	backup,
	announce,
	setup,
	terminal,
	panel,
	modules: {
		settings,
		players,
		bans,
		health,
		live,
		ue4ss,
		ue4ssMods,
		[RCON_ACCESS_MODULE]: rconAccess,
	},
};
