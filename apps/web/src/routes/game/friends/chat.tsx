import { Navigate, useParams, useSearchParams } from 'react-router';

/** Keep old private-chat links pointed at the single friends workspace. */
export default function DirectChatPage() {
  const { conversationId } = useParams();
  const [params] = useSearchParams();
  const next = new URLSearchParams(params);
  if (conversationId) next.set('chat', conversationId);
  return <Navigate replace to={`/game/friends?${next}`} />;
}
