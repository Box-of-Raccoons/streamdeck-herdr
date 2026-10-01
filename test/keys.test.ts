import { describe, expect, it } from "vitest";

import { fitCaption, iconKey, needsYouKey, STATUS_COLORS } from "../src/keys.js";

const texts = (svg: string) => [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
const circles = (svg: string) => [...svg.matchAll(/<circle [^>]*fill="([^"]+)"/g)].map((m) => m[1]);

describe("needsYouKey", () => {
	it("shows blocked (orange) and done (green) as separate badges", () => {
		const svg = needsYouKey(2, 1, "both", false);
		expect(texts(svg)).toEqual(["2", "input", "1", "done"]);
		expect(circles(svg)).toEqual([STATUS_COLORS.blocked, STATUS_COLORS.done]);
	});

	it("greys out a zero count", () => {
		expect(circles(needsYouKey(0, 3, "both", false))).toEqual(["#333333", STATUS_COLORS.done]);
	});

	it("shows one big badge for a single filter", () => {
		expect(texts(needsYouKey(2, 5, "blocked", false))).toEqual(["2", "needs input"]);
		expect(texts(needsYouKey(2, 5, "done", false))).toEqual(["5", "done"]);
		expect(circles(needsYouKey(2, 5, "done", false))).toEqual([STATUS_COLORS.done]);
	});

	it("caps big counts and shrinks them to fit", () => {
		const svg = needsYouKey(120, 0, "both", false);
		expect(texts(svg)[0]).toBe("99+");
		expect(svg).toMatch(/font-size="16" fill="#000000">99\+/);
	});

	it("says offline, without dimming the caption", () => {
		const svg = needsYouKey(3, 3, "both", true);
		expect(texts(svg)).toEqual(["0", "offline"]);
		expect(svg).toMatch(/<\/g><text[^>]*>offline<\/text>/);
	});
});

describe("iconKey", () => {
	it("captions the key, or says offline and dims the glyph", () => {
		expect(texts(iconKey("next", "Next tab", false))).toEqual(["Next tab"]);
		const off = iconKey("next", "Next tab", true);
		expect(texts(off)).toEqual(["offline"]);
		expect(off).toContain('<g opacity="0.3">');
	});

	it("escapes caption text", () => {
		expect(iconKey("prompt", "a<b&c", false)).toContain("a&#60;b&#38;c");
	});
});

it("fitCaption trims long captions with an ellipsis", () => {
	expect(fitCaption("continue please now")).toBe("continue pl…");
	expect(fitCaption("  short  ")).toBe("short");
	expect(fitCaption("exactly12chr")).toBe("exactly12chr");
});
