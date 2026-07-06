# Player State Realtime

Date: 2026-07-06

## Current Transport

- Main character state now initializes through `GET /api/player/state`.
- Live player-state updates use the `player-state` channel on `GET /api/realtime` WebSocket.
- `GET /api/player/state/events?after=` is still active as JSON backfill for WebSocket reconnect/version gaps. It is not an SSE stream.
- Retreat/yield `text/event-stream` code is action story streaming, not global player-state synchronization.

## Current Code

- `src/server/routes/player.router.ts`: `GET /api/player/state` is the authoritative snapshot endpoint.
- `src/server/routes/player.router.ts`: `GET /api/player/state/events?after=` is required for WebSocket gap recovery.
- `src/server/lib/services/playerStateBroadcaster.ts` publishes committed state events to live WebSocket subscribers.
- `src/react-app/lib/player-state/store.ts` applies WebSocket events and uses `/state/events` only as reconnect backfill.
- `src/server/routes/api/realtime.router.ts` owns the WebSocket connection, heartbeat, channel subscription, and per-user/cultivator/IP connection caps.
- `src/shared/contracts/realtime.ts` defines the active realtime channels: `player-state` and `world-chat`.

## Removed Legacy Paths

- `GET /api/player/active` has been removed. Use `GET /api/player/state`.
- Legacy `/api/player/active` contract types have been removed from `src/shared/contracts/player.ts`.
- The obsolete SSE redesign document has been removed. Do not use old SSE examples as current architecture.

## Migration Notes

- Keep `/api/player/state/events?after=` unless WebSocket resume tokens or replay-on-connect replace the current HTTP backfill path.
- Do not reintroduce `EventSource` or SSE for global player-state synchronization.
- New player-state mutations should go through `commitPlayerStateMutation()` so API responses and WebSocket subscribers receive the same versioned events.
