/** What each dial lists, and the text it puts on its slice of the touch strip. Pure. */
import type { AgentStatus, Snapshot } from "./herdr/types.js";
import type { DialView } from "./dial.js";
import { STATUS_COLORS } from "./keys.js";
import { agentDialOrder, agentLabel, tabName, tabsIn, tabStatus, waitingAgents } from "./nav.js";

export type DialKind = "workspace" | "tab" | "agent";

export interface DialItem {
	id: string;
	name: string;
	detail: string;
	detailColor: string;
}

export const STATUS_WORDS: Record<AgentStatus, string> = {
	blocked: "needs input",
	done: "done",
	working: "working",
	idle: "idle",
	unknown: "unknown",
};

const GREY = "#8E8E93";
const ACCENT = "#0A84FF";

const HEADINGS: Record<DialKind, string> = { workspace: "WORKSPACE", tab: "TAB", agent: "AGENT" };

/** The dial's items in display order and the id of herdr's current one. */
export function dialItems(kind: DialKind, snap: Snapshot): { items: DialItem[]; currentId: string | null } {
	if (kind === "workspace") {
		return {
			currentId: snap.focused_workspace_id ?? null,
			items: snap.workspaces.map((w) => {
				const tabs = tabsIn(snap, w.workspace_id).length;
				const waiting = waitingAgents(snap).filter((a) => a.workspace_id === w.workspace_id).length;
				const base = `${tabs} tab${tabs === 1 ? "" : "s"}`;
				return {
					id: w.workspace_id,
					name: w.label,
					detail: waiting ? `${base} · ${waiting} need${waiting === 1 ? "s" : ""} you` : base,
					detailColor: waiting ? STATUS_COLORS.blocked : GREY,
				};
			}),
		};
	}
	if (kind === "tab") {
		return {
			currentId: snap.focused_tab_id ?? null,
			items: tabsIn(snap, snap.focused_workspace_id).map((t) => {
				const status = tabStatus(snap, t);
				return {
					id: t.tab_id,
					name: tabName(snap, t),
					detail: status ? STATUS_WORDS[status] : "no agent",
					detailColor: status ? STATUS_COLORS[status] : GREY,
				};
			}),
		};
	}
	const focusedAgent = snap.agents.find((a) => a.pane_id === snap.focused_pane_id);
	return {
		currentId: focusedAgent?.pane_id ?? null,
		items: agentDialOrder(snap).map((a) => {
			const tab = snap.tabs.find((t) => t.tab_id === a.tab_id);
			const where = tab && !/^\d+$/.test(tab.label.trim()) ? ` · ${tab.label}` : "";
			return { id: a.pane_id, name: agentLabel(a), detail: STATUS_WORDS[a.agent_status] + where, detailColor: STATUS_COLORS[a.agent_status] };
		}),
	};
}

export interface Feedback {
	[key: string]: { value: string; color: string } | string;
	heading: { value: string; color: string };
	position: string;
	name: { value: string; color: string };
	detail: { value: string; color: string };
}

/** The strip text for one dial. A preview that isn't herdr's current item says so in the heading. */
export function dialFeedback(kind: DialKind, view: DialView<DialItem> | null): Feedback {
	if (!view) {
		return { heading: { value: HEADINGS[kind], color: GREY }, position: "", name: { value: "herdr offline", color: GREY }, detail: { value: "", color: GREY } };
	}
	if (!view.item) {
		return { heading: { value: HEADINGS[kind], color: GREY }, position: "0/0", name: { value: "none", color: GREY }, detail: { value: "", color: GREY } };
	}
	return {
		heading: view.current ? { value: HEADINGS[kind], color: GREY } : { value: "PRESS TO SWITCH", color: ACCENT },
		position: `${view.index + 1}/${view.count}`,
		name: { value: view.item.name, color: "#FFFFFF" },
		detail: { value: view.item.detail, color: view.item.detailColor },
	};
}
