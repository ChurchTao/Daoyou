# Player State Realtime Cleanup Audit

Date: 2026-07-03

## Current Transport

- Main character state now initializes through `GET /api/player/state`.
- Live player-state updates use the `player-state` channel on `GET /api/realtime` WebSocket.
- `GET /api/player/state/events?after=` is still active as JSON backfill for WebSocket reconnect/version gaps. It is not an SSE stream.
- Retreat/yield `text/event-stream` code is action story streaming, not global player-state synchronization.

## Marked For Cleanup

- `src/server/routes/player.router.ts`: `GET /api/player/active` is marked as legacy. Current React code no longer calls it; remove after confirming no external/API clients depend on it.
- `src/shared/contracts/player.ts`: `PlayerCultivatorView`, `PlayerActiveData`, `PlayerActiveMeta`, and `PlayerActiveResponse` are marked deprecated with the same `/api/player/active` cleanup target.
- `docs/player-state-sync-redesign.md`: historical SSE plan is obsolete and should be treated as migration history, not current architecture.

## Keep

- `src/server/routes/player.router.ts`: `GET /api/player/state` is the authoritative snapshot endpoint.
- `src/server/routes/player.router.ts`: `GET /api/player/state/events?after=` is required for WebSocket gap recovery.
- `src/server/lib/services/playerStateBroadcaster.ts` publishes committed state events to live WebSocket subscribers.
- `src/react-app/lib/player-state/store.ts` applies WebSocket events and uses `/state/events` only as reconnect backfill.
- `src/server/routes/api/cultivator.router.ts`, `src/react-app/components/feature/cultivator/YieldCard.tsx`, and `src/react-app/routes/game/retreat/lib/retreatStream.ts` still use SSE-style streaming for long-running action/story responses; those are outside player-state realtime cleanup.

## Removal Follow-Up

1. Check access logs or API consumers for `GET /api/player/active`.
2. Remove the route and deprecated contract types when no callers remain.
3. Remove stale SSE sections from `docs/player-state-sync-redesign.md` or rewrite the document around WebSocket `/api/realtime`.
4. Keep `/api/player/state/events?after=` unless WebSocket resume tokens or replay-on-connect replace the current HTTP backfill path.
