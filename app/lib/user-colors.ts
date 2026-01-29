// 12 distinct colors that work in both light and dark mode
const CURSOR_COLORS = [
  'rgb(239, 68, 68)', // red
  'rgb(59, 130, 246)', // blue
  'rgb(34, 197, 94)', // green
  'rgb(168, 85, 247)', // purple
  'rgb(249, 115, 22)', // orange
  'rgb(236, 72, 153)', // pink
  'rgb(20, 184, 166)', // teal
  'rgb(234, 179, 8)', // yellow
  'rgb(99, 102, 241)', // indigo
  'rgb(244, 63, 94)', // rose
  'rgb(14, 165, 233)', // sky
  'rgb(132, 204, 22)', // lime
] as const;

// Simple hash function for consistent color assignment
const hashString = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
};

// Get a consistent color for a user based on their ID
export const getUserColor = (userId: string): string => {
  const index = hashString(userId) % CURSOR_COLORS.length;
  return CURSOR_COLORS[index];
};

export { CURSOR_COLORS };
