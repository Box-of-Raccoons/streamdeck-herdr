import streamDeck, {
	action,
	type DialAction,
	type DialDownEvent,
	type DialRotateEvent,
	SingletonAction,
	type TouchTapEvent,
	type WillAppearEvent,
	type WillDisappearEvent,
} from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";

import { DialBrowser, SNAP_BACK_MS } from "../dial.js";
import { dialFeedback, dialItems, type DialItem, type DialKind } from "../dialfeed.js";
import type { Ctx } from "./base.js";

const idOf = (i: DialItem) => i.id;

/**
 * A dial that browses workspaces, tabs or agents on its strip slice. Turning
 * previews, pressing or tapping switches, and it snaps back after a quiet spell.
 */
abstract class BrowseDial extends SingletonAction<JsonObject> {
	protected abstract readonly kind: DialKind;
	private dials = new Map<string, { action: DialAction<JsonObject>; browser: DialBrowser; snapTimer: NodeJS.Timeout | null; last: string }>();

	constructor(protected ctx: Ctx) {
		super();
		ctx.state.onChange(() => {
			for (const id of this.dials.keys()) void this.draw(id);
		});
	}

	/** Focus the chosen item in herdr. */
	protected abstract switchTo(id: string): Promise<void>;

	override async onWillAppear(ev: WillAppearEvent<JsonObject>): Promise<void> {
		if (!ev.action.isDial()) return;
		this.dials.set(ev.action.id, { action: ev.action, browser: new DialBrowser(), snapTimer: null, last: "" });
		this.ctx.state.start();
		await this.draw(ev.action.id);
	}

	override onWillDisappear(ev: WillDisappearEvent<JsonObject>): void {
		const d = this.dials.get(ev.action.id);
		if (d?.snapTimer) clearTimeout(d.snapTimer);
		this.dials.delete(ev.action.id);
	}

	override async onDialRotate(ev: DialRotateEvent<JsonObject>): Promise<void> {
		const d = this.dials.get(ev.action.id);
		const snap = this.ctx.state.snapshot;
		if (!d || !snap) return;
		const { items, currentId } = dialItems(this.kind, snap);
		d.browser.turn(items, idOf, currentId, ev.payload.ticks, Date.now());
		if (d.snapTimer) clearTimeout(d.snapTimer);
		d.snapTimer = setTimeout(() => {
			d.snapTimer = null;
			void this.draw(ev.action.id);
		}, SNAP_BACK_MS + 50);
		await this.draw(ev.action.id);
	}

	override onDialDown(ev: DialDownEvent<JsonObject>): Promise<void> {
		return this.commit(ev.action.id);
	}

	override onTouchTap(ev: TouchTapEvent<JsonObject>): Promise<void> {
		return this.commit(ev.action.id);
	}

	private async commit(id: string): Promise<void> {
		const d = this.dials.get(id);
		const snap = this.ctx.state.snapshot;
		if (!d) return;
		if (!snap) return d.action.showAlert();
		const { items, currentId } = dialItems(this.kind, snap);
		const target = d.browser.commit(items, idOf, currentId, Date.now());
		if (d.snapTimer) clearTimeout(d.snapTimer);
		d.snapTimer = null;
		try {
			if (target) await this.switchTo(target);
			await this.ctx.raise();
		} catch (e) {
			streamDeck.logger.warn(`${this.kind} dial: ${e instanceof Error ? e.message : String(e)}`);
			await d.action.showAlert();
		}
		await this.ctx.state.refresh();
		await this.draw(id);
	}

	private async draw(id: string): Promise<void> {
		const d = this.dials.get(id);
		if (!d) return;
		const snap = this.ctx.state.snapshot;
		let feedback;
		if (!snap) feedback = dialFeedback(this.kind, null);
		else {
			const { items, currentId } = dialItems(this.kind, snap);
			feedback = dialFeedback(this.kind, d.browser.view(items, idOf, currentId, Date.now()));
		}
		const key = JSON.stringify(feedback);
		if (key === d.last) return;
		d.last = key;
		await d.action.setFeedback(feedback);
	}
}

@action({ UUID: "com.boxofraccoons.herdr.dial-workspace" })
export class WorkspaceDial extends BrowseDial {
	protected readonly kind = "workspace";
	protected async switchTo(id: string): Promise<void> {
		await this.ctx.call("workspace.focus", { workspace_id: id });
	}
}

@action({ UUID: "com.boxofraccoons.herdr.dial-tab" })
export class TabDial extends BrowseDial {
	protected readonly kind = "tab";
	protected async switchTo(id: string): Promise<void> {
		await this.ctx.call("tab.focus", { tab_id: id });
	}
}

@action({ UUID: "com.boxofraccoons.herdr.dial-agent" })
export class AgentDial extends BrowseDial {
	protected readonly kind = "agent";
	protected async switchTo(id: string): Promise<void> {
		await this.ctx.call("agent.focus", { target: id });
	}
}
