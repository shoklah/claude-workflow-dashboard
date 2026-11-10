import type { SkillsResponse } from '@cwd/shared';

// Invented answers of GET /api/skills for the Skills page's stories.

export const skillsEmpty: SkillsResponse = { skills: [], missingSource: 'reporter' };

/** Five skills, by name: requesting-code-review was required but never loaded in the period, and writing-plans has no
 * missing count from an old export. */
export const skillsFull: SkillsResponse = {
  skills: [
    { name: 'brainstorming', runs: 6, last: '2026-11-10T09:07:00Z', outcomes: { 'wrote a file': 6 }, missing: 0 },
    { name: 'grill-me', runs: 1, last: '2026-11-03T10:15:00Z', outcomes: { ran: 1 }, missing: 2 },
    {
      name: 'simplify',
      runs: 5,
      last: '2026-11-09T16:02:00Z',
      outcomes: { 'applied 2, skipped 1': 3, 'applied 0, skipped 0': 2 },
      missing: 1,
    },
    { name: 'requesting-code-review', runs: 0, last: null, outcomes: {}, missing: 3 },
    { name: 'writing-plans', runs: 2, last: '2026-11-08T08:58:00Z', outcomes: { 'wrote a file': 2 }, missing: null },
  ],
  missingSource: 'reporter',
};
