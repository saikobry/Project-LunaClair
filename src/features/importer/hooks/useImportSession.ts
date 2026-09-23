import { useState, useCallback, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ImportSession, ImportCandidate, ExtractionProgress } from '../../../domain/importer/models/importer.types';
import { useImporterContext } from './useImporterContext';
import type { StudyMaterial } from '../../../domain/library/models/StudyMaterial';
import { materialQueryKeys } from '../../materials/queries/materialQueryKeys';

export function useImportSession() {
  const { extractContent, commitImport } = useImporterContext();
  const queryClient = useQueryClient();
  
  const [session, setSession] = useState<ImportSession>({
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    candidates: [],
    status: 'selecting',
  });
  
  const [createdMaterials, setCreatedMaterials] = useState<StudyMaterial[]>([]);
  const [activeCandidateIndex, setActiveCandidateIndex] = useState(0);
  const [ocrEngine, setOcrEngine] = useState<'tesseract' | 'ai-vision'>('tesseract');
  const [progressMap, setProgressMap] = useState<Record<string, ExtractionProgress>>({});
  const abortControllers = useRef<Map<string, AbortController>>(new Map());
  const isCancelledRef = useRef(false);
  const queueRef = useRef<ImportCandidate[]>([]);
  const candidatesRef = useRef<ImportCandidate[]>(session.candidates);

  useEffect(() => {
    candidatesRef.current = session.candidates;
  }, [session.candidates]);

  const addFiles = useCallback((files: File[]) => {
    const newCandidates: ImportCandidate[] = files.map(file => ({
      id: crypto.randomUUID(),
      filename: file.name,
      source: file.type === 'application/pdf' ? 'pdf' : 'image',
      file,
      status: 'pending',
    }));
    
    setSession(prev => ({
      ...prev,
      candidates: [...prev.candidates, ...newCandidates],
    }));
  }, []);

  const removeFile = useCallback((id: string) => {
    setSession(prev => ({
      ...prev,
      candidates: prev.candidates.filter(c => c.id !== id),
    }));
  }, []);

  const startExtraction = useCallback(async () => {
    isCancelledRef.current = false;
    setSession(prev => ({ ...prev, status: 'extracting' }));
    
    const candidates = session.candidates.filter(c => c.status === 'pending' || c.status === 'error');
    if (candidates.length === 0) {
      const hasReview = session.candidates.some(c => c.status === 'review');
      setSession(prev => ({ ...prev, status: hasReview ? 'review' : 'selecting' }));
      return;
    }

    queueRef.current = [...candidates];

    const processNext = async (): Promise<void> => {
      if (isCancelledRef.current || queueRef.current.length === 0) return;
      const candidate = queueRef.current.shift()!;
      
      const ac = new AbortController();
      abortControllers.current.set(candidate.id, ac);

      candidatesRef.current = candidatesRef.current.map(c =>
        c.id === candidate.id ? { ...c, status: 'extracting' } : c,
      );
      setSession(prev => ({
        ...prev,
        candidates: prev.candidates.map(c =>
          c.id === candidate.id ? { ...c, status: 'extracting' } : c,
        ),
      }));

      try {
        const result = await extractContent.execute(candidate.file, {
          signal: ac.signal,
          ocrEngine,
          onProgress: (progress) => {
            setProgressMap(prev => ({ ...prev, [candidate.id]: progress }));
          },
        });
        
        candidatesRef.current = candidatesRef.current.map(c =>
          c.id === candidate.id ? { ...c, ...result } : c,
        );
        setSession(prev => ({
          ...prev,
          candidates: prev.candidates.map(c => (c.id === candidate.id ? { ...c, ...result } : c)),
        }));
      } catch (err: unknown) {
        const isAborted = ac.signal.aborted || (err instanceof Error && err.name === 'AbortError');
        const message = isAborted
          ? 'Extraction was cancelled.'
          : err instanceof Error
          ? err.message
          : 'Extraction failed';
        const errorCandidate: ImportCandidate = {
          ...candidate,
          status: 'error',
          error: {
            code: isAborted ? 'cancelled' : 'extraction-failed',
            message,
            retryable: !isAborted,
          },
        };
        candidatesRef.current = candidatesRef.current.map(c =>
          c.id === candidate.id ? errorCandidate : c,
        );
        setSession(prev => ({
          ...prev,
          candidates: prev.candidates.map(c => (c.id === candidate.id ? errorCandidate : c)),
        }));
      } finally {
        abortControllers.current.delete(candidate.id);
        if (!isCancelledRef.current && queueRef.current.length > 0) {
          await processNext();
        }
      }
    };

    const workers = Array(Math.min(2, queueRef.current.length)).fill(null).map(() => processNext());
    await Promise.all(workers);
    
    const wasCancelled = isCancelledRef.current;
    const currentCandidates = candidatesRef.current;
    const hasReview = currentCandidates.some(c => c.status === 'review');
    const firstReviewIdx = currentCandidates.findIndex(c => c.status === 'review');

    if (!wasCancelled && hasReview && firstReviewIdx !== -1) {
      setActiveCandidateIndex(firstReviewIdx);
    }

    setSession(prev => ({
      ...prev,
      status: (!wasCancelled && hasReview) ? 'review' : 'selecting',
    }));
  }, [session.candidates, extractContent, ocrEngine, setActiveCandidateIndex]);

  const cancelExtraction = useCallback((id?: string) => {
    if (id) {
      queueRef.current = queueRef.current.filter(c => c.id !== id);
      const ac = abortControllers.current.get(id);
      if (ac) ac.abort();
    } else {
      isCancelledRef.current = true;
      queueRef.current = [];
      abortControllers.current.forEach(ac => ac.abort());
      // If no controllers were active, transition to selecting immediately
      if (abortControllers.current.size === 0) {
        setSession(prev => (prev.status === 'extracting' ? { ...prev, status: 'selecting' } : prev));
      }
    }
  }, []);

  const retryCandidate = useCallback((id: string) => {
    setSession(prev => ({
      ...prev,
      candidates: prev.candidates.map(c =>
        c.id === id
          ? {
              ...c,
              status: 'pending' as const,
              extraction: undefined,
              markdown: undefined,
              title: undefined,
              error: undefined,
              pageDetails: undefined,
            }
          : c,
      ),
    }));
  }, []);

  const updateCandidateMarkdown = useCallback((id: string, markdown: string) => {
    setSession(prev => ({
      ...prev,
      candidates: prev.candidates.map(c => c.id === id ? { ...c, markdown } : c),
    }));
  }, []);
  
  const updateCandidateTitle = useCallback((id: string, title: string) => {
    setSession(prev => ({
      ...prev,
      candidates: prev.candidates.map(c => c.id === id ? { ...c, title } : c),
    }));
  }, []);

  const commitSession = useCallback(async () => {
    setSession(prev => ({ ...prev, status: 'saving' }));

    const results: StudyMaterial[] = [];

    for (const candidate of session.candidates) {
      if (candidate.status === 'review' && candidate.markdown && candidate.title && candidate.importMetadata) {
        const material = await commitImport.execute({
          title: candidate.title,
          markdown: candidate.markdown,
          file: candidate.file,
          importMetadata: candidate.importMetadata,
        });
        results.push(material);
        setSession(prev => ({
          ...prev,
          candidates: prev.candidates.map(c => c.id === candidate.id ? { ...c, status: 'done' } : c),
        }));
      }
    }
    
    setCreatedMaterials(results);
    await queryClient.invalidateQueries({ queryKey: materialQueryKeys.materials() });
    setSession(prev => ({ ...prev, status: 'completed' }));
    return results;
  }, [session.candidates, commitImport, queryClient]);

  const resetSession = useCallback(() => {
    setSession({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      candidates: [],
      status: 'selecting',
    });
    setCreatedMaterials([]);
    setActiveCandidateIndex(0);
  }, []);

  const goToStep = useCallback((step: ImportSession['status']) => {
    setSession(prev => ({ ...prev, status: step }));
  }, []);

  return {
    session,
    currentStep: session.status,
    createdMaterials,
    activeCandidateIndex,
    setActiveCandidateIndex,
    addFiles,
    removeFile,
    retryCandidate,
    startExtraction,
    cancelExtraction,
    updateCandidateMarkdown,
    updateCandidateTitle,
    commitSession,
    resetSession,
    goToStep,
    ocrEngine,
    setOcrEngine,
    progressMap,
  };
}
