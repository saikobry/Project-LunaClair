/**
 * Public contract of the canvas authoring sub-feature. Deliberately tiny:
 * only `QuizCanvasBuilder` is exported — the canvas screen consumed by the
 * app shell via the feature barrel (`src/features/quiz-management`). The
 * canvas's state (`useQuizCanvas`), lifecycle (`useQuizCanvasEditor`), motion
 * engine, and debug tooling (`QuizCanvasPinVisualizer`) are internal and must
 * not leak past this barrel.
 */
export { QuizCanvasBuilder } from './QuizCanvasBuilder';
