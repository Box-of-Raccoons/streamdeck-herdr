# herdr actions for Stream Deck

## Why

Hardy runs Claude Code in herdr all day and wants the Stream Deck+ to drive it: step
through tabs, open a tab (optionally with an agent, in a chosen folder), jump to an agent
that needs him, and browse workspaces and tabs by name on the dials. It is its own Stream
Deck plugin, like the usage gauges, so it can be tried alone and published alone.

Changes from the earlier Deckhand plan (Obsidian, "Stream Deck Plus Control Deck"): herdr
control was going to live inside Deckhand next to Jira; now it is a separate plugin.

Prior art (2026-10-01): JJLiebig/herdr-plugins `stream-deck` takes over the whole deck
(pinned thread keys, inbox, actions page, all four dials). Resilient-Software/herdr-opendeck
mirrors workspaces as tiles. This plugin is the gap between them: separate actions that sit
on any key or dial next to other plugins.

## Decisions (2026-10-01, with Hardy)

- Own Stream Deck plugin, `com.boxofraccoons.herdr`, repo `~/code/streamdeck-herdr`.
  herdr-marketplace packaging (a `herdr-plugin.toml` that installs it) can come later.
- "Needs you" = `blocked` (orange) and `done` (green) as separate badges on one key, with a
  per-key filter (both / blocked / done). Press goes to blocked first, then the one that has
  waited longest (lowest `state_change_seq`).
- Navigation actions also bring the terminal app forward. One plugin-wide app picker,
  default Terminal (where herdr runs on the Mac mini), with an on/off switch.
- v1 actions. Keys: next tab, previous tab, new tab, needs you, stop, canned prompt, zoom,
  layout. Dials: workspace, tab, agent.
- Left out on purpose: an "approve" key that answers a blocked agent's prompt. One bump
  would approve an action nobody read.

## What the API gives (checked live on herdr 0.9.2, protocol 22, not just the docs page)

The docs page is stale in places; `herdr api schema --json` is the source of truth.

- Socket `~/.config/herdr/herdr.sock` (or `HERDR_SOCKET_PATH`), newline-delimited JSON,
  `{id, method, params}` -> `{id, result}` or `{id, error: {code, message}}`.
- `session.snapshot` -> `{snapshot: {focused_workspace_id, focused_tab_id, focused_pane_id,
  workspaces, tabs, panes, agents}}`, about 5 KB, about 100 ms with connect.
- No next/previous call: compute from snapshot order, then `tab.focus` / `workspace.focus`.
- `tab.create {workspace_id, cwd, label, focus, env}` -> `{root_pane, tab}` (the docs page
  omits `cwd`). Then `agent.start {name, kind, pane_id, args}`; names match
  `[a-z][a-z0-9_-]{0,31}`.
- `agent.focus`, `agent.prompt {target, text}`, `agent.send_keys {target, keys: [..]}`:
  `target` takes a pane id or an agent name (checked with `agent.get`).
- `pane.zoom {pane_id, mode}`, `layout.export {tab_id}` -> `{layout: {root}}` where pane
  nodes carry `cwd` and `command`; `layout.apply {workspace_id, tab_label, focus, root}`.
- Agent status: idle, working, blocked, done, unknown. No `seen` field: `done` already
  means finished and not looked at.
- Events: `events.subscribe {subscriptions: [{type}]}`. Workspace, tab, pane and layout
  events need no target, but `pane.agent_status_changed` REQUIRES `pane_id`. So the plugin
  subscribes to the global events plus one status subscription per agent pane, re-subscribes
  when the agent panes change, and also re-reads the snapshot every 5 s as a safety net.
- Agent kinds known to this herdr: pi, claude, codex, gemini, cursor, devin, agy, cline,
  opencode, copilot, kimi, kiro, droid, amp, grok, hermes, kilo, qodercli, qwen, letta,
  maki, muse.

## Design

- One `HerdrState` shared by every action: latest snapshot, online/offline, listeners.
  Actions draw from it; keys go dim with "offline" when herdr isn't reachable.
- Pure logic, tested without the SDK: tab/workspace stepping with wraparound, tab display
  names (a numeric label like "4" shows the agent's title instead), waiting order, agent
  dial order, agent name generation, layout cleanup for re-apply, and the dial browser
  (turn previews, press or tap commits, 5 s idle snaps back to the current item).
- Socket client tested against a fake herdr socket speaking the real protocol.

## Status

See the bottom of this file; updated as work lands.

### 2026-10-01

All 11 actions built. 70 tests; 43 mutations all caught (plus a no-op control that survives).
The first pass found three tests that could not fail (waiting-order tie, onClose on
error-then-close, stop during an in-flight refresh); each was strengthened and then caught.

Checked against the live herdr 0.9.2 on the Mac mini:
- the full 23-entry subscription list (with per-pane status entries) is accepted;
- events arrive: an unfocused probe tab created and closed produced tab_created,
  pane_created and tab_closed, with focus unchanged;
- dial items computed from the real snapshot read correctly (numeric tabs show agent titles).

Linked into the Stream Deck app; the plugin connects.

Open:
- On-device check of every action, especially the dials (the Virtual Stream Deck has none).
- Whether sdpi-file can pick a .app bundle (same question as the usage gauges).
- herdr-marketplace packaging, if wanted later.
- Name: "herdr" in a Marketplace listing may need herdr's permission.
