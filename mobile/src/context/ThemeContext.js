import React, { createContext, useContext, useState, useMemo } from 'react';
import { DARK, LIGHT } from '../theme/theme';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [darkMode, setDarkMode] = useState(false); // opens in light mode by default
  const colors = useMemo(() => (darkMode ? DARK : LIGHT), [darkMode]);
  const value = { colors, darkMode, setDarkMode, toggleDarkMode: () => setDarkMode(d => !d) };
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
