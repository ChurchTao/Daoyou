import { realtimeClient } from '@app/lib/realtime/realtimeClient';
import type { PartyView, PartyVitalsView } from '@daoyou/contracts/party';
import { useEffect, useState } from 'react';
import { requestParty } from './partyWorkspaceApi';

export function usePartyVitals(
  actorId: string,
  party?: PartyView,
  updates: 'all' | 'presence' = 'all',
) {
  const partyId = party?.id;
  const key =
    actorId && party ? `${actorId}:${party.id}:${party.revision}` : '';
  const [result, setResult] = useState<{
    key: string;
    data?: PartyVitalsView;
    error?: boolean;
  }>();

  useEffect(() => {
    if (!partyId || !key) return;
    const request = new AbortController();
    let loading = false;
    let queued = false;

    async function refresh() {
      if (request.signal.aborted || document.hidden) return;
      if (loading) {
        queued = true;
        return;
      }
      loading = true;
      try {
        const data = await requestParty<PartyVitalsView>(`/${partyId}/vitals`, {
          signal: request.signal,
        });
        if (!request.signal.aborted) setResult({ key, data });
      } catch {
        if (!request.signal.aborted) setResult({ key, error: true });
      } finally {
        loading = false;
        if (queued) {
          queued = false;
          void refresh();
        }
      }
    }

    const reconnect = realtimeClient.subscribe('ready', refresh);
    const refreshParty = ({ payload }: { payload: { partyId: string } }) => {
      if (payload.partyId === partyId) void refresh();
    };
    const presenceChanged = realtimeClient.subscribe(
      'party.presence.changed',
      refreshParty,
    );
    const vitalsChanged =
      updates === 'all'
        ? realtimeClient.subscribe('party.vitals.changed', refreshParty)
        : undefined;
    document.addEventListener('visibilitychange', refresh);
    void refresh();
    return () => {
      request.abort();
      document.removeEventListener('visibilitychange', refresh);
      reconnect();
      presenceChanged();
      vitalsChanged?.();
    };
  }, [key, partyId, updates]);

  return result?.key === key ? result : undefined;
}
