import { SYSTEM_MAIL_CONVERSATION_ID } from '@app/lib/social/mailNavigation';
import { Navigate, useSearchParams } from 'react-router';

/** Preserve old inbox and targeted-gift links in the friends workspace. */
export default function MailPage() {
  const [params] = useSearchParams();
  const next = new URLSearchParams();
  if (params.get('tab') === 'friends' || params.has('addFriend')) {
    const target = params.get('addFriend');
    if (target) next.set('addFriend', target);
  } else if (params.get('composeTo')) {
    next.set('composeTo', params.get('composeTo')!);
    const conversation = params.get('conversation');
    if (conversation && conversation !== SYSTEM_MAIL_CONVERSATION_ID)
      next.set('chat', conversation);
  } else {
    next.set('chat', SYSTEM_MAIL_CONVERSATION_ID);
  }
  return (
    <Navigate replace to={`/game/friends${next.size ? `?${next}` : ''}`} />
  );
}
