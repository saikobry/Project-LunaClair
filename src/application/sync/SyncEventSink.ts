export interface SyncAppliedEvent {
  appliedCount: number;
  touchedEntities: readonly string[];
}

export interface SyncEventSink {
  onApplied(event: SyncAppliedEvent): void;
}
