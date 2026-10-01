/** Multi-step herdr commands. Take a `call` so tests can record what gets sent. */
import path from "node:path";

import type { Call } from "./herdr/client.js";
import type { LayoutNode, Snapshot } from "./herdr/types.js";
import { agentName, expandHome, focusedPane, layoutForApply } from "./nav.js";

export interface NewTabSettings {
	/** Folder for the tab; empty means the focused pane's folder. `~` allowed. */
	folder?: string;
	/** Tab label; empty means the folder's name. */
	label?: string;
	/** Agent kind to start in the tab (claude, codex, ...); empty or "none" for a plain shell. */
	agent?: string;
}

/**
 * Opens a tab in the focused workspace and, when asked, starts an agent in it.
 * `agent.start` returns once the agent is ready, so give it a patient `call`.
 */
export async function newTab(call: Call, snap: Snapshot, s: NewTabSettings, home: string): Promise<{ tabId: string; agent: string | null }> {
	const pane = focusedPane(snap);
	const folder = s.folder?.trim();
	const cwd = folder ? expandHome(folder, home) : pane?.foreground_cwd || pane?.cwd || undefined;
	const label = s.label?.trim() || (cwd ? path.basename(cwd) : undefined);
	const created = await call<{ tab: { tab_id: string }; root_pane: { pane_id: string } }>("tab.create", {
		workspace_id: snap.focused_workspace_id ?? undefined,
		cwd,
		label,
		focus: true,
	});
	const kind = s.agent?.trim();
	if (!kind || kind === "none") return { tabId: created.tab.tab_id, agent: null };
	const taken = snap.agents.map((a) => a.name).filter((n): n is string => !!n);
	const name = agentName(label ?? kind, taken);
	await call("agent.start", { name, kind, pane_id: created.root_pane.pane_id, timeout_ms: 60_000 });
	return { tabId: created.tab.tab_id, agent: name };
}

export interface LayoutSettings {
	/** Captured with layout.export. */
	layout?: LayoutNode;
	layoutSummary?: string;
	/** Optional folder every pane opens in; empty keeps the captured folders. */
	folder?: string;
	/** Label for the new tab; also the key's caption. */
	label?: string;
}

/** Records the focused tab's layout so the key can rebuild it later. */
export async function captureLayout(call: Call, snap: Snapshot): Promise<{ layout: LayoutNode }> {
	const result = await call<{ layout: { root: LayoutNode } }>("layout.export", { tab_id: snap.focused_tab_id ?? undefined });
	return { layout: result.layout.root };
}

/** Opens the captured layout as a new tab in the focused workspace. */
export async function applyLayout(call: Call, snap: Snapshot, s: LayoutSettings, home: string): Promise<void> {
	if (!s.layout) throw new Error("no layout captured yet");
	const folder = s.folder?.trim();
	await call("layout.apply", {
		workspace_id: snap.focused_workspace_id ?? undefined,
		tab_label: s.label?.trim() || undefined,
		focus: true,
		root: layoutForApply(s.layout, folder ? expandHome(folder, home) : undefined),
	});
}
