/** The parts of herdr's session snapshot this plugin reads (protocol 22, herdr 0.9.2). */

export type AgentStatus = "idle" | "working" | "blocked" | "done" | "unknown";

export interface Workspace {
	workspace_id: string;
	label: string;
	focused: boolean;
	number?: number;
}

export interface Tab {
	tab_id: string;
	workspace_id: string;
	label: string;
	focused: boolean;
	number?: number;
	agent_status?: AgentStatus;
}

export interface Pane {
	pane_id: string;
	workspace_id: string;
	tab_id: string;
	focused: boolean;
	cwd?: string | null;
	foreground_cwd?: string | null;
	agent?: string | null;
	agent_status?: AgentStatus;
}

export interface Agent {
	pane_id: string;
	workspace_id: string;
	tab_id: string;
	focused: boolean;
	agent_status: AgentStatus;
	agent?: string | null;
	name?: string | null;
	display_agent?: string | null;
	title?: string | null;
	terminal_title_stripped?: string | null;
	state_change_seq?: number;
}

export interface Snapshot {
	focused_workspace_id?: string | null;
	focused_tab_id?: string | null;
	focused_pane_id?: string | null;
	workspaces: Workspace[];
	tabs: Tab[];
	panes: Pane[];
	agents: Agent[];
}

/** A node of `layout.export` / `layout.apply`. */
export type LayoutNode =
	| { type: "pane"; pane_id?: string | null; label?: string | null; cwd?: string | null; command?: string[] | null; env?: Record<string, string> }
	| { type: "split"; direction: "right" | "down"; ratio: number; first: LayoutNode; second: LayoutNode };
