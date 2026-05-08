import { shouldShowActionButton } from './mcpServerUtils';

describe('shouldShowActionButton', () => {
  it('returns true for cancellable initialization state', () => {
    expect(
      shouldShowActionButton({
        serverName: 'sharepoint',
        isInitializing: true,
        canCancel: true,
        onCancel: jest.fn(),
        onConfigClick: jest.fn(),
      }),
    ).toBe(true);
  });

  it('returns false for non-cancellable initialization state', () => {
    expect(
      shouldShowActionButton({
        serverName: 'sharepoint',
        isInitializing: true,
        canCancel: false,
        onCancel: jest.fn(),
        onConfigClick: jest.fn(),
      }),
    ).toBe(false);
  });

  it('returns true for cancellable connecting state', () => {
    expect(
      shouldShowActionButton({
        serverName: 'sharepoint',
        serverStatus: {
          connectionState: 'connecting',
          requiresOAuth: true,
        },
        isInitializing: false,
        canCancel: true,
        onCancel: jest.fn(),
        onConfigClick: jest.fn(),
      }),
    ).toBe(true);
  });

  it('returns false for non-cancellable connecting state', () => {
    expect(
      shouldShowActionButton({
        serverName: 'sharepoint',
        serverStatus: {
          connectionState: 'connecting',
          requiresOAuth: true,
        },
        isInitializing: false,
        canCancel: false,
        onCancel: jest.fn(),
        onConfigClick: jest.fn(),
      }),
    ).toBe(false);
  });
});
