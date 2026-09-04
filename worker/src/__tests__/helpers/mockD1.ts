import { DatabaseSync } from 'node:sqlite';

export function createMockD1(): D1Database {
  const db = new DatabaseSync(':memory:');

  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id text PRIMARY KEY,
      title text NOT NULL,
      content text NOT NULL,
      created_at text NOT NULL,
      updated_at text NOT NULL
    );

    CREATE TABLE IF NOT EXISTS figures (
      document_id text NOT NULL,
      filename text NOT NULL,
      data blob NOT NULL,
      content_type text NOT NULL,
      created_at text NOT NULL,
      updated_at text NOT NULL,
      PRIMARY KEY (document_id, filename)
    );

    CREATE TABLE IF NOT EXISTS subjects (
      id text PRIMARY KEY,
      title text NOT NULL,
      description text,
      "order" integer,
      created_at text NOT NULL,
      updated_at text NOT NULL
    );

    CREATE TABLE IF NOT EXISTS terms (
      id text PRIMARY KEY,
      title text NOT NULL,
      created_at text NOT NULL,
      updated_at text NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subject_terms (
      subject_id text NOT NULL,
      term_id text NOT NULL,
      "order" integer NOT NULL,
      PRIMARY KEY (subject_id, term_id)
    );

    CREATE TABLE IF NOT EXISTS materials (
      id text PRIMARY KEY,
      title text NOT NULL,
      description text,
      document_id text NOT NULL,
      subject_id text,
      term_id text,
      "order" integer,
      created_at text NOT NULL,
      updated_at text NOT NULL
    );

    CREATE TABLE IF NOT EXISTS questions (
      id text PRIMARY KEY,
      material_id text NOT NULL,
      type text NOT NULL,
      prompt text NOT NULL,
      payload text NOT NULL,
      difficulty text NOT NULL,
      points integer NOT NULL,
      explanation text,
      tags text,
      status text NOT NULL,
      version integer NOT NULL,
      created_at text NOT NULL,
      updated_at text NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quizzes (
      id text PRIMARY KEY,
      material_id text NOT NULL,
      title text NOT NULL,
      description text,
      status text NOT NULL,
      time_limit_seconds integer,
      passing_percentage integer,
      created_at text NOT NULL,
      updated_at text NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quiz_questions (
      quiz_id text NOT NULL,
      question_id text NOT NULL,
      question_version integer NOT NULL,
      "order" integer NOT NULL,
      points integer,
      PRIMARY KEY (quiz_id, question_id)
    );

    CREATE TABLE IF NOT EXISTS user_documents (
      user_id text NOT NULL,
      document_id text NOT NULL,
      version integer NOT NULL DEFAULT 1,
      title text NOT NULL,
      content text NOT NULL,
      updated_at text NOT NULL,
      deleted_at text,
      PRIMARY KEY (user_id, document_id)
    );

    CREATE TABLE IF NOT EXISTS user_entities (
      user_id text NOT NULL,
      entity_type text NOT NULL,
      entity_id text NOT NULL,
      payload text NOT NULL,
      updated_at text NOT NULL,
      deleted_at text,
      PRIMARY KEY (user_id, entity_type, entity_id)
    );

    CREATE TABLE IF NOT EXISTS sync_changes (
      sequence integer PRIMARY KEY AUTOINCREMENT,
      user_id text NOT NULL,
      entity_type text NOT NULL,
      entity_id text NOT NULL,
      operation text NOT NULL,
      version integer,
      changed_at text NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_idempotency (
      client_mutation_id text PRIMARY KEY,
      user_id text NOT NULL,
      deviceId text NOT NULL,
      entity_type text NOT NULL,
      entity_id text NOT NULL,
      processed_at text NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shares (
      id text PRIMARY KEY,
      format text DEFAULT 'lcpack' NOT NULL,
      schema_version integer DEFAULT 1 NOT NULL,
      title text NOT NULL,
      description text,
      author text,
      access_type text DEFAULT 'public' NOT NULL,
      passcode_hash text,
      package_payload text NOT NULL,
      user_id text,
      view_count integer DEFAULT 0 NOT NULL,
      download_count integer DEFAULT 0 NOT NULL,
      expires_at text,
      created_at text NOT NULL,
      updated_at text NOT NULL
    );
  `);

  class MockD1PreparedStatement implements D1PreparedStatement {
    private query: string;
    private params: unknown[];

    constructor(query: string, params: unknown[] = []) {
      this.query = query;
      this.params = params;
    }

    bind(...values: unknown[]): D1PreparedStatement {
      return new MockD1PreparedStatement(this.query, values);
    }

    async first<T = unknown>(colName?: string): Promise<T | null> {
      const stmt = db.prepare(this.query);
      const row = (stmt.get as any)(...this.params) as Record<string, unknown> | undefined;
      if (!row) return null;
      if (colName) return (row[colName] as T) ?? null;
      return row as T;
    }

    async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
      const stmt = db.prepare(this.query);
      const results = (stmt.all as any)(...this.params) as T[];
      return {
        results,
        success: true,
        meta: {} as any,
      };
    }

    async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
      const stmt = db.prepare(this.query);
      const info = (stmt.run as any)(...this.params);
      return {
        results: [] as T[],
        success: true,
        meta: {
          changes: Number(info.changes),
          last_row_id: Number(info.lastInsertRowid),
          duration: 0,
          served_by: 'mock',
        } as any,
      };
    }

    async raw<T = unknown[]>(_options?: { columnNames?: boolean }): Promise<any> {
      const stmt = db.prepare(this.query);
      const rows = (stmt.all as any)(...this.params);
      return rows.map((r: Record<string, unknown>) => Object.values(r)) as unknown as T[];
    }
  }

  return {
    prepare(query: string) {
      return new MockD1PreparedStatement(query);
    },
    async dump() {
      return new ArrayBuffer(0);
    },
    async batch<T = unknown>(statements: D1PreparedStatement[]) {
      const results: D1Result<T>[] = [];
      for (const stmt of statements) {
        results.push(await stmt.all<T>());
      }
      return results;
    },
    async exec(query: string) {
      db.exec(query);
      return { count: 0, duration: 0 };
    },
  } as unknown as D1Database;
}
