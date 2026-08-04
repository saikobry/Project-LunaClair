import { useRef, useEffect, useCallback } from 'react';
import type { DrawingPath, Point } from '../../../domain/reader';

interface DrawingCanvasProps {
  paths: DrawingPath[];
  onPathsChange: (paths: DrawingPath[]) => void;
  active: boolean;
  currentColor: string;
  brushThickness: number;
  isEraser: boolean;
}

export default function DrawingCanvas({
  paths,
  onPathsChange,
  active,
  currentColor,
  brushThickness,
  isEraser,
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDrawingRef = useRef<boolean>(false);
  const currentPointsRef = useRef<Point[]>([]);
  const rectRef = useRef<DOMRect | null>(null);

  // Redraw all saved paths
  const drawAllPaths = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    paths.forEach((path) => {
      if (path.points.length === 0) return;
      ctx.beginPath();
      ctx.globalCompositeOperation = path.isEraser ? 'destination-out' : 'source-over';
      ctx.strokeStyle = path.color;
      ctx.lineWidth = path.thickness;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const firstPoint = path.points[0];
      ctx.moveTo(firstPoint.x * canvas.width, firstPoint.y * canvas.height);
      for (let i = 1; i < path.points.length; i++) {
        const p = path.points[i];
        ctx.lineTo(p.x * canvas.width, p.y * canvas.height);
      }
      ctx.stroke();
    });

    // Always reset back to normal drawing mode
    ctx.globalCompositeOperation = 'source-over';
  }, [paths]);

  // Keep drawing updated when paths change
  useEffect(() => {
    drawAllPaths();
  }, [drawAllPaths]);

  // Handle Resize using ResizeObserver on parent container
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const resizeCanvas = () => {
      const rect = parent.getBoundingClientRect();
      // Only resize if boundaries actually changed to prevent loops
      if (canvas.width !== rect.width || canvas.height !== rect.height) {
        canvas.width = rect.width;
        canvas.height = rect.height;
        drawAllPaths();
      }
    };

    resizeCanvas();

    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
    });
    resizeObserver.observe(parent);

    return () => {
      resizeObserver.disconnect();
    };
  }, [drawAllPaths]);

  const getCanvasCoords = (e: React.MouseEvent | React.TouchEvent): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = rectRef.current || canvas.getBoundingClientRect();

    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height,
    };
  };

  const handleStart = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Cache the rect to avoid layout thrashing on mousemove
    rectRef.current = canvas.getBoundingClientRect();

    const pt = getCanvasCoords(e);
    if (!pt) return;

    // Prevent default touch behavior (like scrolling) when drawing
    if ('touches' in e) {
      e.preventDefault();
    }

    isDrawingRef.current = true;
    currentPointsRef.current = [pt];

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = brushThickness;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(pt.x * canvas.width, pt.y * canvas.height);
  };

  const handleMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!active || !isDrawingRef.current) return;
    const pt = getCanvasCoords(e);
    if (!pt) return;

    if ('touches' in e) {
      e.preventDefault();
    }

    currentPointsRef.current.push(pt);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
    ctx.lineTo(pt.x * canvas.width, pt.y * canvas.height);
    ctx.stroke();
  };

  const handleEnd = () => {
    if (!active || !isDrawingRef.current) return;
    isDrawingRef.current = false;
    rectRef.current = null; // Clear cached rect

    if (currentPointsRef.current.length > 0) {
      const newPath = {
        id: Math.random().toString(36).substring(2, 9),
        color: currentColor,
        thickness: brushThickness,
        points: [...currentPointsRef.current],
        isEraser: isEraser,
      };
      onPathsChange([...paths, newPath]);
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: active ? 'auto' : 'none',
        zIndex: 5,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          cursor: active ? 'crosshair' : 'default',
        }}
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
      />
    </div>
  );
}
