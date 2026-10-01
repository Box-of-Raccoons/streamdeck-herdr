# herdr Control for Stream Deck

Drive [herdr](https://herdr.dev) from a Stream Deck: step through tabs, open tabs with an
agent in a chosen folder, jump to agents that need you, and browse workspaces, tabs and
agents on the Stream Deck+ dials. Each action stands alone, so put them on any key or dial
next to your other plugins.

Requires herdr 0.9 (socket protocol 22), Stream Deck 7.1 or later, and macOS 13 or later.

## Actions

| Action | Where | What it does |
| --- | --- | --- |
| Next Tab, Previous Tab | key | Focus the next or previous tab in the current workspace, wrapping around |
| New Tab | key | Open a tab in a folder (default: the focused pane's folder), optionally starting an agent (Claude, Codex, ...) |
| Needs You | key | Agents waiting for input (orange) and done (green). Press to jump to the first: input first, then whoever has waited longest. A setting limits it to one kind |
| Stop Agent | key | Send Esc to the focused agent |
| Send Prompt | key | Send fixed text (for example "continue") to the focused agent |
| Zoom Pane | key | Toggle zoom on the focused pane |
| Open Layout | key | Press **Capture** in its settings while a tab is arranged the way you like; the key then opens that layout as a new tab, optionally in another folder |
| Workspace Dial, Tab Dial, Agent Dial | dial | Turn to preview names on the touch strip; press the dial or tap the strip to switch. After 5 seconds without a press it shows the current one again |

Tabs labelled with herdr's default numbers show their agent's title on the tab dial instead.

**Terminal app** (in any action's settings) is shared by all of them: after switching, the
plugin brings that app forward so you see the change. It defaults to Terminal; turn
"Bring forward" off to leave windows alone.

There is deliberately no "approve" action for an agent's permission prompt: one bump would
approve something you haven't read.

## How it talks to herdr

It connects to herdr's socket (`~/.config/herdr/herdr.sock`, or `HERDR_SOCKET_PATH`) and
subscribes to workspace, tab and pane events, plus one agent-status subscription per agent
pane (herdr requires a pane id for those). It also re-reads herdr's state every 5 seconds in
case an event is missed. When herdr isn't running, keys go dim and say "offline".

## Develop

```sh
pnpm install
pnpm check                 # typecheck + tests
pnpm build
streamdeck link com.boxofraccoons.herdr.sdPlugin   # then restart the Stream Deck app once
streamdeck restart com.boxofraccoons.herdr        # after later builds
node scripts/make-images.ts                       # regenerate icons
```

`herdr api schema --json` is the reference for the socket API; the docs page lags behind it.
