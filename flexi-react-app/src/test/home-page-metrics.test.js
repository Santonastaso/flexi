import { afterEach, describe, expect, it, vi } from 'vitest';
import { calculateHomeMetrics } from '../utils/homePageMetrics';

describe('home page metrics', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('counts delayed tasks when delivery dates arrive as Supabase timestamps', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-16T12:00:00.000Z'));

    const metrics = calculateHomeMetrics([], [
      {
        id: 'overdue-timestamp',
        status: 'NOT SCHEDULED',
        delivery_date: '2025-01-15T00:00:00.000Z',
        quantity: 10,
        quantity_completed: 0,
      },
      {
        id: 'overdue-date-only',
        status: 'NOT SCHEDULED',
        delivery_date: '2025-01-15',
        quantity: 10,
        quantity_completed: 0,
      },
      {
        id: 'today',
        status: 'NOT SCHEDULED',
        delivery_date: '2025-01-16T00:00:00.000Z',
        quantity: 10,
        quantity_completed: 0,
      },
      {
        id: 'completed',
        status: 'NOT SCHEDULED',
        delivery_date: '2025-01-14T00:00:00.000Z',
        quantity: 10,
        quantity_completed: 10,
      },
    ]);

    expect(metrics.delayedTasks).toBe(2);
  });
});
