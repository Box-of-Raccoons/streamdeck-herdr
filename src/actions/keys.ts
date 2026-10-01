import { action, type KeyAction, type SendToPluginEvent } from "@elgato/streamdeck";
import type { JsonObject, JsonValue } from "@elgato/utils";

import { applyLayout, captureLayout, newTab, type LayoutSettings, type NewTabSettings } from "../commands.js";
import type { Snapshot } from "../herdr/types.js";
import { iconKey, needsYouKey } from "../keys.js";
import { describeLayout, focusedAgent, stepTab, waitingAgents, type WaitingFilter } from "../nav.js";
import { HerdrKey } from "./base.js";

type None = JsonObject;

async function focusStep(ctx: HerdrKey<None>["ctx"], snap: Snapshot, delta: number): Promise<void> {
	const tab = stepTab(snap, delta);
	if (!tab) return; // one tab or none: nothing to move to
	await ctx.call("tab.focus", { tab_id: tab.tab_id });
	await ctx.raise();
}

@action({ UUID: "com.boxofraccoons.herdr.tab-next" })
export class NextTab extends HerdrKey<None> {
	protected image(snap: Snapshot | null): string {
		return iconKey("next", "Next tab", !snap);
	}
	protected press(snap: Snapshot): Promise<void> {
		return focusStep(this.ctx, snap, 1);
	}
}

@action({ UUID: "com.boxofraccoons.herdr.tab-prev" })
export class PrevTab extends HerdrKey<None> {
	protected image(snap: Snapshot | null): string {
		return iconKey("prev", "Prev tab", !snap);
	}
	protected press(snap: Snapshot): Promise<void> {
		return focusStep(this.ctx, snap, -1);
	}
}

@action({ UUID: "com.boxofraccoons.herdr.tab-new" })
export class NewTab extends HerdrKey<NewTabSettings & JsonObject> {
	protected image(snap: Snapshot | null, s: NewTabSettings): string {
		const agent = s.agent && s.agent !== "none" ? s.agent : "";
		return iconKey("new", s.label?.trim() || (agent ? `New ${agent}` : "New tab"), !snap);
	}
	protected async press(snap: Snapshot, s: NewTabSettings): Promise<void> {
		await newTab(this.ctx.slowCall, snap, s, this.ctx.home);
		await this.ctx.raise();
	}
}

type NeedsYouSettings = { show?: WaitingFilter };

@action({ UUID: "com.boxofraccoons.herdr.needs-you" })
export class NeedsYou extends HerdrKey<NeedsYouSettings & JsonObject> {
	protected image(snap: Snapshot | null, s: NeedsYouSettings): string {
		if (!snap) return needsYouKey(0, 0, s.show ?? "both", true);
		const count = (status: string) => snap.agents.filter((a) => a.agent_status === status).length;
		return needsYouKey(count("blocked"), count("done"), s.show ?? "both", false);
	}
	protected async press(snap: Snapshot, s: NeedsYouSettings): Promise<void> {
		const [first] = waitingAgents(snap, s.show ?? "both");
		if (!first) return;
		await this.ctx.call("agent.focus", { target: first.pane_id });
		await this.ctx.raise();
	}
}

function requireAgent(snap: Snapshot) {
	const agent = focusedAgent(snap);
	if (!agent) throw new Error("the focused pane has no agent");
	return agent;
}

@action({ UUID: "com.boxofraccoons.herdr.agent-stop" })
export class Stop extends HerdrKey<None> {
	protected image(snap: Snapshot | null): string {
		return iconKey("stop", "Stop", !snap);
	}
	protected async press(snap: Snapshot, _s: None, key: KeyAction<None>): Promise<void> {
		await this.ctx.call("agent.send_keys", { target: requireAgent(snap).pane_id, keys: ["esc"] });
		await key.showOk();
	}
}

type PromptSettings = { text?: string; label?: string };

@action({ UUID: "com.boxofraccoons.herdr.agent-prompt" })
export class Prompt extends HerdrKey<PromptSettings & JsonObject> {
	protected image(snap: Snapshot | null, s: PromptSettings): string {
		return iconKey("prompt", s.label?.trim() || s.text?.trim() || "Prompt", !snap);
	}
	protected async press(snap: Snapshot, s: PromptSettings, key: KeyAction<PromptSettings & JsonObject>): Promise<void> {
		const text = s.text?.trim();
		if (!text) throw new Error("no prompt text set");
		await this.ctx.slowCall("agent.prompt", { target: requireAgent(snap).pane_id, text });
		await key.showOk();
	}
}

@action({ UUID: "com.boxofraccoons.herdr.pane-zoom" })
export class Zoom extends HerdrKey<None> {
	protected image(snap: Snapshot | null): string {
		return iconKey("zoom", "Zoom", !snap);
	}
	protected async press(snap: Snapshot): Promise<void> {
		if (!snap.focused_pane_id) throw new Error("no focused pane");
		await this.ctx.call("pane.zoom", { pane_id: snap.focused_pane_id, mode: "toggle" });
	}
}

@action({ UUID: "com.boxofraccoons.herdr.layout" })
export class Layout extends HerdrKey<LayoutSettings & JsonObject> {
	protected image(snap: Snapshot | null, s: LayoutSettings): string {
		return iconKey("layout", s.label?.trim() || (s.layout ? "Layout" : "Capture..."), !snap);
	}
	protected async press(snap: Snapshot, s: LayoutSettings): Promise<void> {
		await applyLayout(this.ctx.call, snap, s, this.ctx.home);
		await this.ctx.raise();
	}

	/** The settings panel's "Capture" button (an sdpi-delegate with invoke="capture"). */
	override async onSendToPlugin(ev: SendToPluginEvent<JsonValue, LayoutSettings & JsonObject>): Promise<void> {
		const payload = ev.payload as { event?: string } | null;
		if (payload?.event !== "capture" || !ev.action.isKey()) return;
		const snap = this.ctx.state.snapshot;
		if (!snap) return ev.action.showAlert();
		try {
			const { layout } = await captureLayout(this.ctx.call, snap);
			const settings = await ev.action.getSettings();
			await ev.action.setSettings({ ...settings, layout, layoutSummary: describeLayout(layout) } as unknown as LayoutSettings & JsonObject);
			await ev.action.showOk();
		} catch {
			await ev.action.showAlert();
		}
	}
}
