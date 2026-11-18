import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/hosted/schema.ts',
  out: './drizzle-hosted',
});
