/**
 * Key images as SVG strings, drawn at 144x144 on black. Every key has an offline
 * look (dimmed, "offline" caption) for when herdr isn't reachable.
 */
import type { AgentStatus } from "./herdr/types.js";
import type { WaitingFilter } from "./nav.js";

export const STATUS_COLORS: Record<AgentStatus, string> = {
	blocked: "#FF9F0A",
	done: "#30D158",
	working: "#0A84FF",
	idle: "#8E8E93",
	unknown: "#8E8E93",
};

const GREY = "#8E8E93";
const DIM = "#333333";
const FONT = `font-family="Helvetica Neue, Helvetica, Arial, sans-serif"`;

export type Icon = "next" | "prev" | "new" | "stop" | "zoom" | "layout" | "prompt";

function escapeXml(s: string): string {
	return s.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** `body` is dimmed when offline; the caption never is, so "offline" stays readable. */
function frame(body: string, offline: boolean, captionSvg = ""): string {
	const inner = offline ? `<g opacity="0.3">${body}</g>` : body;
	return `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144"><rect width="144" height="144" fill="#000000"/>${inner}${captionSvg}</svg>`;
}

function caption(text: string, color = GREY): string {
	return `<text x="72" y="130" text-anchor="middle" ${FONT} font-size="19" fill="${color}">${escapeXml(text)}</text>`;
}

/** Shortens text to fit a key caption. */
export function fitCaption(text: string, max = 12): string {
	const t = text.trim().replace(/\s+/g, " ");
	return t.length <= max ? t : t.slice(0, max - 1).trimEnd() + "…";
}

const STROKE = `fill="none" stroke="#FFFFFF" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"`;

const GLYPHS: Record<Icon, string> = {
	next: `<path d="M 58 30 L 90 62 L 58 94" ${STROKE}/>`,
	prev: `<path d="M 86 30 L 54 62 L 86 94" ${STROKE}/>`,
	new: `<path d="M 72 30 V 94 M 40 62 H 104" ${STROKE}/>`,
	stop: `<rect x="44" y="34" width="56" height="56" rx="8" fill="#FF453A"/>`,
	zoom: `<path d="M 40 50 V 34 H 56 M 88 34 H 104 V 50 M 104 74 V 90 H 88 M 56 90 H 40 V 74" ${STROKE.replace('stroke-width="9"', 'stroke-width="7"')}/>`,
	layout: `<rect x="34" y="30" width="76" height="64" rx="6" fill="none" stroke="#FFFFFF" stroke-width="6"/><path d="M 72 30 V 94 M 72 62 H 110" stroke="#FFFFFF" stroke-width="6"/>`,
	prompt: `<path d="M 36 32 H 108 Q 112 32 112 36 V 78 Q 112 82 108 82 H 64 L 46 96 V 82 H 36 Q 32 82 32 78 V 36 Q 32 32 36 32 Z" fill="none" stroke="#FFFFFF" stroke-width="6" stroke-linejoin="round"/>`,
};

/** A plain action key: a glyph and a caption. */
export function iconKey(icon: Icon, label: string, offline: boolean): string {
	return frame(GLYPHS[icon], offline, caption(offline ? "offline" : fitCaption(label)));
}

function badge(cx: number, cy: number, r: number, count: number, color: string, size: number): string {
	const fill = count > 0 ? color : DIM;
	const textColor = count > 0 ? "#000000" : GREY;
	const shown = count > 99 ? "99+" : String(count);
	const fontSize = shown.length > 2 ? Math.round(size * 0.62) : shown.length > 1 ? Math.round(size * 0.85) : size;
	return (
		`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>` +
		`<text x="${cx}" y="${cy + fontSize * 0.36}" text-anchor="middle" ${FONT} font-weight="bold" font-size="${fontSize}" fill="${textColor}">${shown}</text>`
	);
}

/**
 * The Needs-you key. "both" shows two rows: blocked (orange) and done (green).
 * A single filter shows one big badge. Zero counts are grey.
 */
export function needsYouKey(blocked: number, done: number, filter: WaitingFilter, offline: boolean): string {
	if (offline) return frame(badge(72, 60, 36, 0, DIM, 40), true, caption("offline"));
	if (filter === "blocked") return frame(badge(72, 60, 38, blocked, STATUS_COLORS.blocked, 42), false, caption("needs input"));
	if (filter === "done") return frame(badge(72, 60, 38, done, STATUS_COLORS.done, 42), false, caption("done"));
	const row = (cy: number, n: number, color: string, label: string) =>
		badge(42, cy, 24, n, color, 26) + `<text x="76" y="${cy + 7}" ${FONT} font-size="21" fill="${n > 0 ? "#FFFFFF" : GREY}">${label}</text>`;
	return frame(row(44, blocked, STATUS_COLORS.blocked, "input") + row(102, done, STATUS_COLORS.done, "done"), false);
}
