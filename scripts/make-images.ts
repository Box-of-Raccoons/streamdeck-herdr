/**
 * Writes the plugin's static images. Key images come from the same renderer the
 * keys use; list icons are white glyphs on transparent, as Elgato asks.
 * Run: node scripts/make-images.ts
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, renameSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { iconKey, needsYouKey } from "../src/keys.ts";

const root = path.join(import.meta.dirname, "..", "com.boxofraccoons.herdr.sdPlugin", "imgs");

/** A 40x40 white list icon from a path drawn in a 144 box. */
function listIcon(inner: string): string {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 144 144">${inner}</svg>`;
}
const S = `fill="none" stroke="#FFFFFF" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"`;
const strip = (label: string) =>
	`<rect x="14" y="40" width="116" height="64" rx="10" ${S.replace('stroke-width="12"', 'stroke-width="9"')}/><text x="72" y="84" text-anchor="middle" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-weight="bold" font-size="34" fill="#FFFFFF">${label}</text>`;

const ICONS: Record<string, string> = {
	"tab-next": `<path d="M 56 28 L 100 72 L 56 116" ${S}/>`,
	"tab-prev": `<path d="M 88 28 L 44 72 L 88 116" ${S}/>`,
	"tab-new": `<path d="M 72 28 V 116 M 28 72 H 116" ${S}/>`,
	"needs-you": `<circle cx="72" cy="72" r="46" ${S}/><path d="M 72 46 V 78 M 72 98 V 99" ${S}/>`,
	"agent-stop": `<rect x="34" y="34" width="76" height="76" rx="10" fill="#FFFFFF"/>`,
	"agent-prompt": `<path d="M 30 30 H 114 V 94 H 64 L 40 114 V 94 H 30 Z" ${S}/>`,
	"pane-zoom": `<path d="M 30 56 V 30 H 56 M 88 30 H 114 V 56 M 114 88 V 114 H 88 M 56 114 H 30 V 88" ${S}/>`,
	layout: `<rect x="26" y="28" width="92" height="88" rx="8" ${S}/><path d="M 72 28 V 116 M 72 72 H 118" ${S}/>`,
	"dial-workspace": strip("WS"),
	"dial-tab": strip("TAB"),
	"dial-agent": strip("AI"),
};

/** Dials show their strip text, but Stream Deck still wants a state image. */
function dialKey(label: string): string {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144"><rect width="144" height="144" fill="#000000"/>${strip(label)}</svg>`;
}

const KEYS: Record<string, string> = {
	"tab-next": iconKey("next", "Next tab", false),
	"tab-prev": iconKey("prev", "Prev tab", false),
	"tab-new": iconKey("new", "New tab", false),
	"needs-you": needsYouKey(0, 0, "both", false),
	"agent-stop": iconKey("stop", "Stop", false),
	"agent-prompt": iconKey("prompt", "Prompt", false),
	"pane-zoom": iconKey("zoom", "Zoom", false),
	layout: iconKey("layout", "Layout", false),
	"dial-workspace": dialKey("WS"),
	"dial-tab": dialKey("TAB"),
	"dial-agent": dialKey("AI"),
};

for (const [name, svg] of Object.entries(ICONS)) {
	const dir = path.join(root, "actions", name);
	mkdirSync(dir, { recursive: true });
	writeFileSync(path.join(dir, "icon.svg"), listIcon(svg));
	writeFileSync(path.join(dir, "key.svg"), KEYS[name]);
}

mkdirSync(path.join(root, "plugin"), { recursive: true });
writeFileSync(path.join(root, "plugin", "category-icon.svg"), `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 144 144"><path d="M 30 44 H 114 M 30 72 H 114 M 30 100 H 80" ${S}/></svg>`);

function rasterize(svg: string, px: number, out: string): void {
	const dir = mkdtempSync(path.join(tmpdir(), "herdr-img-"));
	const src = path.join(dir, "img.svg");
	writeFileSync(src, svg);
	execFileSync("qlmanage", ["-t", "-s", String(px), "-o", dir, src], { stdio: "ignore" });
	renameSync(`${src}.png`, out);
}
const marketplace = needsYouKey(1, 2, "both", false);
rasterize(marketplace, 256, path.join(root, "plugin", "marketplace.png"));
rasterize(marketplace, 512, path.join(root, "plugin", "marketplace@2x.png"));
