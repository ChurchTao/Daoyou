import type { MentorshipGraduationFacts } from '@daoyou/game-domain/mentorship';
import { describe, expect, it } from 'vitest';
import {
  apprenticeshipBlockReason,
  canBecomeApprentice,
  canMentor,
  mentorshipGraduationProgress,
} from './mentorship.js';

const facts: MentorshipGraduationFacts = {
  realm: '元婴',
  realmStage: '后期',
  manuals: [{ realm: '元婴', level: 6 }],
  sectMethodLevels: [60, 60, 60],
  bodyTrackLevels: [20, 20],
};

describe('mentorship', () => {
  it('enforces the exact admission realm boundaries', () => {
    expect(canMentor('元婴')).toBe(false);
    expect(canMentor('化神')).toBe(true);
    expect(canBecomeApprentice('金丹', null)).toBe(true);
    expect(canBecomeApprentice('元婴', null)).toBe(false);
    expect(canBecomeApprentice('unknown', null)).toBe(false);
  });
  it('preserves account binding even if the mentor identity has disappeared', () => {
    expect(canBecomeApprentice('炼气', new Date(0))).toBe(false);
    expect(apprenticeshipBlockReason('炼气', new Date(0))).toContain(
      '不可再次拜师',
    );
  });
  it('requires all four current-character milestones', () => {
    expect(mentorshipGraduationProgress(facts).ready).toBe(true);
    expect(
      mentorshipGraduationProgress({ ...facts, realmStage: '中期' }).ready,
    ).toBe(false);
    expect(
      mentorshipGraduationProgress({
        ...facts,
        realm: '化神',
        realmStage: '初期',
      }).ready,
    ).toBe(true);
    expect(
      mentorshipGraduationProgress({
        ...facts,
        manuals: [{ realm: '化神', level: 9 }],
      }).ready,
    ).toBe(false);
    expect(
      mentorshipGraduationProgress({
        ...facts,
        manuals: [{ realm: '元婴', level: 5 }],
      }).ready,
    ).toBe(false);
    expect(
      mentorshipGraduationProgress({
        ...facts,
        sectMethodLevels: [180, 180, 59],
      }).ready,
    ).toBe(false);
    expect(
      mentorshipGraduationProgress({ ...facts, bodyTrackLevels: [60, 19, 19] })
        .ready,
    ).toBe(false);
  });
  it.each([
    ['炼气', true],
    ['筑基', true],
    ['金丹', true],
    ['元婴', false],
    ['化神', false],
  ])(
    'allows an unbound %s apprentice exactly within the admission window',
    (realm, allowed) => {
      expect(canBecomeApprentice(realm, null)).toBe(allowed);
    },
  );
  it('keeps an ancient serialized binding permanent across a fresh low-level character', () => {
    expect(canBecomeApprentice('炼气', '1970-01-01T00:00:00.000Z')).toBe(false);
  });
  it('does not pool weaker manuals or training tracks into a graduation threshold', () => {
    const progress = mentorshipGraduationProgress({
      ...facts,
      manuals: [
        { realm: '元婴', level: 3 },
        { realm: '元婴', level: 3 },
      ],
      sectMethodLevels: [180, 59, 59, 59],
      bodyTrackLevels: [19, 19, 19, 19, 19],
    });
    expect(
      progress.milestones.find((milestone) => milestone.key === 'manual')
        ?.current,
    ).toBe(3);
    expect(
      progress.milestones.find((milestone) => milestone.key === 'sect_methods')
        ?.current,
    ).toBe(1);
    expect(
      progress.milestones.find((milestone) => milestone.key === 'body')
        ?.current,
    ).toBe(0);
    expect(progress.ready).toBe(false);
  });
  it('requires the current character to retain each foundation and leaves its input untouched', () => {
    const current = structuredClone(facts);
    const original = structuredClone(current);
    expect(mentorshipGraduationProgress(current).ready).toBe(true);
    expect(current).toEqual(original);
    expect(
      mentorshipGraduationProgress({ ...current, sectMethodLevels: [] }).ready,
    ).toBe(false);
    expect(
      mentorshipGraduationProgress({ ...current, bodyTrackLevels: [] }).ready,
    ).toBe(false);
    expect(
      mentorshipGraduationProgress({
        ...current,
        realm: '炼气',
        realmStage: '初期',
        manuals: [],
        sectMethodLevels: [],
        bodyTrackLevels: [],
      }).ready,
    ).toBe(false);
  });
});
