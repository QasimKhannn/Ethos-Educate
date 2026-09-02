import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Image, { _resetImageCaches } from '../Image';

jest.mock('~/utils', () => ({
  cn: (...classes: (string | boolean | undefined | null)[]) =>
    classes
      .flat(Infinity)
      .filter((c): c is string => typeof c === 'string' && c.length > 0)
      .join(' '),
}));

jest.mock('librechat-data-provider', () => ({
  apiBaseUrl: () => '',
  FileSources: {
    local: 'local',
    firebase: 'firebase',
    s3: 's3',
    azure_blob: 'azure_blob',
  },
  dataService: {
    getFilePreview: jest.fn(),
  },
}));

jest.mock('@librechat/client', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  Skeleton: ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="skeleton" className={className} {...props} />
  ),
  TooltipAnchor: ({ render }: { render: React.ReactElement }) => render,
}));

jest.mock('../DialogImage', () => ({
  __esModule: true,
  default: ({ isOpen, src }: { isOpen: boolean; src: string }) =>
    isOpen ? <div data-testid="dialog-image" data-src={src} /> : null,
}));

const getFilePreviewMock = () =>
  jest.requireMock('librechat-data-provider').dataService.getFilePreview as jest.Mock;

describe('Image', () => {
  const defaultProps = {
    imagePath: '/images/test.png',
    altText: 'Test image',
  };

  beforeEach(() => {
    _resetImageCaches();
    jest.clearAllMocks();
    getFilePreviewMock().mockResolvedValue({ data: new Blob(['image']) });
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: jest.fn(() => 'blob:managed-image-preview'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: jest.fn(),
    });
  });

  describe('rendering without dimensions', () => {
    it('renders with max-h-[45vh] height constraint', () => {
      render(<Image {...defaultProps} />);
      const img = screen.getByRole('img');
      expect(img.className).toContain('max-h-[45vh]');
    });

    it('renders with max-w-full to prevent landscape clipping', () => {
      render(<Image {...defaultProps} />);
      const img = screen.getByRole('img');
      expect(img.className).toContain('max-w-full');
    });

    it('renders with w-auto and h-auto for natural aspect ratio', () => {
      render(<Image {...defaultProps} />);
      const img = screen.getByRole('img');
      expect(img.className).toContain('w-auto');
      expect(img.className).toContain('h-auto');
    });

    it('shows a fallback skeleton without dimensions until the image is ready', () => {
      render(<Image {...defaultProps} />);
      expect(screen.getByTestId('skeleton')).toBeInTheDocument();
    });

    it('reserves fallback space without dimensions while the image loads', () => {
      render(<Image {...defaultProps} />);
      const button = screen.getByRole('button', { name: 'View Test image in dialog' });
      expect(button.style.height).toContain('min(45vh');
    });
  });

  describe('rendering with dimensions', () => {
    it('shows skeleton behind image', () => {
      render(<Image {...defaultProps} width={1024} height={1792} />);
      expect(screen.getByTestId('skeleton')).toBeInTheDocument();
    });

    it('applies computed heightStyle to button', () => {
      render(<Image {...defaultProps} width={1024} height={1792} />);
      const button = screen.getByRole('button', { name: 'View Test image in dialog' });
      expect(button.style.height).toBeTruthy();
      expect(button.style.height).toContain('min(45vh');
    });

    it('uses size-full object-contain on image when dimensions provided', () => {
      render(<Image {...defaultProps} width={768} height={916} />);
      const img = screen.getByRole('img');
      expect(img.className).toContain('size-full');
      expect(img.className).toContain('object-contain');
    });

    it('uses browser-decoded dimensions when MCP metadata has the wrong aspect ratio', async () => {
      render(<Image {...defaultProps} width={1024} height={1792} />);
      const button = screen.getByRole('button', { name: 'View Test image in dialog' });
      const img = screen.getByRole('img');

      Object.defineProperties(img, {
        naturalWidth: { configurable: true, value: 1024 },
        naturalHeight: { configurable: true, value: 1536 },
      });
      fireEvent.load(img);

      await waitFor(() => {
        expect(button.style.height).toContain('150vw');
        expect(button.style.height).toContain('768px');
      });
    });

    it('skeleton is absolute inset-0', () => {
      render(<Image {...defaultProps} width={512} height={512} />);
      const skeleton = screen.getByTestId('skeleton');
      expect(skeleton.className).toContain('absolute');
      expect(skeleton.className).toContain('inset-0');
    });

    it('hides the skeleton only after the image has loaded and decoded', async () => {
      const { rerender } = render(<Image {...defaultProps} width={512} height={512} />);
      const img = screen.getByRole('img');
      let finishDecode: (() => void) | undefined;

      Object.defineProperty(img, 'decode', {
        configurable: true,
        value: jest.fn(
          () =>
            new Promise<void>((resolve) => {
              finishDecode = resolve;
            }),
        ),
      });

      expect(screen.getByTestId('skeleton')).toBeInTheDocument();
      expect(img.className).toContain('opacity-0');
      expect(screen.getByRole('button', { name: 'View Test image in dialog' })).toHaveAttribute(
        'aria-busy',
        'true',
      );

      fireEvent.load(img);
      expect(screen.getByTestId('skeleton')).toBeInTheDocument();
      finishDecode?.();

      await waitFor(() => expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument());
      expect(img.className).toContain('opacity-100');
      expect(screen.getByRole('button', { name: 'View Test image in dialog' })).toHaveAttribute(
        'aria-busy',
        'false',
      );

      // Rerender same component — skeleton should not show (URL painted)
      rerender(<Image {...defaultProps} width={512} height={512} />);
      expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument();
    });
  });

  describe('common behavior', () => {
    it('applies custom className to the button wrapper', () => {
      render(<Image {...defaultProps} className="mb-4" />);
      const button = screen.getByRole('button', { name: 'View Test image in dialog' });
      expect(button.className).toContain('mb-4');
    });

    it('sets correct alt text', () => {
      render(<Image {...defaultProps} />);
      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('alt', 'Test image');
    });

    it('has correct accessibility attributes on button', () => {
      render(<Image {...defaultProps} />);
      const button = screen.getByRole('button', { name: 'View Test image in dialog' });
      expect(button).toHaveAttribute('aria-label', 'View Test image in dialog');
      expect(button).toHaveAttribute('aria-haspopup', 'dialog');
    });
  });

  describe('dialog interaction', () => {
    it('opens dialog on button click', () => {
      render(<Image {...defaultProps} />);
      expect(screen.queryByTestId('dialog-image')).not.toBeInTheDocument();

      const button = screen.getByRole('button', { name: 'View Test image in dialog' });
      fireEvent.click(button);

      expect(screen.getByTestId('dialog-image')).toBeInTheDocument();
    });

    it('dialog is always mounted (not gated by load state)', () => {
      render(<Image {...defaultProps} />);
      // DialogImage mock returns null when isOpen=false, but the component is in the tree
      // Clicking should immediately show it
      fireEvent.click(screen.getByRole('button', { name: 'View Test image in dialog' }));
      expect(screen.getByTestId('dialog-image')).toBeInTheDocument();
    });
  });

  describe('image URL resolution', () => {
    it('loads managed files with the authenticated preview client', async () => {
      render(
        <Image
          {...defaultProps}
          imagePath="https://storage.example.com/expired-sas-url"
          fileId="file-123"
          userId="user-456"
          source="azure_blob"
        />,
      );

      await waitFor(() =>
        expect(getFilePreviewMock()).toHaveBeenCalledWith('user-456', 'file-123'),
      );
      expect(screen.getByRole('img')).toHaveAttribute('src', 'blob:managed-image-preview');
    });

    it('passes /images/ paths through with base URL', () => {
      render(<Image {...defaultProps} imagePath="/images/test.png" />);
      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', '/images/test.png');
    });

    it('passes absolute http URLs through unchanged', () => {
      render(<Image {...defaultProps} imagePath="https://example.com/photo.jpg" />);
      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', 'https://example.com/photo.jpg');
    });

    it('passes data URIs through unchanged', () => {
      render(<Image {...defaultProps} imagePath="data:image/png;base64,abc" />);
      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', 'data:image/png;base64,abc');
    });

    it('passes non-/images/ paths through unchanged', () => {
      render(<Image {...defaultProps} imagePath="/other/path.png" />);
      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', '/other/path.png');
    });
  });
});
