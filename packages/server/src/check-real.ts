// Runs the configured reporter once and says whether the loader reads its output: the version, the failing field
// paths and the run key counts. It prints no value from the data. Usage: `pnpm --filter @cwd/server check:real
// [dataDir]`; the data dir defaults to the real one.
import { loadReport, runKey, type RunEntry } from '@cwd/shared';
import { loadConfig } from './config.ts';
import { runReporter } from './reporter.ts';

const config = loadConfig(process.argv[2]);
const result = await runReporter(config.reporterCommand, config.reporterTimeoutMs);
if (!result.ok) {
  // The summary only: the full error can hold stderr's last line, which may name a path or session ID.
  console.error(result.summary);
  process.exit(1);
}

const json = result.json as { version?: unknown; runs?: unknown } | null;
console.log(`version: ${typeof json?.version === 'number' ? json.version : 'none'}`);

const loaded = loadReport(result.json);
console.log(loaded.ok ? 'fields: none' : loaded.fields.join('\n'));

// Counted on the raw runs, so a bad shape elsewhere still gives the counts; a run that isn't an object has no key.
const runs = Array.isArray(json?.runs) ? (json.runs as unknown[]) : [];
const keys = runs.map((run) => (typeof run === 'object' && run !== null ? runKey(run as RunEntry) : null));
const present = keys.filter((key) => key !== null);
console.log(`run keys: ${present.length - new Set(present).size} duplicates, ${keys.length - present.length} missing`);

if (!loaded.ok) process.exitCode = 1;
