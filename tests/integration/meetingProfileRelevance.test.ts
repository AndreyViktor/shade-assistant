import { describe, expect, it } from 'vitest';
import fixture from '../fixtures/meeting-profiles/relevance-v1.json';
import {
  getMeetingProfile,
  MEETING_PROFILES,
  parseMeetingProfileId,
} from '../../src/contracts/meeting/meetingProfile';

describe('synthetic meeting profile relevance fixture', () => {
  it('maps every focused profile to its explicit objective and expected priority', () => {
    expect(fixture.synthetic).toBe(true);
    expect(fixture.cases).toHaveLength(MEETING_PROFILES.length);
    for (const scenario of fixture.cases) {
      const id = parseMeetingProfileId(scenario.profile);
      expect(id).not.toBeNull();
      const profile = id ? getMeetingProfile(id) : null;
      expect(profile).toMatchObject({
        id: scenario.profile,
        objective: scenario.expectedObjective,
      });
      expect(profile?.priorities).toContain(scenario.expectedFocus);
    }
  });
});
