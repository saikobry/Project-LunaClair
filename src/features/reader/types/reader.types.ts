export interface PopoverState {
  x: number;
  y: number;
  visible: boolean;
  targetHighlightId?: string;
  pendingSelection?: {
    start: number;
    end: number;
    text: string;
  };
}
