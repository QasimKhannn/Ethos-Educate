import { render, screen } from '@testing-library/react';
import Error from '../Error';

jest.mock('~/hooks', () => {
  const translations: Record<string, string> = {
    com_ui_chat_error_generic:
      'Please try again. If the issue continues, contact your administrator.',
    com_ui_chat_error_title: 'Oops, something went wrong',
  };

  return {
    useLocalize: () => (key: string) => translations[key] ?? key,
  };
});

describe('Error', () => {
  it('shows one friendly generic message instead of a raw unrecognised error', () => {
    render(<Error text="We couldn't complete your request. Internal service unavailable." />);

    expect(screen.getByText('Oops, something went wrong')).toBeInTheDocument();
    expect(
      screen.getByText('Please try again. If the issue continues, contact your administrator.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Internal service unavailable/)).not.toBeInTheDocument();
  });
});
