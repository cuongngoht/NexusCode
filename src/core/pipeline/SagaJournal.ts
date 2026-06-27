export type SagaStepStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'compensating'
  | 'compensated'
  | 'failed';

export interface SagaJournalEntry {
  readonly stepLabel: string;
  readonly startedAt: number;
  completedAt?: number;
  status: SagaStepStatus;
  error?: string;
}

export type SagaJournal = SagaJournalEntry[];
