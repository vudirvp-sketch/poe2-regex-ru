export const MAX_CHARS = 250;

export function getCharCount(regex: string): number {
  return regex.length;  // NOT TextEncoder! Game counts characters.
}

export function isOverflow(regex: string): boolean {
  return regex.length > MAX_CHARS;
}

export type HealthLevel = 'green' | 'yellow' | 'red';

export function getCharHealth(regex: string): {
  count: number;
  max: number;
  level: HealthLevel;
  percentage: number;
} {
  const count = regex.length;
  const percentage = (count / MAX_CHARS) * 100;
  let level: HealthLevel;
  if (count <= 200) level = 'green';
  else if (count <= 240) level = 'yellow';
  else level = 'red';
  return { count, max: MAX_CHARS, level, percentage };
}
