'use client';

import { InkPageShell, InkSection } from '@/components/layout';
import { MailDetailModal } from '@/components/mail/MailDetailModal';
import { Mail, MailList } from '@/components/mail/MailList';
import { useCallback, useEffect, useState } from 'react';

export default function MailPage() {
  const [mails, setMails] = useState<Mail[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMail, setSelectedMail] = useState<Mail | null>(null);

  const fetchMails = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/cultivator/mail');
      const data = await res.json();
      if (res.ok) {
        setMails(data.mails || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMails();
  }, [fetchMails]);

  const handleSelectMail = async (mail: Mail) => {
    setSelectedMail(mail);

    // Mark as read if not already
    if (!mail.isRead) {
      try {
        await fetch('/api/cultivator/mail/read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mailId: mail.id }),
        });
        // Optimistic update locally
        setMails((prev) =>
          prev.map((m) => (m.id === mail.id ? { ...m, isRead: true } : m)),
        );
      } catch (e) {
        console.error('Failed to mark read', e);
      }
    }
  };

  const handleUpdate = () => {
    fetchMails();
    // If updating from modal (e.g. claim), we might want to update selectedMail too if it's open,
    // but typically we close modal after claim?
    // If modal stays open, we might need to refresh `selectedMail` state.
    // Current modal implementation closes on success.
    // If we just claimed, the list is refreshed.
  };

  return (
    <InkPageShell
      title="传音玉简"
      subtitle="鸿雁长飞光不度，鱼龙潜跃水成文"
      backHref="/game"
    >
      <InkSection title="【收件箱】">
        {loading ? (
          <div className="text-center py-8 opacity-50 text-sm">
            正在接收灵讯...
          </div>
        ) : (
          <MailList mails={mails} onSelect={handleSelectMail} />
        )}
      </InkSection>

      <MailDetailModal
        mail={selectedMail}
        onClose={() => setSelectedMail(null)}
        onUpdate={handleUpdate}
      />
    </InkPageShell>
  );
}
