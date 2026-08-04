export type HighlightColor = 'yellow' | 'green' | 'pink' | 'blue';

export interface HighlightItem {
  id: string;
  start: number;
  end: number;
  color: HighlightColor;
  text: string;
}

export interface Point {
  x: number; // Normalized (0 to 1) relative to canvas width
  y: number; // Normalized (0 to 1) relative to canvas height
}

export interface DrawingPath {
  id: string;
  color: string;
  thickness: number;
  points: Point[];
  isEraser?: boolean;
}

export type AnnotationMode = 'select' | 'draw';
export type DrawingTool = 'pen' | 'eraser';
