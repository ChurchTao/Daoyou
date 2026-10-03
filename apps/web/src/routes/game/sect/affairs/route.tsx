import { SectTaskInteractionProvider } from '@app/components/feature/sect/SectTaskInteractionProvider';
import {
  SectPermissionBoundary,
  SectScene,
} from '@app/routes/game/sect/components/SectScene';
import { SectAffairsRoom } from './components/SectAffairsRoom';

export default function SectAffairsPage() {
  return (
    <SectPermissionBoundary permission="sect.tasks.use" sceneKey="affairs">
      <SectAffairsBody />
    </SectPermissionBoundary>
  );
}

function SectAffairsBody() {
  return (
    <SectTaskInteractionProvider>
      <SectScene sceneKey="affairs" mood="affairs">
        <SectAffairsRoom />
      </SectScene>
    </SectTaskInteractionProvider>
  );
}
