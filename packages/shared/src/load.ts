import { z } from 'zod';
import { ReportSchema, type Report } from './report.ts';

export type LoadResult = { ok: true; report: Report } | { ok: false; reason: 'version' | 'shape'; fields: string[] };

/** The reporter's JSON checked against the schema: only version 1 is read, and a bad shape gives its field paths. */
export function loadReport(raw: unknown): LoadResult {
  if ((raw as { version?: unknown } | null)?.version !== 1) return { ok: false, reason: 'version', fields: ['version'] };
  const parsed = ReportSchema.safeParse(raw);
  if (parsed.success) return { ok: true, report: parsed.data };
  return { ok: false, reason: 'shape', fields: [...new Set(parsed.error.issues.map((issue) => fieldPath(issue.path)))] };
}

/** An issue's path with array indices written [] and map keys {}, found by walking the schema, so it holds no value. */
function fieldPath(path: PropertyKey[]): string {
  let schema: z.ZodType | undefined = ReportSchema;
  let out = '';
  for (const segment of path) {
    while (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) schema = schema.unwrap() as z.ZodType;
    if (schema instanceof z.ZodArray) {
      out += '[]';
      schema = schema.element as z.ZodType;
    } else if (schema instanceof z.ZodRecord) {
      out += '{}';
      schema = schema.valueType as z.ZodType;
    } else {
      out += `${out ? '.' : ''}${String(segment)}`;
      schema = schema instanceof z.ZodObject ? (schema.shape[String(segment)] as z.ZodType | undefined) : undefined;
    }
  }
  return out;
}
