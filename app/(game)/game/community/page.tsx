'use client';

import { InkPageShell, InkSection } from '@/components/layout';
import { InkButton } from '@/components/ui/InkButton';
import { InkNotice } from '@/components/ui/InkNotice';
import Image from 'next/image';

const QR_CODE_PATH = '/api/community/qrcode';
const QR_CODE_DOWNLOAD_PATH = '/api/community/qrcode?download=1';

export default function CommunityPage() {
  return (
    <InkPageShell
      title="玩家交流群"
      subtitle="与道友同修，共论仙途"
      backHref="/game"
    >
      <InkSection title="【群二维码】">
        <div className="border-ink/20 bg-paper mx-auto max-w-sm rounded-sm border border-dashed p-4">
          <Image
            src={QR_CODE_PATH}
            alt="万界道友玩家交流群二维码"
            width={560}
            height={560}
            className="mx-auto h-auto w-full max-w-[280px]"
          />
        </div>

        <div className="mt-4 flex justify-center gap-3">
          <InkButton href={QR_CODE_DOWNLOAD_PATH} variant="primary">
            💾 保存到相册
          </InkButton>
        </div>

        <InkNotice className="mt-4">
          若未自动下载，请打开原图后长按图片保存。
        </InkNotice>
      </InkSection>
    </InkPageShell>
  );
}
