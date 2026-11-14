import { MailAttachmentSlot } from '@app/components/mail/MailAttachmentSlot';
import type { Mail } from '@app/components/mail/types';
import { GameIcon } from '@app/components/ui/GameIcon';
import { InkButton } from '@app/components/ui/InkButton';

export function SystemMailLetter({
  mail,
  pending,
  claimDisabled,
  onClaim,
  claimError,
}: {
  mail: Mail;
  pending: boolean;
  claimDisabled: boolean;
  onClaim: () => void;
  claimError?: string;
}) {
  const hasAttachments = Boolean(mail.attachments?.length);

  return (
    <article aria-label={mail.title} data-mail-id={mail.id} className="pb-4">
      <header className="mb-5">
        <h3 className="text-base leading-7 font-semibold break-words">
          {mail.title}
        </h3>
        <time
          dateTime={mail.createdAt}
          className="text-ink-secondary mt-1 block font-mono text-xs"
        >
          {new Date(mail.createdAt).toLocaleString('zh-CN')}
        </time>
      </header>
      <div className="text-ink text-sm leading-7 break-words whitespace-pre-wrap">
        {mail.content}
      </div>
      {hasAttachments ? (
        <section className="mt-5" aria-label="信件附件">
          <h4 className="text-ink-secondary mb-2 text-sm">附件</h4>
          <div className="grid max-w-md grid-cols-[repeat(auto-fill,minmax(4rem,1fr))] gap-2">
            {mail.attachments?.map((attachment, index) => (
              <MailAttachmentSlot key={index} attachment={attachment} />
            ))}
          </div>
          <div className="mt-3 flex min-h-11 items-center">
            {mail.isClaimed ? (
              <span role="status" aria-label="附件已领取">
                <InkButton disabled className="min-h-11">
                  <GameIcon value="✓" className="mr-1" />
                  已领取
                </InkButton>
              </span>
            ) : (
              <InkButton
                variant="primary"
                className="min-h-11"
                pending={pending}
                pendingLabel="领取中……"
                disabled={claimDisabled}
                onClick={onClaim}
              >
                领取附件
              </InkButton>
            )}
          </div>
        </section>
      ) : null}
      {claimError ? (
        <p role="alert" className="text-crimson mt-2 text-sm leading-6">
          {claimError}
        </p>
      ) : null}
    </article>
  );
}
