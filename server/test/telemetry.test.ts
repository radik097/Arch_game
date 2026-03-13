import { describe, expect, it } from 'vitest';
import { applyVisitorEvent, buildTelegramVisitMessage, createEmptyVisitorStore } from '../telemetry.js';

describe('visitor telemetry', () => {
  it('counts the first visit for a session as unique', () => {
    const initial = createEmptyVisitorStore();
    const { stats } = applyVisitorEvent(initial, {
      sessionId: 'session-1',
      page: '/Arch_game/',
      referrer: '',
      userAgent: 'TestAgent',
      language: 'en-US',
      timezone: 'UTC',
      screen: '1920x1080',
    }, '2026-03-13T00:00:00.000Z');

    expect(stats.counted).toBe(true);
    expect(stats.totalVisits).toBe(1);
    expect(stats.uniqueVisitors).toBe(1);
  });

  it('does not increment unique visitors for a repeated session', () => {
    const initial = createEmptyVisitorStore();
    const first = applyVisitorEvent(initial, {
      sessionId: 'session-1',
      page: '/Arch_game/',
    }, '2026-03-13T00:00:00.000Z');
    const second = applyVisitorEvent(first.store, {
      sessionId: 'session-1',
      page: '/Arch_game/',
    }, '2026-03-13T00:05:00.000Z');

    expect(second.stats.counted).toBe(false);
    expect(second.stats.totalVisits).toBe(2);
    expect(second.stats.uniqueVisitors).toBe(1);
  });

  it('formats a telegram message with the main visit fields', () => {
    const message = buildTelegramVisitMessage({
      sessionId: 'session-1',
      page: '/Arch_game/',
      referrer: 'https://reddit.com',
      userAgent: 'Mozilla/5.0',
      language: 'en-US',
      timezone: 'UTC',
      screen: '1920x1080',
    }, {
      totalVisits: 5,
      uniqueVisitors: 3,
      lastVisitAt: '2026-03-13T00:05:00.000Z',
      counted: true,
    });

    expect(message).toContain('Arch Trainer visitor event');
    expect(message).toContain('total visits: 5');
    expect(message).toContain('unique visitors: 3');
    expect(message).toContain('referrer: https://reddit.com');
  });
});