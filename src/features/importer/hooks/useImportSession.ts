import { useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ImportSession, ImportCandidate } from '../../../domain/importer/models/importer.types';
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
    aiCleanupEnabled: false,
    status: 'selecting',
  });
  
  const [createdMaterials, setCreatedMaterials] = useState<StudyMaterial[]>([]);
  const [activeCandidateIndex, setActiveCandidateIndex] = useState(0);
  const abortControllers = useRef<Map<string, AbortController>>(new Map());

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
    setSession(prev => ({ ...prev, status: 'extracting' }));
    
    const candidates = session.candidates.filter(c => c.status === 'pending' || c.status === 'error');
    const queue = [...candidates];
    const processNext = async (): Promise<void> => {
      if (queue.length === 0) return;
      const candidate = queue.shift()!;
      
      const ac = new AbortController();
      abortControllers.current.set(candidate.id, ac);
      
      try {
        const result = await extractContent.execute(candidate.file, { signal: ac.signal });
        
        setSession(prev => ({
          ...prev,
          candidates: prev.candidates.map(c => c.id === candidate.id ? { ...c, ...result } : c),
        }));
      } catch (err: any) {
        setSession(prev => ({
          ...prev,
          candidates: prev.candidates.map(c => c.id === candidate.id ? { ...c, status: 'error', error: { code: 'extraction-failed', message: err.message, retryable: true } } : c),
        }));
      } finally {
        abortControllers.current.delete(candidate.id);
        if (queue.length > 0) {
          await processNext();
        }
      }
    };

    const workers = Array(Math.min(2, queue.length)).fill(null).map(() => processNext());
    await Promise.all(workers);
    
    setSession(prev => {
      const hasErrors = prev.candidates.some(c => c.status === 'error');
      const allDone = prev.candidates.every(c => c.status === 'review' || c.status === 'error');
      if (allDone && !hasErrors && prev.candidates.length > 0) {
        return { ...prev, status: 'review' };
      }
      return prev;
    });
  }, [session.candidates, extractContent]);

  const cancelExtraction = useCallback((id?: string) => {
    if (id) {
      const ac = abortControllers.current.get(id);
      if (ac) ac.abort();
    } else {
      abortControllers.current.forEach(ac => ac.abort());
    }
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

  const setSubjectAndTerm = useCallback((subjectId?: string, termId?: string) => {
    setSession(prev => ({ ...prev, subjectId, termId }));
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
          subjectId: session.subjectId,
          termId: session.termId,
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
  }, [session.candidates, session.subjectId, session.termId, commitImport, queryClient]);

  const resetSession = useCallback(() => {
    setSession({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      candidates: [],
      aiCleanupEnabled: false,
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
    startExtraction,
    cancelExtraction,
    updateCandidateMarkdown,
    updateCandidateTitle,
    setSubjectAndTerm,
    commitSession,
    resetSession,
    goToStep,
  };
}
