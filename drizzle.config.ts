import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './worker/src/schema.ts',
  out: './worker/migrations',
});
