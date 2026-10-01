import { describe, expect, it } from "vitest";

import type { LayoutNode } from "../src/herdr/types.js";
import { agentDialOrder, agentLabel, agentName, describeLayout, expandHome, focusedAgent, layoutForApply, stepTab, stepWorkspace, tabName, tabStatus, waitingAgents } from "../src/nav.js";
import { snapshot } from "./fixture.js";

describe("stepTab", () => {
	it("moves within the focused workspace and wraps both ways", () => {
		const s = snapshot(); // focused w3:tH, the last tab of w3
		expect(stepTab(s, 1)?.tab_id).toBe("w3:t8");
		expect(stepTab(s, -1)?.tab_id).toBe("w3:tE");
		expect(stepTab({ ...s, focused_tab_id: "w3:t8" }, -1)?.tab_id).toBe("w3:tH");
		expect(stepTab(s, 5)?.tab_id).toBe("w3:t8");
	});

	it("never leaves the workspace", () => {
		const s = snapshot();
		for (let d = -6; d <= 6; d++) expect(stepTab(s, d)?.workspace_id ?? "w3").toBe("w3");
	});

	it("returns null with a single tab", () => {
		const s = snapshot({ focused_workspace_id: "w5", tabs: [{ tab_id: "w5:t1", workspace_id: "w5", label: "1", focused: true }], focused_tab_id: "w5:t1" });
		expect(stepTab(s, 1)).toBeNull();
	});

	it("starts from the first tab when the focused one is unknown", () => {
		expect(stepTab(snapshot({ focused_tab_id: "gone" }), 1)?.tab_id).toBe("w3:tD");
	});
});

describe("stepWorkspace", () => {
	it("wraps across workspaces and is null with only one", () => {
		const s = snapshot();
		expect(stepWorkspace(s, 1)?.workspace_id).toBe("w4");
		expect(stepWorkspace(s, -1)?.workspace_id).toBe("w4");
		expect(stepWorkspace({ ...s, workspaces: [s.workspaces[0]] }, 1)).toBeNull();
	});
});

describe("tab names and status", () => {
	it("replaces herdr's numeric default label with the agent's title", () => {
		const s = snapshot();
		expect(tabName(s, s.tabs[0])).toBe("Custom macropad");
		expect(tabName(s, s.tabs[3])).toBe("Usage gauges");
	});

	it("keeps a real label, and a numeric one when the tab has no agent", () => {
		const s = snapshot();
		expect(tabName(s, s.tabs[2])).toBe("deckhand");
		expect(tabName(s, { tab_id: "w4:t9", workspace_id: "w4", label: "3", focused: false })).toBe("3");
	});

	it("shows the most urgent agent's status, or null without an agent", () => {
		const s = snapshot();
		s.agents.push({ pane_id: "w3:pZ", workspace_id: "w3", tab_id: "w3:tH", focused: false, agent_status: "blocked" });
		expect(tabStatus(s, s.tabs[3])).toBe("blocked");
		expect(tabStatus(s, s.tabs[5])).toBeNull();
	});

	it("names agents by name, then title, then kind", () => {
		expect(agentLabel({ pane_id: "p", workspace_id: "w", tab_id: "t", focused: false, agent_status: "idle", name: "n", terminal_title_stripped: "t" })).toBe("n");
		expect(agentLabel({ pane_id: "p", workspace_id: "w", tab_id: "t", focused: false, agent_status: "idle", agent: "codex" })).toBe("codex");
		expect(agentLabel({ pane_id: "p", workspace_id: "w", tab_id: "t", focused: false, agent_status: "idle" })).toBe("p");
	});
});

describe("waitingAgents", () => {
	it("lists blocked first, then done by longest wait (lowest seq)", () => {
		expect(waitingAgents(snapshot()).map((a) => a.pane_id)).toEqual(["w3:pM", "w4:pA", "w3:pE"]);
	});

	it("filters to one kind", () => {
		expect(waitingAgents(snapshot(), "blocked").map((a) => a.pane_id)).toEqual(["w3:pM"]);
		expect(waitingAgents(snapshot(), "done").map((a) => a.pane_id)).toEqual(["w4:pA", "w3:pE"]);
	});

	it("breaks a seq tie by workspace then tab order, not list order", () => {
		const s = snapshot();
		s.agents.reverse(); // w4's agent now comes first in the list
		for (const a of s.agents) a.state_change_seq = 1;
		expect(waitingAgents(s, "done").map((a) => a.pane_id)).toEqual(["w3:pE", "w4:pA"]);
	});
});

it("agentDialOrder puts agents needing you first, then herdr's order", () => {
	expect(agentDialOrder(snapshot()).map((a) => a.pane_id)).toEqual(["w3:pM", "w3:pE", "w4:pA", "w3:pQ", "w3:pK"]);
});

it("focusedAgent finds the agent in the focused pane", () => {
	expect(focusedAgent(snapshot())?.pane_id).toBe("w3:pQ");
	expect(focusedAgent(snapshot({ focused_pane_id: "w4:pB" }))).toBeNull();
});

describe("agentName", () => {
	it("fits herdr's pattern", () => {
		for (const base of ["streamdeck-herdr", "My Repo!", "123abc", "--x", "", "ÜBER tool", "a".repeat(50)]) {
			expect(agentName(base, [])).toMatch(/^[a-z][a-z0-9_-]{0,31}$/);
		}
		expect(agentName("My Repo!", [])).toBe("my-repo");
		expect(agentName("123abc", [])).toBe("abc");
		expect(agentName("", [])).toBe("agent");
	});

	it("adds a number when the name is taken, staying within 32 characters", () => {
		expect(agentName("deckhand", ["deckhand"])).toBe("deckhand-2");
		expect(agentName("deckhand", ["deckhand", "deckhand-2"])).toBe("deckhand-3");
		const long = agentName("a".repeat(40), ["a".repeat(32)]);
		expect(long).toBe("a".repeat(30) + "-2");
	});
});

it("expandHome expands ~ only at the start", () => {
	expect(expandHome("~", "/Users/me")).toBe("/Users/me");
	expect(expandHome("~/code", "/Users/me")).toBe("/Users/me/code");
	expect(expandHome("/tmp/~x", "/Users/me")).toBe("/tmp/~x");
});

describe("layouts", () => {
	const captured: LayoutNode = {
		type: "split",
		direction: "right",
		ratio: 0.6,
		first: { type: "pane", pane_id: "w3:pQ", cwd: "/a", command: ["claude"] },
		second: { type: "split", direction: "down", ratio: 0.5, first: { type: "pane", pane_id: "w3:pR", cwd: "/b" }, second: { type: "pane", pane_id: "w3:pS" } },
	};

	it("drops pane ids everywhere and keeps captured folders", () => {
		const out = layoutForApply(captured);
		expect(JSON.stringify(out)).not.toContain("pane_id");
		expect(out).toMatchObject({ ratio: 0.6, first: { cwd: "/a", command: ["claude"] }, second: { first: { cwd: "/b" } } });
	});

	it("opens every pane in the given folder", () => {
		const out = JSON.stringify(layoutForApply(captured, "/repo"));
		expect(out.match(/"cwd":"\/repo"/g)).toHaveLength(3);
	});

	it("describes the shape", () => {
		expect(describeLayout(captured)).toBe("3 panes, splits: right, down");
		expect(describeLayout({ type: "pane" })).toBe("1 pane");
	});
});
