import { render, screen } from '@testing-library/react';

import EmptyText from '../EmptyText';

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => (key === 'com_ui_thinking_status' ? 'Thinking' : key),
}));

describe('EmptyText', () => {
  it('shows an accessible pulsing response activity dot', () => {
    render(<EmptyText />);

    const status = screen.getByRole('status', { name: 'Thinking' });
    expect(status).not.toHaveTextContent('Thinking');
    expect(status.querySelector('.response-waiting-dot .result-thinking')).not.toBeNull();
  });
});
