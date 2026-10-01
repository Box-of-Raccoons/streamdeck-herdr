import streamDeck, {
	type DidReceiveSettingsEvent,
	type KeyAction,
	type KeyDownEvent,
	SingletonAction,
	type WillAppearEvent,
	type WillDisappearEvent,
} from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";

import type { Call } from "../herdr/client.js";
import type { Snapshot } from "../herdr/types.js";
import type { HerdrState } from "../state.js";

/** What every action shares. */
export interface Ctx {
	state: HerdrState;
	/** For quick calls (focus, list). */
	call: Call;
	/** For calls that wait on an agent (start, prompt). */
	slowCall: Call;
	/** Brings the terminal app forward, if the user wants that. */
	raise: () => Promise<void>;
	home: string;
}

export function toDataUrl(svg: string): string {
	return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

function message(e: unknown): string {
	return e instanceof Error ? e.message : String(e);
}

/**
 * A key that draws itself from herdr's state and runs one command on press.
 * Failures show the Stream Deck alert and go to the plugin log.
 */
export abstract class HerdrKey<S extends JsonObject> extends SingletonAction<S> {
	private shown = new Map<string, { action: KeyAction<S>; settings: S; last: string | null }>();

	constructor(protected ctx: Ctx) {
		super();
		ctx.state.onChange(() => {
			for (const id of this.shown.keys()) void this.draw(id);
		});
	}

	/** The key's image for the current state; `snap` is null while herdr is offline. */
	protected abstract image(snap: Snapshot | null, settings: S): string;

	/** What a press does. Throw to show the alert. */
	protected abstract press(snap: Snapshot, settings: S, action: KeyAction<S>): Promise<void>;

	override async onWillAppear(ev: WillAppearEvent<S>): Promise<void> {
		if (!ev.action.isKey()) return;
		this.shown.set(ev.action.id, { action: ev.action, settings: ev.payload.settings, last: null });
		this.ctx.state.start();
		await this.draw(ev.action.id);
	}

	override onWillDisappear(ev: WillDisappearEvent<S>): void {
		this.shown.delete(ev.action.id);
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<S>): Promise<void> {
		const v = this.shown.get(ev.action.id);
		if (!v) return;
		v.settings = ev.payload.settings;
		await this.draw(ev.action.id);
	}

	override async onKeyDown(ev: KeyDownEvent<S>): Promise<void> {
		const snap = this.ctx.state.snapshot;
		if (!snap) return ev.action.showAlert();
		try {
			await this.press(snap, ev.payload.settings, ev.action);
		} catch (e) {
			streamDeck.logger.warn(`${this.manifestId}: ${message(e)}`);
			await ev.action.showAlert();
		}
		void this.ctx.state.refresh();
	}

	private async draw(id: string): Promise<void> {
		const v = this.shown.get(id);
		if (!v) return;
		const image = toDataUrl(this.image(this.ctx.state.snapshot, v.settings));
		if (image === v.last) return;
		v.last = image;
		await v.action.setImage(image);
	}
}
