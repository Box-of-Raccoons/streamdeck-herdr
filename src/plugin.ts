import streamDeck from "@elgato/streamdeck";
import { homedir } from "node:os";

import type { Ctx } from "./actions/base.js";
import { AgentDial, TabDial, WorkspaceDial } from "./actions/dials.js";
import { Layout, NeedsYou, NewTab, NextTab, PrevTab, Prompt, Stop, Zoom } from "./actions/keys.js";
import { createCall, socketPath, subscribe } from "./herdr/client.js";
import { openApp } from "./launch.js";
import { HerdrState } from "./state.js";

streamDeck.logger.setLevel("info");

/** Plugin-wide settings, shared by every action's settings panel. */
type Globals = { terminalApp?: string; raise?: boolean };
let globals: Globals = {};

const sock = socketPath();
const ctx: Ctx = {
	call: createCall(sock, 10_000),
	slowCall: createCall(sock, 90_000),
	home: homedir(),
	state: new HerdrState({
		call: createCall(sock, 5_000),
		subscribe: (subs, onEvent, onClose) => subscribe(sock, subs, onEvent, onClose),
		setTimeout: (fn, ms) => setTimeout(fn, ms),
		clearTimeout: (h) => clearTimeout(h as NodeJS.Timeout),
		log: (msg) => streamDeck.logger.info(msg),
	}),
	raise: async () => {
		if (globals.raise === false) return;
		if (!(await openApp(globals.terminalApp))) streamDeck.logger.warn(`could not open "${globals.terminalApp ?? ""}"`);
	},
};

streamDeck.settings.onDidReceiveGlobalSettings<Globals>((ev) => {
	globals = ev.settings;
});

for (const a of [NextTab, PrevTab, NewTab, NeedsYou, Stop, Prompt, Zoom, Layout, WorkspaceDial, TabDial, AgentDial]) {
	streamDeck.actions.registerAction(new a(ctx));
}

await streamDeck.connect();
globals = await streamDeck.settings.getGlobalSettings<Globals>();
