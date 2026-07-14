import { describe, expect, it } from 'vitest';
import {
  restrictedAreaAt,
  restrictedAreaTypeAt,
} from '../src/data/restrictedAreas';

describe('restricted areas', () => {
  it('recognizes the center of Lake Coatepeque as water', () => {
    expect(restrictedAreaAt([-89.55, 13.86])).toMatchObject({
      id: 'lake-coatepeque',
      type: 'water',
    });
  });

  it('keeps the roads around the lake and San Salvador traversable', () => {
    expect(restrictedAreaTypeAt([-89.59, 13.88])).toBeNull();
    expect(restrictedAreaTypeAt([-89.1909, 13.6963])).toBeNull();
  });

  it('classifies positions beyond the game bounds separately', () => {
    expect(restrictedAreaTypeAt([-90.3, 13.7])).toBe('out-of-bounds');
  });
});
