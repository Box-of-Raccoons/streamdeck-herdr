import type { Agent, Snapshot } from "../src/herdr/types.js";

/**
 * Shaped like a real 0.9.2 snapshot: workspace "code" with default numeric tab
 * labels next to a named one, plus a second workspace.
 */
export function snapshot(over: Partial<Snapshot> = {}): Snapshot {
	const agents: Agent[] = [
		{ pane_id: "w3:pE", workspace_id: "w3", tab_id: "w3:t8", focused: false, agent: "claude", agent_status: "done", terminal_title_stripped: "Custom macropad", state_change_seq: 40 },
		{ pane_id: "w3:pK", workspace_id: "w3", tab_id: "w3:tD", focused: false, agent: "claude", agent_status: "idle", terminal_title_stripped: "ULANZI viability", state_change_seq: 53 },
		{ pane_id: "w3:pM", workspace_id: "w3", tab_id: "w3:tE", focused: false, agent: "claude", name: "deckhand", agent_status: "blocked", terminal_title_stripped: "Ticket to Herdr", state_change_seq: 60 },
		{ pane_id: "w3:pQ", workspace_id: "w3", tab_id: "w3:tH", focused: true, agent: "claude", agent_status: "working", terminal_title_stripped: "Usage gauges", state_change_seq: 73 },
		{ pane_id: "w4:pA", workspace_id: "w4", tab_id: "w4:t1", focused: false, agent: "codex", agent_status: "done", terminal_title_stripped: "Docs pass", state_change_seq: 12 },
	];
	return {
		focused_workspace_id: "w3",
		focused_tab_id: "w3:tH",
		focused_pane_id: "w3:pQ",
		workspaces: [
			{ workspace_id: "w3", label: "code", focused: true, number: 1 },
			{ workspace_id: "w4", label: "docs", focused: false, number: 2 },
		],
		tabs: [
			{ tab_id: "w3:t8", workspace_id: "w3", label: "1", focused: false, number: 8 },
			{ tab_id: "w3:tD", workspace_id: "w3", label: "2", focused: false, number: 13 },
			{ tab_id: "w3:tE", workspace_id: "w3", label: "deckhand", focused: false, number: 14 },
			{ tab_id: "w3:tH", workspace_id: "w3", label: "4", focused: true, number: 17 },
			{ tab_id: "w4:t1", workspace_id: "w4", label: "1", focused: false, number: 1 },
			{ tab_id: "w4:t2", workspace_id: "w4", label: "shell", focused: false, number: 2 },
		],
		panes: [
			{ pane_id: "w3:pQ", workspace_id: "w3", tab_id: "w3:tH", focused: true, cwd: "/Users/me/code", foreground_cwd: "/Users/me/code/streamdeck-herdr", agent: "claude", agent_status: "working" },
			{ pane_id: "w4:pB", workspace_id: "w4", tab_id: "w4:t2", focused: false, cwd: "/Users/me/docs" },
		],
		agents,
		...over,
	};
}
