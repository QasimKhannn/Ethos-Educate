import React, { memo, useMemo, useRef, useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { useRecoilValue } from 'recoil';
import { Button, TooltipAnchor, useToastContext } from '@librechat/client';
import { PermissionTypes, Permissions, apiBaseUrl } from 'librechat-data-provider';
import MermaidErrorBoundary from '~/components/Messages/Content/MermaidErrorBoundary';
import CodeBlock from '~/components/Messages/Content/CodeBlock';
import Mermaid from '~/components/Messages/Content/Mermaid';
import DialogImage from './DialogImage';
import useHasAccess from '~/hooks/Roles/useHasAccess';
import { useFileDownload } from '~/data-provider';
import { useCodeBlockContext } from '~/Providers';
import { handleDoubleClick } from '~/utils';
import { useLocalize } from '~/hooks';
import store from '~/store';

type TCodeProps = {
  inline?: boolean;
  className?: string;
  children: React.ReactNode;
};

export const code: React.ElementType = memo(function MarkdownCode({
  className,
  children,
}: TCodeProps) {
  const canRunCode = useHasAccess({
    permissionType: PermissionTypes.RUN_CODE,
    permission: Permissions.USE,
  });
  const match = /language-(\w+)/.exec(className ?? '');
  const lang = match && match[1];
  const isMath = lang === 'math';
  const isMermaid = lang === 'mermaid';
  const isSingleLine = typeof children === 'string' && children.split('\n').length === 1;

  const { getNextIndex, resetCounter } = useCodeBlockContext();
  const blockIndex = useRef(getNextIndex(isMath || isMermaid || isSingleLine)).current;

  useEffect(() => {
    resetCounter();
  }, [children, resetCounter]);

  if (isMath) {
    return <>{children}</>;
  } else if (isMermaid) {
    const content = typeof children === 'string' ? children : String(children);
    return (
      <MermaidErrorBoundary code={content}>
        <Mermaid id={`mermaid-${blockIndex}`}>{content}</Mermaid>
      </MermaidErrorBoundary>
    );
  } else if (isSingleLine) {
    return (
      <code onDoubleClick={handleDoubleClick} className={className}>
        {children}
      </code>
    );
  } else {
    return (
      <CodeBlock
        lang={lang ?? 'text'}
        codeChildren={children}
        blockIndex={blockIndex}
        allowExecution={canRunCode}
      />
    );
  }
});
code.displayName = 'MarkdownCode';

export const codeNoExecution: React.ElementType = memo(function MarkdownCodeNoExecution({
  className,
  children,
}: TCodeProps) {
  const match = /language-(\w+)/.exec(className ?? '');
  const lang = match && match[1];

  if (lang === 'math') {
    return children;
  } else if (lang === 'mermaid') {
    const content = typeof children === 'string' ? children : String(children);
    return <Mermaid>{content}</Mermaid>;
  } else if (typeof children === 'string' && children.split('\n').length === 1) {
    return (
      <code onDoubleClick={handleDoubleClick} className={className}>
        {children}
      </code>
    );
  } else {
    return <CodeBlock lang={lang ?? 'text'} codeChildren={children} allowExecution={false} />;
  }
});
codeNoExecution.displayName = 'MarkdownCodeNoExecution';

type TAnchorProps = {
  href: string;
  children: React.ReactNode;
};

export const a: React.ElementType = memo(function MarkdownAnchor({ href, children }: TAnchorProps) {
  const user = useRecoilValue(store.user);
  const { showToast } = useToastContext();
  const localize = useLocalize();

  const {
    file_id = '',
    filename = '',
    filepath,
  } = useMemo(() => {
    const pattern = new RegExp(`(?:files|outputs)/${user?.id}/([^\\s]+)`);
    const match = href.match(pattern);
    if (match && match[0]) {
      const path = match[0];
      const parts = path.split('/');
      const name = parts.pop();
      const file_id = parts.pop();
      return { file_id, filename: name, filepath: path };
    }
    return { file_id: '', filename: '', filepath: '' };
  }, [user?.id, href]);

  const { refetch: downloadFile } = useFileDownload(user?.id ?? '', file_id);
  const props: { target?: string; onClick?: React.MouseEventHandler } = { target: '_blank' };
  const isUnavailableDownloadHref = useMemo(() => {
    if (!href || href === '/') {
      return true;
    }

    try {
      const url = new URL(href, window.location.origin);
      return url.origin === window.location.origin && url.pathname === '/';
    } catch {
      return false;
    }
  }, [href]);

  if (!file_id || !filename) {
    if (isUnavailableDownloadHref) {
      return (
        <a
          href={href}
          onClick={(event) => {
            event.preventDefault();
            showToast({
              status: 'error',
              message: localize('com_ui_download_unavailable'),
            });
          }}
          {...props}
        >
          {children}
        </a>
      );
    }

    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  }

  const handleDownload = async (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    try {
      const stream = await downloadFile();
      if (stream.data == null || stream.data === '') {
        console.error('Error downloading file: No data found');
        showToast({
          status: 'error',
          message: localize('com_ui_download_error'),
        });
        return;
      }
      const link = document.createElement('a');
      link.href = stream.data;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(stream.data);
    } catch (error) {
      console.error('Error downloading file:', error);
      showToast({
        status: 'error',
        message: localize('com_ui_download_error'),
      });
    }
  };

  props.onClick = handleDownload;
  props.target = '_blank';

  const domainServerBaseUrl = `${apiBaseUrl()}/api`;

  return (
    <a
      href={
        filepath?.startsWith('files/')
          ? `${domainServerBaseUrl}/${filepath}`
          : `${domainServerBaseUrl}/files/${filepath}`
      }
      {...props}
    >
      {children}
    </a>
  );
});
a.displayName = 'MarkdownAnchor';

type TParagraphProps = {
  children: React.ReactNode;
};

export const p: React.ElementType = memo(function MarkdownParagraph({ children }: TParagraphProps) {
  return <p className="mb-2 whitespace-pre-wrap">{children}</p>;
});
p.displayName = 'MarkdownParagraph';

type TImageProps = {
  src?: string;
  alt?: string;
  title?: string;
  className?: string;
  style?: React.CSSProperties;
};

const imageGenerationHosts = new Set([
  'image-generation-mcp-1081644116068.us-central1.run.app',
  'image-gen-mcp.mangoocean-84242d32.eastus.azurecontainerapps.io',
]);

function isGeneratedImageAsset(src?: string) {
  if (!src) {
    return false;
  }

  try {
    const url = new URL(src);
    return imageGenerationHosts.has(url.hostname) && url.pathname.startsWith('/files/');
  } catch {
    return false;
  }
}

function getImageFilename(src: string) {
  try {
    const filename = new URL(src).pathname.split('/').pop();
    return filename ? decodeURIComponent(filename) : 'generated-image.png';
  } catch {
    return 'generated-image.png';
  }
}

async function downloadGeneratedImage(src: string) {
  try {
    const response = await fetch(src);
    if (!response.ok) {
      throw new Error(`Download failed with status ${response.status}`);
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = getImageFilename(src);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);
  } catch (error) {
    console.error('Error downloading generated image:', error);
    window.open(src, '_blank', 'noopener,noreferrer');
  }
}

function GeneratedImage({
  src,
  alt,
  title,
  style,
}: Pick<TImageProps, 'src' | 'alt' | 'title' | 'style'> & { src: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const imageAlt = alt || 'Generated image';

  return (
    <>
      <span className="my-3 inline-flex max-w-full align-top">
        <span className="relative inline-flex max-w-full overflow-hidden rounded-md border border-border-light bg-surface-primary">
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setIsOpen(true)}
            aria-label={`View ${imageAlt} in dialog`}
            aria-haspopup="dialog"
            className="block max-w-full cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <img
              src={src}
              alt={imageAlt}
              title={title}
              className="max-h-[45vh] max-w-full object-contain"
              style={style}
            />
          </button>
          <TooltipAnchor
            description="Download image"
            render={
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => void downloadGeneratedImage(src)}
                aria-label="Download image"
                className="absolute right-2 top-2 size-8 bg-black/55 text-white shadow-sm hover:bg-black/75"
              >
                <Download className="size-4" aria-hidden="true" />
              </Button>
            }
          />
        </span>
      </span>
      <DialogImage
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        src={src}
        downloadImage={() => void downloadGeneratedImage(src)}
        triggerRef={triggerRef}
        showDetails={false}
      />
    </>
  );
}

export const img: React.ElementType = memo(function MarkdownImage({
  src,
  alt,
  title,
  className,
  style,
}: TImageProps) {
  // Get the base URL from the API endpoints
  const baseURL = apiBaseUrl();

  // If src starts with /images/, prepend the base URL
  const fixedSrc = useMemo(() => {
    if (!src) return src;

    // If it's already an absolute URL or doesn't start with /images/, return as is
    if (src.startsWith('http') || src.startsWith('data:') || !src.startsWith('/images/')) {
      return src;
    }

    // Prepend base URL to the image path
    return `${baseURL}${src}`;
  }, [src, baseURL]);

  if (fixedSrc && isGeneratedImageAsset(fixedSrc)) {
    return <GeneratedImage src={fixedSrc} alt={alt} title={title} style={style} />;
  }

  return <img src={fixedSrc} alt={alt} title={title} className={className} style={style} />;
});
img.displayName = 'MarkdownImage';
