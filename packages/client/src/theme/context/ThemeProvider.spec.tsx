import React, { useContext } from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeContext, ThemeProvider } from './ThemeProvider';

const ThemeProbe = () => {
  const { theme } = useContext(ThemeContext);

  return <span data-testid="theme-value">{theme}</span>;
};

describe('ThemeProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('defaults to light mode when no preference is stored', () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('theme-value')).toHaveTextContent('light');
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('respects a stored dark-mode preference', () => {
    window.localStorage.setItem('color-theme', 'dark');

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('theme-value')).toHaveTextContent('dark');
  });
});
