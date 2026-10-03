import { GameSceneLoading } from '@app/components/game-shell';
import { Suspense } from 'react';
import { TasksView } from './components/TasksView';

export default function TasksPage() {
  return (
    <Suspense fallback={<GameSceneLoading message="卷宗整理中……" />}>
      <TasksView />
    </Suspense>
  );
}
