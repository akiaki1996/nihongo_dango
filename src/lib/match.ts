export function isMatch(userAnswer: string, expected: string): boolean {
  const trimmed = userAnswer.trim();
  if (trimmed.length === 0) return false;
  return trimmed === expected;
}
