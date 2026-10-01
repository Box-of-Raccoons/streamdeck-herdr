import { describe, expect, it } from "vitest";

import { DialBrowser, SNAP_BACK_MS } from "../src/dial.js";
import { dialFeedback, dialItems } from "../src/dialfeed.js";
import { STATUS_COLORS } from "../src/keys.js";
import { snapshot } from "./fixture.js";

const items = ["a", "b", "c", "d"].map((id) => ({ id }));
const idOf = (i: { id: string }) => i.id;

describe("DialBrowser", () => {
	it("shows herdr's current item until turned", () => {
		const b = new DialBrowser();
		expect(b.view(items, idOf, "c", 0)).toEqual({ item: { id: "c" }, index: 2, count: 4, current: true });
	});

	it("previews without switching, wrapping both ways", () => {
		const b = new DialBrowser();
		b.turn(items, idOf, "c", 1, 0);
		expect(b.view(items, idOf, "c", 10)).toMatchObject({ item: { id: "d" }, current: false });
		b.turn(items, idOf, "c", 1, 20);
		expect(b.view(items, idOf, "c", 30).item).toEqual({ id: "a" });
		b.turn(items, idOf, "c", -3, 40);
		expect(b.view(items, idOf, "c", 50).item).toEqual({ id: "b" });
	});

	it("commits the previewed item, then shows the current one again", () => {
		const b = new DialBrowser();
		b.turn(items, idOf, "c", -2, 0);
		expect(b.commit(items, idOf, "c", 10)).toBe("a");
		expect(b.previewing).toBe(false);
		expect(b.view(items, idOf, "c", 20).item).toEqual({ id: "c" });
	});

	it("commits nothing when the shown item is already current", () => {
		const b = new DialBrowser();
		expect(b.commit(items, idOf, "c", 0)).toBeNull();
		b.turn(items, idOf, "c", 4, 0); // full circle back to c
		expect(b.commit(items, idOf, "c", 10)).toBeNull();
	});

	it("snaps back after the quiet spell", () => {
		const b = new DialBrowser();
		b.turn(items, idOf, "c", 1, 1000);
		expect(b.view(items, idOf, "c", 1000 + SNAP_BACK_MS - 1).item).toEqual({ id: "d" });
		expect(b.view(items, idOf, "c", 1000 + SNAP_BACK_MS).item).toEqual({ id: "c" });
		expect(b.commit(items, idOf, "c", 1000 + SNAP_BACK_MS)).toBeNull();
	});

	it("drops a preview whose item vanished", () => {
		const b = new DialBrowser();
		b.turn(items, idOf, "c", 1, 0);
		expect(b.view(items.filter((i) => i.id !== "d"), idOf, "c", 10).item).toEqual({ id: "c" });
	});

	it("copes with an empty list", () => {
		const b = new DialBrowser();
		b.turn([], idOf, null, 1, 0);
		expect(b.view([], idOf, null, 0)).toEqual({ item: null, index: -1, count: 0, current: false });
		expect(b.commit([], idOf, null, 0)).toBeNull();
	});
});

describe("dialItems", () => {
	it("workspace: label, tab count and how many need you", () => {
		const { items: ws, currentId } = dialItems("workspace", snapshot());
		expect(currentId).toBe("w3");
		expect(ws[0]).toEqual({ id: "w3", name: "code", detail: "4 tabs · 2 need you", detailColor: STATUS_COLORS.blocked });
		expect(ws[1]).toEqual({ id: "w4", name: "docs", detail: "2 tabs · 1 needs you", detailColor: STATUS_COLORS.blocked });
	});

	it("tab: the focused workspace's tabs with names and status", () => {
		const { items: tabs, currentId } = dialItems("tab", snapshot());
		expect(currentId).toBe("w3:tH");
		expect(tabs.map((t) => [t.name, t.detail])).toEqual([
			["Custom macropad", "done"],
			["ULANZI viability", "idle"],
			["deckhand", "needs input"],
			["Usage gauges", "working"],
		]);
	});

	it("tab: says so when a tab has no agent", () => {
		const { items: tabs } = dialItems("tab", snapshot({ focused_workspace_id: "w4", focused_tab_id: "w4:t2" }));
		expect(tabs[1]).toMatchObject({ name: "shell", detail: "no agent" });
	});

	it("agent: those needing you first, current is the focused pane's agent", () => {
		const { items: agents, currentId } = dialItems("agent", snapshot());
		expect(currentId).toBe("w3:pQ");
		expect(agents[0]).toEqual({ id: "w3:pM", name: "deckhand", detail: "needs input · deckhand", detailColor: STATUS_COLORS.blocked });
		expect(agents[1].detail).toBe("done");
		expect(dialItems("agent", snapshot({ focused_pane_id: "w4:pB" })).currentId).toBeNull();
	});
});

describe("dialFeedback", () => {
	const item = { id: "x", name: "deckhand", detail: "needs input", detailColor: "#FF9F0A" };

	it("labels the current item plainly", () => {
		expect(dialFeedback("tab", { item, index: 2, count: 4, current: true })).toEqual({
			heading: { value: "TAB", color: "#8E8E93" },
			position: "3/4",
			name: { value: "deckhand", color: "#FFFFFF" },
			detail: { value: "needs input", color: "#FF9F0A" },
		});
	});

	it("says press to switch while previewing another item", () => {
		expect(dialFeedback("workspace", { item, index: 0, count: 2, current: false }).heading).toEqual({ value: "PRESS TO SWITCH", color: "#0A84FF" });
	});

	it("handles offline and empty", () => {
		expect(dialFeedback("agent", null).name.value).toBe("herdr offline");
		expect(dialFeedback("agent", { item: null, index: -1, count: 0, current: false })).toMatchObject({ position: "0/0", name: { value: "none" } });
	});
});
