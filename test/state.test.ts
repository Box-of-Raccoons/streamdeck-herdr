import { describe, expect, it, vi } from "vitest";

import { DEBOUNCE_MS, HerdrState, POLL_MS, RESUBSCRIBE_MS, subscriptionsFor } from "../src/state.js";
import { snapshot } from "./fixture.js";

/** Manual clock: timers fire only when advanced. */
function harness(snaps: (object | Error)[]) {
	let now = 0;
	const timers: { at: number; fn: () => void; id: number }[] = [];
	let nextId = 0;
	const subs: { list: object[]; onEvent: (e: unknown) => void; onClose: (r: string) => void; closed: boolean }[] = [];
	let i = 0;
	const call = vi.fn(async () => {
		const s = snaps[Math.min(i++, snaps.length - 1)];
		if (s instanceof Error) throw s;
		return { snapshot: s };
	});
	const state = new HerdrState({
		call: call as any,
		subscribe: (list, onEvent, onClose) => {
			const sub = { list, onEvent, onClose, closed: false };
			subs.push(sub);
			return { close: () => (sub.closed = true) };
		},
		setTimeout: (fn, ms) => {
			const t = { at: now + ms, fn, id: ++nextId };
			timers.push(t);
			return t.id;
		},
		clearTimeout: (id) => {
			const k = timers.findIndex((t) => t.id === id);
			if (k >= 0) timers.splice(k, 1);
		},
	});
	const advance = async (ms: number) => {
		now += ms;
		for (let t; (t = timers.filter((x) => x.at <= now).sort((a, b) => a.at - b.at)[0]); ) {
			timers.splice(timers.indexOf(t), 1);
			t.fn();
			await new Promise((r) => setTimeout(r, 0));
		}
		await new Promise((r) => setTimeout(r, 0));
	};
	return { state, call, subs, advance, timers };
}

describe("subscriptionsFor", () => {
	it("adds one status subscription per agent pane, since herdr requires pane_id", () => {
		const subs = subscriptionsFor(snapshot()) as any[];
		const status = subs.filter((s) => s.type === "pane.agent_status_changed");
		expect(status.map((s) => s.pane_id).sort()).toEqual(["w3:pE", "w3:pK", "w3:pM", "w3:pQ", "w4:pA"]);
		expect(subs.filter((s) => s.type !== "pane.agent_status_changed").every((s) => Object.keys(s).length === 1)).toBe(true);
		expect(subs.map((s) => s.type)).toEqual(expect.arrayContaining(["tab.focused", "workspace.focused", "pane.created", "tab.renamed"]));
	});
});

describe("HerdrState", () => {
	it("loads a snapshot on start and notifies", async () => {
		const h = harness([snapshot()]);
		const seen = vi.fn();
		h.state.onChange(seen);
		h.state.start();
		await h.advance(0);
		expect(h.state.online).toBe(true);
		expect(h.state.snapshot?.focused_tab_id).toBe("w3:tH");
		expect(seen).toHaveBeenCalledOnce();
		expect(h.subs).toHaveLength(1);
	});

	it("goes offline (null) when herdr is unreachable, without subscribing", async () => {
		const h = harness([new Error("ECONNREFUSED")]);
		h.state.start();
		await h.advance(0);
		expect(h.state.online).toBe(false);
		expect(h.subs).toHaveLength(0);
	});

	it("polls as a safety net and only notifies on change", async () => {
		const h = harness([snapshot(), snapshot(), snapshot({ focused_tab_id: "w3:t8" })]);
		const seen = vi.fn();
		h.state.onChange(seen);
		h.state.start();
		await h.advance(0);
		await h.advance(POLL_MS);
		expect(h.call).toHaveBeenCalledTimes(2);
		expect(seen).toHaveBeenCalledTimes(1);
		await h.advance(POLL_MS);
		expect(seen).toHaveBeenCalledTimes(2);
	});

	it("refreshes shortly after events, collapsing a burst into one read", async () => {
		const h = harness([snapshot()]);
		h.state.start();
		await h.advance(0);
		h.subs[0].onEvent({});
		h.subs[0].onEvent({});
		h.subs[0].onEvent({});
		await h.advance(DEBOUNCE_MS);
		expect(h.call).toHaveBeenCalledTimes(2);
	});

	it("re-subscribes only when the set of agent panes changes", async () => {
		const fewer = snapshot();
		fewer.agents = fewer.agents.slice(0, 2);
		const h = harness([snapshot(), snapshot({ focused_tab_id: "w3:t8" }), fewer]);
		h.state.start();
		await h.advance(0);
		await h.advance(POLL_MS);
		expect(h.subs).toHaveLength(1);
		await h.advance(POLL_MS);
		expect(h.subs).toHaveLength(2);
		expect(h.subs[0].closed).toBe(true);
		expect((h.subs[1].list as any[]).filter((s) => s.pane_id)).toHaveLength(2);
	});

	it("retries after the subscription drops", async () => {
		const h = harness([snapshot()]);
		h.state.start();
		await h.advance(0);
		h.subs[0].onClose("closed");
		await h.advance(RESUBSCRIBE_MS);
		expect(h.subs).toHaveLength(2);
	});

	it("ignores the close of a subscription it replaced", async () => {
		const fewer = snapshot();
		fewer.agents = [];
		const h = harness([snapshot(), fewer]);
		h.state.start();
		await h.advance(0);
		await h.advance(POLL_MS);
		h.subs[0].onClose("closed by plugin");
		await h.advance(RESUBSCRIBE_MS);
		expect(h.subs).toHaveLength(2);
	});

	it("a refresh still in flight at stop arms nothing", async () => {
		const h = harness([snapshot()]);
		h.state.start(); // snapshot request now pending
		h.state.stop();
		await h.advance(0);
		expect(h.subs).toHaveLength(0);
		expect(h.timers).toHaveLength(0);
	});

	it("stop cancels timers and closes the subscription", async () => {
		const h = harness([snapshot()]);
		h.state.start();
		await h.advance(0);
		h.state.stop();
		expect(h.subs[0].closed).toBe(true);
		expect(h.timers).toHaveLength(0);
		await h.advance(POLL_MS * 3);
		expect(h.call).toHaveBeenCalledTimes(1);
	});
});
