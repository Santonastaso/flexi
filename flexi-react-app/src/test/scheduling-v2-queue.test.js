import { describe, expect, it } from 'vitest';
import { beforeTaskIdAfterMove } from '../scheduling-v2/queueOrder';

const queue = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];

describe('scheduler v2 queue ordering', () => {
  it('moves a task upward using the following task as the insertion anchor', () => {
    expect(beforeTaskIdAfterMove(queue, 'c', 'a')).toBe('a');
  });

  it('moves a task downward without reversing adjacent tasks', () => {
    expect(beforeTaskIdAfterMove(queue, 'a', 'c')).toBe('d');
  });

  it('uses a null anchor when moving to the end', () => {
    expect(beforeTaskIdAfterMove(queue, 'b', 'd')).toBeNull();
  });

  it('does nothing for stale or identical drop targets', () => {
    expect(beforeTaskIdAfterMove(queue, 'a', 'a')).toBeUndefined();
    expect(beforeTaskIdAfterMove(queue, 'missing', 'a')).toBeUndefined();
  });
});
