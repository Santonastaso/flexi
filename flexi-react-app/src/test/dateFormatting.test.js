import { describe, expect, it } from 'vitest';
import {
  convertCETHourToUTC,
  formatDeliveryDate,
  formatScheduledTime,
} from '../utils/dateFormatting';

describe('date formatting', () => {
  it('preserves scheduled and delivery date display formats', () => {
    expect(formatScheduledTime('2025-01-15T08:30:00.000Z')).toBe('15/01 09:30');
    expect(formatDeliveryDate('2025-01-15T00:00:00.000Z')).toBe('15/01/2025');
  });

  it('preserves CET and CEST hour conversion output', () => {
    expect(convertCETHourToUTC('2025-01-15', 8).toISOString()).toBe('2025-01-15T07:00:00.000Z');
    expect(convertCETHourToUTC('2025-07-15', 8).toISOString()).toBe('2025-07-15T06:00:00.000Z');
  });
});
