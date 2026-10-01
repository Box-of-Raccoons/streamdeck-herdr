/**
 * The one copy of herdr's state that every key and dial draws from. Actions come
 * and go as pages change, so the state lives here, not in them.
 */
import type { Subscription } from "./herdr/client.js";
import type { Snapshot } from "./herdr/types.js";

/** Structure events herdr sends without a target. */
const GLOBAL_EVENTS = [
	"workspace.created",
	"workspace.updated",
	"workspace.renamed",
	"workspace.moved",
	"workspace.reordered",
	"workspace.closed",
	"workspace.focused",
	"tab.created",
	"tab.closed",
	"tab.focused",
	"tab.renamed",
	"tab.moved",
	"pane.created",
	"pane.closed",
	"pane.updated",
	"pane.focused",
	"pane.moved",
	"pane.exited",
	"pane.agent_detected",
];

/**
 * The subscription list for a snapshot. `pane.agent_status_changed` requires a
 * pane_id (checked on 0.9.2), so each agent pane gets its own entry.
 */
export function subscriptionsFor(snapshot: Snapshot | null): object[] {
	const subs: object[] = GLOBAL_EVENTS.map((type) => ({ type }));
	for (const pane of agentPanes(snapshot)) subs.push({ type: "pane.agent_status_changed", pane_id: pane });
	return subs;
}

function agentPanes(snapshot: Snapshot | null): string[] {
	return (snapshot?.agents ?? []).map((a) => a.pane_id).sort();
}

export interface StateDeps {
	call: <T = any>(method: string, params?: object) => Promise<T>;
	subscribe: (subs: object[], onEvent: (e: unknown) => void, onClose: (reason: string) => void) => Subscription;
	setTimeout: (fn: () => void, ms: number) => unknown;
	clearTimeout: (handle: unknown) => void;
	log?: (msg: string) => void;
}

export const POLL_MS = 5_000;
export const DEBOUNCE_MS = 100;
export const RESUBSCRIBE_MS = 2_000;

export class HerdrState {
	private snap: Snapshot | null = null;
	private listeners = new Set<(s: Snapshot | null) => void>();
	private sub: Subscription | null = null;
	private subKey = "";
	private pollTimer: unknown = null;
	private debounceTimer: unknown = null;
	private retryTimer: unknown = null;
	private running = false;
	private refreshing: Promise<void> | null = null;

	constructor(private deps: StateDeps) {}

	/** Latest snapshot, or null while herdr is unreachable. */
	get snapshot(): Snapshot | null {
		return this.snap;
	}

	get online(): boolean {
		return this.snap != null;
	}

	onChange(fn: (s: Snapshot | null) => void): () => void {
		this.listeners.add(fn);
		return () => this.listeners.delete(fn);
	}

	start(): void {
		if (this.running) return;
		this.running = true;
		void this.refresh();
	}

	stop(): void {
		this.running = false;
		for (const t of [this.pollTimer, this.debounceTimer, this.retryTimer]) if (t != null) this.deps.clearTimeout(t);
		this.pollTimer = this.debounceTimer = this.retryTimer = null;
		this.closeSub();
	}

	/** Re-read the snapshot now (after our own commands, so keys update without waiting for events). */
	refresh(): Promise<void> {
		this.refreshing ??= this.doRefresh().finally(() => (this.refreshing = null));
		return this.refreshing;
	}

	private async doRefresh(): Promise<void> {
		if (this.pollTimer != null) this.deps.clearTimeout(this.pollTimer);
		this.pollTimer = null;
		let next: Snapshot | null = null;
		try {
			const result = await this.deps.call<{ snapshot: Snapshot }>("session.snapshot");
			next = result.snapshot;
		} catch (e) {
			if (this.snap) this.deps.log?.(`herdr unreachable: ${e instanceof Error ? e.message : String(e)}`);
		}
		const changed = JSON.stringify(next) !== JSON.stringify(this.snap);
		this.snap = next;
		if (changed) for (const fn of this.listeners) fn(next);
		if (!this.running) return;
		this.ensureSubscription();
		this.pollTimer = this.deps.setTimeout(() => void this.refresh(), POLL_MS);
	}

	/** (Re)subscribe when herdr is up and the set of agent panes changed. */
	private ensureSubscription(): void {
		if (!this.snap) return this.closeSub();
		const key = agentPanes(this.snap).join(",");
		if (this.sub && key === this.subKey) return;
		this.closeSub();
		this.subKey = key;
		const sub = this.deps.subscribe(
			subscriptionsFor(this.snap),
			() => this.scheduleRefresh(),
			(reason) => {
				if (this.sub !== sub) return; // replaced on purpose
				this.sub = null;
				this.deps.log?.(`herdr subscription ended: ${reason}`);
				if (this.running && this.retryTimer == null) {
					this.retryTimer = this.deps.setTimeout(() => {
						this.retryTimer = null;
						void this.refresh();
					}, RESUBSCRIBE_MS);
				}
			},
		);
		this.sub = sub;
	}

	private closeSub(): void {
		const sub = this.sub;
		this.sub = null;
		this.subKey = "";
		sub?.close();
	}

	private scheduleRefresh(): void {
		if (this.debounceTimer != null) return;
		this.debounceTimer = this.deps.setTimeout(() => {
			this.debounceTimer = null;
			void this.refresh();
		}, DEBOUNCE_MS);
	}
}
