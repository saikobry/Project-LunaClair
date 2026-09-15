import { describe, it, expect } from 'vitest';
import { ROW_GAP, SLOT_HYSTERESIS_PX, candidateForCenter, slotPitch } from '../reorderListGeometry';

describe('slotPitch', () => {
  it('is one row plus the list gap', () => {
    expect(slotPitch(56)).toBe(56 + ROW_GAP);
  });
});

describe('candidateForCenter', () => {
  const rowHeight = 56;
  const pitch = slotPitch(rowHeight);
  const count = 5;

  it('maps a drag center to its slot', () => {
    expect(candidateForCenter(0, rowHeight, count, -1)).toBe(0);
    expect(candidateForCenter(pitch * 2 + 10, rowHeight, count, -1)).toBe(2);
  });

  it('clamps above and below the list', () => {
    expect(candidateForCenter(-500, rowHeight, count, -1)).toBe(0);
    expect(candidateForCenter(pitch * 99, rowHeight, count, -1)).toBe(count - 1);
  });

  it('keeps the previous slot when the center has not crossed into another', () => {
    expect(candidateForCenter(pitch + 5, rowHeight, count, 1)).toBe(1);
  });

  it('moves slot once the center passes the slot boundary', () => {
    expect(candidateForCenter(pitch * 2, rowHeight, count, 1)).toBe(2);
  });

  /**
   * The hysteresis guard only engages when the slot pitch is smaller than
   * 2 × the band, i.e. for very short rows. At production row heights
   * (`>= 56px`, giving a 66px pitch) a boundary crossing is always further than
   * `SLOT_HYSTERESIS_PX` from the previous slot's center, so the guard never
   * changes the result — this test pins the guard's behaviour itself with a
   * deliberately tiny row rather than pretending it is load-bearing.
   */
  it('holds the previous slot inside the hysteresis band for very short rows', () => {
    const shortRow = 2; // pitch 12, so the band spans most of a slot
    expect(slotPitch(shortRow)).toBeLessThan(SLOT_HYSTERESIS_PX * 2);
    // raw would be 2, but the center is 11px from slot 1's center (band is 15).
    expect(candidateForCenter(25, shortRow, count, 1)).toBe(1);
  });
});
