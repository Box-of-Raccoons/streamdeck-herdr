/**
 * Pure decisions over a herdr snapshot: what "next" means, what to call a tab,
 * who is waiting. No IO, so all of it is unit tested.
 */
import type { Agent, AgentStatus, LayoutNode, Snapshot, Tab, Workspace } from "./herdr/types.js";

/** Tabs of one workspace, in herdr's order (the snapshot's array order). */
export function tabsIn(snap: Snapshot, workspaceId: string | null | undefined): Tab[] {
	return snap.tabs.filter((t) => t.workspace_id === workspaceId);
}

function step<T>(items: T[], currentIndex: number, delta: number): T | null {
	if (items.length === 0) return null;
	const from = currentIndex < 0 ? 0 : currentIndex;
	const i = (((from + delta) % items.length) + items.length) % items.length;
	return items[i];
}

/** The tab `delta` places away from the focused one in the focused workspace, wrapping. Null with one or no tabs. */
export function stepTab(snap: Snapshot, delta: number): Tab | null {
	const tabs = tabsIn(snap, snap.focused_workspace_id);
	if (tabs.length < 2) return null;
	return step(tabs, tabs.findIndex((t) => t.tab_id === snap.focused_tab_id), delta);
}

/** Same for workspaces. */
export function stepWorkspace(snap: Snapshot, delta: number): Workspace | null {
	if (snap.workspaces.length < 2) return null;
	return step(snap.workspaces, snap.workspaces.findIndex((w) => w.workspace_id === snap.focused_workspace_id), delta);
}

/** A name for an agent: its herdr name, then its terminal title, then its kind. */
export function agentLabel(a: Agent): string {
	return a.name || a.terminal_title_stripped || a.title || a.display_agent || a.agent || a.pane_id;
}

const URGENCY: Record<AgentStatus, number> = { blocked: 0, done: 1, working: 2, idle: 3, unknown: 4 };

function mostUrgent(agents: Agent[]): Agent | null {
	return agents.reduce<Agent | null>((best, a) => (!best || URGENCY[a.agent_status] < URGENCY[best.agent_status] ? a : best), null);
}

/** The status shown for a tab: its most urgent agent's, or null when it has no agent. */
export function tabStatus(snap: Snapshot, tab: Tab): AgentStatus | null {
	return mostUrgent(snap.agents.filter((a) => a.tab_id === tab.tab_id))?.agent_status ?? null;
}

/**
 * What to call a tab on the dial. herdr's default labels are numbers ("4"), which say
 * nothing, so a numeric label gives way to the tab's agent name or title.
 */
export function tabName(snap: Snapshot, tab: Tab): string {
	if (!/^\d+$/.test(tab.label.trim())) return tab.label;
	const agent = mostUrgent(snap.agents.filter((a) => a.tab_id === tab.tab_id));
	return agent ? agentLabel(agent) : tab.label;
}

export type WaitingFilter = "both" | "blocked" | "done";

function orderKey(snap: Snapshot, a: Agent): [number, number] {
	const ws = snap.workspaces.findIndex((w) => w.workspace_id === a.workspace_id);
	const tab = snap.tabs.findIndex((t) => t.tab_id === a.tab_id);
	return [ws, tab];
}

/**
 * Agents that need you: blocked first, then the one that has waited longest
 * (lowest state_change_seq), then herdr's order.
 */
export function waitingAgents(snap: Snapshot, filter: WaitingFilter = "both"): Agent[] {
	const wanted = (s: AgentStatus) => (filter === "both" ? s === "blocked" || s === "done" : s === filter);
	return snap.agents
		.filter((a) => wanted(a.agent_status))
		.sort((a, b) => {
			const u = URGENCY[a.agent_status] - URGENCY[b.agent_status];
			if (u) return u;
			const seq = (a.state_change_seq ?? 0) - (b.state_change_seq ?? 0);
			if (seq) return seq;
			const [aw, at] = orderKey(snap, a);
			const [bw, bt] = orderKey(snap, b);
			return aw - bw || at - bt;
		});
}

/** The agent dial's list: those needing you first, then by workspace and tab order. */
export function agentDialOrder(snap: Snapshot): Agent[] {
	return [...snap.agents].sort((a, b) => {
		const u = URGENCY[a.agent_status] - URGENCY[b.agent_status];
		if (u) return u;
		const [aw, at] = orderKey(snap, a);
		const [bw, bt] = orderKey(snap, b);
		return aw - bw || at - bt;
	});
}

/** The pane that has focus, or null. */
export function focusedPane(snap: Snapshot) {
	return snap.panes.find((p) => p.pane_id === snap.focused_pane_id) ?? null;
}

/** The agent in the focused pane, or null. */
export function focusedAgent(snap: Snapshot): Agent | null {
	return snap.agents.find((a) => a.pane_id === snap.focused_pane_id) ?? null;
}

/**
 * A name herdr accepts (`[a-z][a-z0-9_-]{0,31}`) built from `base`, made unique
 * against names already in use by adding -2, -3, ...
 */
export function agentName(base: string, taken: Iterable<string>): string {
	let stem = base
		.toLowerCase()
		.replace(/[^a-z0-9_-]+/g, "-")
		.replace(/^[^a-z]+/, "")
		.replace(/-+$/, "");
	if (!stem) stem = "agent";
	const used = new Set(taken);
	const fit = (s: string, suffix: string) => s.slice(0, 32 - suffix.length).replace(/-+$/, "") + suffix;
	let name = fit(stem, "");
	for (let n = 2; used.has(name); n++) name = fit(stem, `-${n}`);
	return name;
}

/** `~` and `~/x` to the home folder; other paths unchanged. */
export function expandHome(p: string, home: string): string {
	if (p === "~") return home;
	if (p.startsWith("~/")) return home + p.slice(1);
	return p;
}

/**
 * An exported layout made ready to apply again: pane ids dropped (they name panes
 * that may not exist any more) and, when `cwd` is given, every pane opened there.
 */
export function layoutForApply(node: LayoutNode, cwd?: string): LayoutNode {
	if (node.type === "split") return { ...node, first: layoutForApply(node.first, cwd), second: layoutForApply(node.second, cwd) };
	const { pane_id: _drop, ...rest } = node;
	return cwd ? { ...rest, cwd } : rest;
}

/** "2 panes: right split" style summary for the settings panel. */
export function describeLayout(node: LayoutNode): string {
	const panes = (n: LayoutNode): number => (n.type === "pane" ? 1 : panes(n.first) + panes(n.second));
	const count = panes(node);
	if (count === 1) return "1 pane";
	const splits = (n: LayoutNode): string[] => (n.type === "pane" ? [] : [n.direction, ...splits(n.first), ...splits(n.second)]);
	return `${count} panes, splits: ${splits(node).join(", ")}`;
}
