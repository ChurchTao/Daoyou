import { playerStoryResource } from '@app/lib/resources/definitions';
import { useResource } from '@app/lib/resources/hooks';

export function useStory(enabled = true) {
  const query = useResource(playerStoryResource, undefined, enabled);
  return {
    story: query.data,
    loading: query.loading,
    error: query.error,
    reload: query.reload,
  };
}
