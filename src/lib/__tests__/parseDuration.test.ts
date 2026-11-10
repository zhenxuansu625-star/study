import { parseDuration } from '../parseDuration';

describe('parseDuration', () => {
  test.each([
    ['90', 90],
    ['90m', 90],
    ['90 mins', 90],
    ['1.5h', 90],
    ['2h 30m', 150],
    ['2h30', 150],
    ['2h30m', 150],
    ['1:30', 90],
    ['2 hours', 120],
    ['1 hr 15 min', 75],
    ['1 hour and 20 minutes', 80],
    ['  45  ', 45],
    ['3H', 180],
  ])('%s → %d', (input, expected) => {
    expect(parseDuration(input)).toBe(expected);
  });

  test.each(['', 'abc', '0', '2 days', 'h', '-5', '1:75'])('rejects %p', (input) => {
    expect(parseDuration(input)).toBeNull();
  });
});
