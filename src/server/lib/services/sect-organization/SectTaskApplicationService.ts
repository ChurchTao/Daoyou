import type { SectTaskWorkflow } from './SectTaskWorkflow';

export type SectTaskOperations = Pick<
  SectTaskWorkflow,
  | 'getTasks'
  | 'acceptDaily'
  | 'startSweep'
  | 'completeSweep'
  | 'submitTaskItem'
  | 'challengeTask'
>;

export class SectTaskApplicationService {
  constructor(private readonly operations: SectTaskOperations) {}

  getTasks: SectTaskOperations['getTasks'] = (...args) =>
    this.operations.getTasks(...args);
  acceptDaily: SectTaskOperations['acceptDaily'] = (...args) =>
    this.operations.acceptDaily(...args);
  startSweep: SectTaskOperations['startSweep'] = (...args) =>
    this.operations.startSweep(...args);
  completeSweep: SectTaskOperations['completeSweep'] = (...args) =>
    this.operations.completeSweep(...args);
  submitTaskItem: SectTaskOperations['submitTaskItem'] = (...args) =>
    this.operations.submitTaskItem(...args);
  challengeTask: SectTaskOperations['challengeTask'] = (...args) =>
    this.operations.challengeTask(...args);
}
