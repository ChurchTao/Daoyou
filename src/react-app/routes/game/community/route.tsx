import { GameSceneAsideSection, GameSceneFrame } from '@app/components/game-shell';
import { InkSection } from '@app/components/layout';
import { InkButton } from '@app/components/ui/InkButton';
import { InkNotice } from '@app/components/ui/InkNotice';

const QR_CODE_PATH = '/api/community/qrcode';
const QR_CODE_DOWNLOAD_PATH = '/api/community/qrcode?download=1';

export default function CommunityPage() {
  return (
    <GameSceneFrame
      variant="lite"
      title="玩家交流群"
      description="与道友同修，共论仙途。这里作为洞府之外的轻社交场景，二维码、入口与加入提醒都收束在同一页。"
      aside={
        <GameSceneAsideSection title="入群提醒" className="text-sm leading-7">
          <p>二维码会随官方群变化而更新，建议直接保存当前图。</p>
          <p className="mt-2">若无法下载，可打开原图后长按保存。</p>
        </GameSceneAsideSection>
      }
      actionBar={
        <div className="flex flex-wrap gap-2">
          <InkButton href={QR_CODE_DOWNLOAD_PATH} variant="primary">
            保存二维码
          </InkButton>
          <InkButton href="/game/world-chat">查看世界传音</InkButton>
          <InkButton href="/game/mail">返回玉简</InkButton>
        </div>
      }
    >
      <InkSection title="【群二维码】">
        <div className="border-ink/20 bg-paper mx-auto max-w-sm border border-dashed p-4">
          <img
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
    </GameSceneFrame>
  );
}
