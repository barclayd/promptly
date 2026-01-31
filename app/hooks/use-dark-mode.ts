import { Theme, useTheme as useRemixTheme } from 'remix-themes';

export { Theme };

export type ThemeValue = 'light' | 'dark' | 'system';

export const useTheme = () => {
  const [theme, setRemixTheme] = useRemixTheme();

  const isDark = theme === Theme.DARK;

  // Convert Theme enum to string for UI display
  const themeValue: ThemeValue =
    theme === Theme.DARK ? 'dark' : theme === Theme.LIGHT ? 'light' : 'system';

  const setTheme = (newTheme: ThemeValue) => {
    if (newTheme === 'system') {
      setRemixTheme(null);
    } else if (newTheme === 'dark') {
      setRemixTheme(Theme.DARK);
    } else {
      setRemixTheme(Theme.LIGHT);
    }
  };

  return {
    theme: themeValue,
    isDark,
    setTheme,
  };
};
