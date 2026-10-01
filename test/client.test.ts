import { mkdtempSync } from "node:fs";
import { createServer, type Server, type Socket } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createCall, HerdrError, lineReader, socketPath, subscribe } from "../src/herdr/client.js";

/** A fake herdr: answers each request line with `reply(request, socket)`. */
function fakeHerdr(reply: (req: any, sock: Socket) => void): Promise<{ path: string; server: Server }> {
	const p = path.join(mkdtempSync(path.join(tmpdir(), "hd-")), "h.sock");
	const server = createServer((sock) => sock.on("data", lineReader((line) => reply(JSON.parse(line), sock))));
	return new Promise((resolve) => server.listen(p, () => resolve({ path: p, server })));
}

const servers: Server[] = [];
afterEach(() => {
	for (const s of servers.splice(0)) s.close();
});

async function start(reply: (req: any, sock: Socket) => void) {
	const h = await fakeHerdr(reply);
	servers.push(h.server);
	return h.path;
}

describe("createCall", () => {
	it("sends method and params and returns the result", async () => {
		let seen: any;
		const p = await start((req, sock) => {
			seen = req;
			sock.write(JSON.stringify({ id: req.id, result: { type: "pong" } }) + "\n");
		});
		expect(await createCall(p)("ping", { a: 1 })).toEqual({ type: "pong" });
		expect(seen).toMatchObject({ method: "ping", params: { a: 1 } });
		expect(seen.id).toMatch(/^sd_\d+$/);
	});

	it("reassembles a reply split across chunks and skips lines for other ids", async () => {
		const p = await start((req, sock) => {
			const line = JSON.stringify({ id: req.id, result: { ok: true } }) + "\n";
			sock.write(JSON.stringify({ id: "other", result: 1 }) + "\n" + line.slice(0, 5));
			setTimeout(() => sock.write(line.slice(5)), 10);
		});
		expect(await createCall(p)("x")).toEqual({ ok: true });
	});

	it("throws herdr's error code", async () => {
		const p = await start((req, sock) => sock.write(JSON.stringify({ id: req.id, error: { code: "agent_blocked", message: "blocked" } }) + "\n"));
		await expect(createCall(p)("agent.prompt")).rejects.toMatchObject({ code: "agent_blocked", message: "blocked" });
	});

	it("reports an unreachable socket and a silent one", async () => {
		await expect(createCall("/nonexistent/h.sock")("ping")).rejects.toMatchObject({ code: "unreachable" });
		const p = await start(() => {});
		await expect(createCall(p, 50)("ping")).rejects.toMatchObject({ code: "timeout" });
	});

	it("is a HerdrError", async () => {
		await expect(createCall("/nonexistent/h.sock")("ping")).rejects.toBeInstanceOf(HerdrError);
	});
});

describe("subscribe", () => {
	it("sends the subscription list and forwards pushed events", async () => {
		let subs: any;
		const p = await start((req, sock) => {
			subs = req.params.subscriptions;
			sock.write(JSON.stringify({ id: req.id, result: { type: "subscription_started" } }) + "\n");
			sock.write(JSON.stringify({ event: "tab_focused", data: { tab_id: "t1" } }) + "\n");
		});
		const events: unknown[] = [];
		await new Promise<void>((resolve) => {
			const s = subscribe(p, [{ type: "tab.focused" }], (e) => {
				events.push(e);
				s.close();
			}, () => resolve());
		});
		expect(subs).toEqual([{ type: "tab.focused" }]);
		expect(events).toEqual([{ event: "tab_focused", data: { tab_id: "t1" } }]);
	});

	it("closes with herdr's reason when the subscription is rejected", async () => {
		const p = await start((req, sock) => sock.write(JSON.stringify({ id: req.id, error: { code: "invalid_request", message: "missing field `pane_id`" } }) + "\n"));
		const reason = await new Promise<string>((resolve) => subscribe(p, [], () => {}, resolve));
		expect(reason).toBe("invalid_request: missing field `pane_id`");
	});

	it("reports onClose exactly once, even when the socket errors and then closes", async () => {
		const p = await start((req, sock) => sock.end());
		for (const target of [p, "/nonexistent/h.sock"]) {
			let closes = 0;
			await new Promise<void>((resolve) => {
				subscribe(target, [], () => {}, () => {
					closes++;
					setTimeout(resolve, 50);
				});
			});
			expect(closes).toBe(1);
		}
	});
});

it("socketPath prefers HERDR_SOCKET_PATH", () => {
	expect(socketPath({ HERDR_SOCKET_PATH: "/tmp/x.sock" }, "/Users/me")).toBe("/tmp/x.sock");
	expect(socketPath({}, "/Users/me")).toBe("/Users/me/.config/herdr/herdr.sock");
});
