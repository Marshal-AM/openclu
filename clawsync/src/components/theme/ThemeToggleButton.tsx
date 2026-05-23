import { Moon, Sun } from '@phosphor-icons/react';
import { useTheme } from './ThemeProvider';
import './ThemeToggleButton.css';

export function ThemeToggleButton({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      className={['theme-toggle-btn', className].filter(Boolean).join(' ')}
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
    >
      {isDark ? <Sun size={18} weight="regular" /> : <Moon size={18} weight="regular" />}
    </button>
  );
}
