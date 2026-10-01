import { describe, expect, it, vi } from "vitest";

import { applyLayout, captureLayout, newTab } from "../src/commands.js";
import type { LayoutNode } from "../src/herdr/types.js";
import { normalizeApp, openArgs } from "../src/launch.js";
import { snapshot } from "./fixture.js";

function recorder(results: Record<string, unknown> = {}) {
	const calls: [string, any][] = [];
	const call = vi.fn(async (method: string, params?: object) => {
		calls.push([method, params]);
		return results[method] as any;
	});
	return { call: call as any, calls };
}

const created = { tab: { tab_id: "w3:tZ" }, root_pane: { pane_id: "w3:pZ" } };

describe("newTab", () => {
	it("opens in the configured folder, labelled with its name", async () => {
		const { call, calls } = recorder({ "tab.create": created });
		await newTab(call, snapshot(), { folder: "~/code/deckhand" }, "/Users/me");
		expect(calls).toEqual([["tab.create", { workspace_id: "w3", cwd: "/Users/me/code/deckhand", label: "deckhand", focus: true }]]);
	});

	it("defaults to the focused pane's current folder", async () => {
		const { call, calls } = recorder({ "tab.create": created });
		await newTab(call, snapshot(), {}, "/Users/me");
		expect(calls[0][1]).toMatchObject({ cwd: "/Users/me/code/streamdeck-herdr", label: "streamdeck-herdr" });
	});

	it("starts the agent in the new tab's pane with a free name", async () => {
		const { call, calls } = recorder({ "tab.create": created });
		const out = await newTab(call, snapshot(), { folder: "/x/deckhand", agent: "claude" }, "/Users/me");
		expect(calls[1]).toEqual(["agent.start", { name: "deckhand-2", kind: "claude", pane_id: "w3:pZ", timeout_ms: 60_000 }]);
		expect(out).toEqual({ tabId: "w3:tZ", agent: "deckhand-2" });
	});

	it("starts no agent for none or empty", async () => {
		for (const agent of ["none", "", undefined]) {
			const { call, calls } = recorder({ "tab.create": created });
			await newTab(call, snapshot(), { agent, label: "x" }, "/Users/me");
			expect(calls.map((c) => c[0])).toEqual(["tab.create"]);
		}
	});

	it("uses the label setting over the folder name", async () => {
		const { call, calls } = recorder({ "tab.create": created });
		await newTab(call, snapshot(), { folder: "/x/deckhand", label: "Review" }, "/Users/me");
		expect(calls[0][1].label).toBe("Review");
	});
});

describe("layouts", () => {
	const root: LayoutNode = { type: "split", direction: "right", ratio: 0.5, first: { type: "pane", pane_id: "w3:pQ", cwd: "/a" }, second: { type: "pane", pane_id: "w3:pR" } };

	it("captures the focused tab", async () => {
		const { call, calls } = recorder({ "layout.export": { layout: { root } } });
		expect(await captureLayout(call, snapshot())).toEqual({ layout: root });
		expect(calls).toEqual([["layout.export", { tab_id: "w3:tH" }]]);
	});

	it("applies into the focused workspace, cleaned, in the chosen folder", async () => {
		const { call, calls } = recorder();
		await applyLayout(call, snapshot(), { layout: root, folder: "~/r", label: "Pair" }, "/Users/me");
		const [method, params] = calls[0];
		expect(method).toBe("layout.apply");
		expect(params).toMatchObject({ workspace_id: "w3", tab_label: "Pair", focus: true });
		expect(JSON.stringify(params.root)).not.toContain("pane_id");
		expect(params.root.first.cwd).toBe("/Users/me/r");
	});

	it("refuses without a captured layout", async () => {
		await expect(applyLayout(recorder().call, snapshot(), {}, "/Users/me")).rejects.toThrow("no layout captured");
	});
});

describe("launch", () => {
	it("defaults to Terminal and cleans picked paths", () => {
		expect(openArgs(undefined)).toEqual(["-a", "Terminal"]);
		expect(normalizeApp("file:///Applications/Ghostty.app/")).toBe("/Applications/Ghostty.app");
		expect(normalizeApp("/Applications/My%20Term.app")).toBe("/Applications/My Term.app");
	});
});
