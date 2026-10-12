import { RoomView, type RoomActorView } from '@app/components/feature/room';
import { GameSceneFrame } from '@app/components/game-shell';
import { useNavigate } from 'react-router';

const facilities = [
  {
    id: '/game/beasts',
    sigil: '🐯',
    name: '灵兽袋',
    identity: '灵兽照料',
    responsibility: '查看、培养灵兽并安排出战',
    appearance: 'facility',
  },
  {
    id: '/game/beasts/warehouse',
    sigil: '🛖',
    name: '灵兽仓库',
    identity: '寄养之所',
    responsibility: '存取暂不出行的灵兽',
    appearance: 'facility',
  },
  {
    id: '/game/beasts/codex',
    sigil: '📖',
    name: '灵兽图鉴',
    identity: '物种图录',
    responsibility: '查阅资质、技能与出没之地',
    appearance: 'facility',
  },
  {
    id: '/game/beasts/fusion',
    sigil: '🧬',
    name: '灵兽融合',
    identity: '两灵相合',
    responsibility: '选择两只灵兽，预览融合造化',
    appearance: 'facility',
  },
] satisfies RoomActorView[];

export default function BeastRoomPage() {
  const navigate = useNavigate();
  return (
    <GameSceneFrame variant="workflow">
      <RoomView
        description="室内灵息温润。可照料随身灵兽，把暂不出行的伙伴寄入仓库，也可翻阅图录、引两灵相合。"
        actors={facilities}
        onSelect={(href) => navigate(href)}
        prompt="选择一处设施进行交互"
      />
    </GameSceneFrame>
  );
}
