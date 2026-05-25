import { describe, expect, it, vi } from 'vitest';
import { SpotifyQueueScheduler } from '../store/scheduling/spotifyQueueScheduler';
import { getTaskSegments } from '../utils/taskSegments';

vi.mock('../services/api', () => ({
  apiService: {},
}));

describe('task segments', () => {
  it('reads persisted segment data for scheduled tasks', () => {
    const description = JSON.stringify({
      segments: [
        {
          start: '2025-01-15T07:00:00.000Z',
          end: '2025-01-15T08:00:00.000Z',
          duration: 1,
        },
      ],
    });

    expect(getTaskSegments({ status: 'SCHEDULED', description })).toEqual(JSON.parse(description));
    expect(getTaskSegments({ status: 'NOT SCHEDULED', description })).toBeNull();
    expect(getTaskSegments({ status: 'SCHEDULED', description: 'not-json' })).toBeNull();
  });
});

describe('spotify queue scheduler helpers', () => {
  it('sorts machine queues by scheduled start time', () => {
    const scheduler = new SpotifyQueueScheduler(() => ({}), () => {}, {});
    const orders = [
      { id: 'late', scheduled_machine_id: 'm1', status: 'SCHEDULED', scheduled_start_time: '2025-01-15T10:00:00.000Z' },
      { id: 'other', scheduled_machine_id: 'm2', status: 'SCHEDULED', scheduled_start_time: '2025-01-15T08:00:00.000Z' },
      { id: 'early', scheduled_machine_id: 'm1', status: 'IN PROGRESS', scheduled_start_time: '2025-01-15T08:00:00.000Z' },
      { id: 'pool', scheduled_machine_id: 'm1', status: 'NOT SCHEDULED', scheduled_start_time: '2025-01-15T07:00:00.000Z' },
    ];

    expect(scheduler.getQueue('m1', orders).map(task => task.id)).toEqual(['early', 'late']);
  });

  it('rounds timestamps to the next 15-minute slot', () => {
    const scheduler = new SpotifyQueueScheduler(() => ({}), () => {}, {});

    expect(scheduler.roundToNext15Min(new Date('2025-01-15T08:07:00.000Z')).toISOString()).toBe('2025-01-15T08:15:00.000Z');
    expect(scheduler.roundToNext15Min(new Date('2025-01-15T08:52:00.000Z')).toISOString()).toBe('2025-01-15T09:00:00.000Z');
  });
});
