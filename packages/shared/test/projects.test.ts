import { describe, expect, test } from 'vitest';
import { projectNames, projectRoot, sessionRootOf } from '../src/projects.ts';

describe('projectRoot', () => {
  test('a worktree folds into its main root', () => {
    expect(projectRoot('/Users/example/Work/lantern-notes/.claude/worktrees/brave-otter')).toBe(
      '/Users/example/Work/lantern-notes',
    );
  });

  test('a trailing / goes and a space stays', () => {
    expect(projectRoot('/Users/example/My Work/app/')).toBe('/Users/example/My Work/app');
  });
});

describe('sessionRootOf', () => {
  test("a session's root is its project's root, and null with no project", () => {
    expect(sessionRootOf('/Users/example/Work/lantern-notes/.claude/worktrees/brave-otter')).toBe(
      '/Users/example/Work/lantern-notes',
    );
    expect(sessionRootOf(null)).toBeNull();
    expect(sessionRootOf('')).toBeNull();
  });
});

describe('projectNames', () => {
  test('names are folder names, with the parent folder where two collide', () => {
    const names = projectNames([
      '/Users/example/Work/lantern-notes',
      '/Users/example/Archive/lantern-notes',
      '/Users/example/Work/tidepool-api',
    ]);
    expect(names.get('/Users/example/Work/lantern-notes')).toBe('lantern-notes (Work)');
    expect(names.get('/Users/example/Archive/lantern-notes')).toBe('lantern-notes (Archive)');
    expect(names.get('/Users/example/Work/tidepool-api')).toBe('tidepool-api');
  });

  test('an alias replaces the folder name, with the parent folder where it collides', () => {
    const names = projectNames(['/Users/example/Work/lantern-notes', '/Users/example/Work/notes'], {
      '/Users/example/Work/lantern-notes': 'notes',
    });
    expect(names.get('/Users/example/Work/lantern-notes')).toBe('notes (Work)');
    expect(names.get('/Users/example/Work/notes')).toBe('notes (Work)');
    const alias = { '/Users/example/Work/lantern-notes': 'Notes app' };
    expect(projectNames(['/Users/example/Work/lantern-notes'], alias).get('/Users/example/Work/lantern-notes')).toBe(
      'Notes app',
    );
  });
});
