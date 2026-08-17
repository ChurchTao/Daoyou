import {
  playerConditionResource,
  playerCurrencyResource,
  playerLoadoutResource,
  playerMailSummaryResource,
  playerProfileResource,
  playerProgressResource,
  playerSessionResource,
  playerTaskSummaryResource,
  sectContextResource,
  sectProgressionResource,
} from '@app/lib/resources/definitions';
import { useSingletonResource } from '@app/lib/resources/hooks';

export function usePlayerSession(enabled = true) {
  return useSingletonResource(playerSessionResource, enabled);
}

export function useCultivatorIdentity(enabled = true) {
  return useSingletonResource(playerProfileResource, enabled);
}

export function useCultivatorCondition(enabled = true) {
  return useSingletonResource(playerConditionResource, enabled);
}

export function useCultivatorProgress(enabled = true) {
  return useSingletonResource(playerProgressResource, enabled);
}

export function useCultivatorCurrency(enabled = true) {
  return useSingletonResource(playerCurrencyResource, enabled);
}

export function usePlayerLoadout(enabled = true) {
  return useSingletonResource(playerLoadoutResource, enabled);
}

export function useUnreadMailCount() {
  const query = usePlayerMailSummary();
  return query.data?.unreadCount;
}

export function usePlayerMailSummary() {
  return useSingletonResource(playerMailSummaryResource);
}

export function useTaskSummary() {
  return useSingletonResource(playerTaskSummaryResource);
}

export function useSectMembership() {
  return useSingletonResource(sectContextResource);
}

export function useSectProgression() {
  return useSingletonResource(sectProgressionResource);
}
