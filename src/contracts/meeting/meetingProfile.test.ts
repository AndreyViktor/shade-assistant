import { describe, expect, it } from 'vitest';
import {
  getMeetingProfile,
  MEETING_PROFILES,
  parseMeetingProfileId,
} from './meetingProfile';

describe('meeting profile catalog', () => {
  it('keeps no-profile explicit and rejects arbitrary or sensitive values', () => {
    expect(getMeetingProfile('none')).toBeNull();
    expect(parseMeetingProfileId('none')).toBe('none');
    for (const value of [null, '', 'custom', 'private customer objective', {}])
      expect(parseMeetingProfileId(value)).toBeNull();
  });

  it('defines one explicit objective and bounded priority list per focused profile', () => {
    expect(MEETING_PROFILES).toHaveLength(6);
    for (const profile of MEETING_PROFILES) {
      expect(getMeetingProfile(profile.id)).toEqual(profile);
      expect(profile.objective.length).toBeGreaterThan(0);
      expect(profile.priorities.length).toBeGreaterThan(0);
      expect(profile.priorities.length).toBeLessThanOrEqual(3);
    }
  });
});
