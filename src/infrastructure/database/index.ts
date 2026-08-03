// Database core
export { LunaClairDatabase, db } from './LunaClairDatabase';
export type { HighlightRecord, DrawingRecord, PreferenceRecord, MetadataRecord } from './LunaClairDatabase';
export { DB_NAME, DB_VERSION, SCHEMA_V1, SCHEMA_V2, SCHEMA_V3 } from './schema';

// Startup services
export { DatabaseInitializer } from './DatabaseInitializer';
export { DatabaseMigrator } from './DatabaseMigrator';
export { DatabaseSeeder } from './DatabaseSeeder';

// Dexie repository singletons
export { DexieQuestionRepository, dexieQuestionRepository } from './repositories/DexieQuestionRepository';
export { DexieQuizRepository, dexieQuizRepository } from './repositories/DexieQuizRepository';
export { DexieQuizSessionRepository, dexieQuizSessionRepository } from './repositories/DexieQuizSessionRepository';
export { DexieLibraryRepository, dexieLibraryRepository } from './repositories/DexieLibraryRepository';
export { DexieAnnotationRepository, dexieAnnotationRepository } from './repositories/DexieAnnotationRepository';
export { DexieSubjectRepository, dexieSubjectRepository } from './repositories/DexieSubjectRepository';
export { DexieTermRepository, dexieTermRepository } from './repositories/DexieTermRepository';
export { DexieSubjectTermRepository, dexieSubjectTermRepository } from './repositories/DexieSubjectTermRepository';

// Dexie application service implementations
export { DexieTermService, dexieTermService } from './services/DexieTermService';
