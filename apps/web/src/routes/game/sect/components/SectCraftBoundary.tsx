import { useSectContextQuery } from '@app/components/feature/sect/sectResources';
import { useStory } from '@app/lib/story/useStory';
import { useState, type ReactNode } from 'react';
import {
  SectPageLoading,
  SectPermissionBoundary,
  SectQueryError,
} from './SectScene';

export function SectCraftBoundary({
  sceneKey,
  children,
}: {
  sceneKey: 'alchemy' | 'refinery';
  children: (classroom: boolean) => ReactNode;
}) {
  const context = useSectContextQuery();
  const permission = `sect.facility.${sceneKey}.use` as const;
  const regularAccess = Boolean(context.data?.permissions[permission]?.granted);
  const activeMembership = context.data?.status === 'active';
  const story = useStory(activeMembership && !regularAccess);
  const [classroomMembership, setClassroomMembership] = useState<string>();
  const eligible =
    activeMembership &&
    story.story?.chapterId === 'arrival' &&
    story.story.kind === 'practice' &&
    story.story.beatId === (sceneKey === 'alchemy' ? 'hearth' : 'forge') &&
    story.story.scene === `sect-${sceneKey}`;
  const membershipId = context.data?.membershipId;
  if (eligible && membershipId && classroomMembership !== membershipId)
    setClassroomMembership(membershipId);

  if (context.error)
    return (
      <SectQueryError error={context.error} retry={() => void context.retry()} />
    );
  if (!context.data) return <SectPageLoading sceneKey={sceneKey} />;
  if (regularAccess) return children(false);
  // Keep the completed craft visible until the player leaves this classroom.
  if (
    activeMembership &&
    (eligible || classroomMembership === context.data.membershipId)
  )
    return children(true);
  if (activeMembership && story.loading)
    return <SectPageLoading sceneKey={sceneKey} />;
  if (activeMembership && story.error)
    return (
      <SectQueryError error={story.error} retry={() => void story.reload()} />
    );
  return (
    <SectPermissionBoundary permission={permission} sceneKey={sceneKey}>
      {children(false)}
    </SectPermissionBoundary>
  );
}
