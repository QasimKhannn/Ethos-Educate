import React, { memo, useMemo } from 'react';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import supersub from 'remark-supersub';
import rehypeKatex from 'rehype-katex';
import { useRecoilValue } from 'recoil';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkDirective from 'remark-directive';
import type { Pluggable } from 'unified';
import { Citation, CompositeCitation, HighlightedText } from '~/components/Web/Citation';
import {
  mcpUIResourcePlugin,
  MCPUIResource,
  MCPUIResourceCarousel,
} from '~/components/MCPUIResource';
import { Artifact, artifactPlugin } from '~/components/Artifacts/Artifact';
import { ArtifactProvider, CodeBlockProvider } from '~/Providers';
import MarkdownErrorBoundary from './MarkdownErrorBoundary';
import { langSubset, preprocessLaTeX } from '~/utils';
import { unicodeCitation } from '~/components/Web';
import { code, a, p, img } from './MarkdownComponents';
import store from '~/store';

type TContentProps = {
  content: string;
  isLatestMessage: boolean;
};

const imageGenerationFileUrl =
  'https://(?:image-generation-mcp-1081644116068\\.us-central1\\.run\\.app|image-gen-mcp\\.mangoocean-84242d32\\.eastus\\.azurecontainerapps\\.io)/files/[^\\s)\\]]+\\.(?:png|jpe?g|webp)';

const escapedImageMarkdownPattern = new RegExp(
  `!\\[([^\\]]*)\\]\\\\+\\((${imageGenerationFileUrl})\\)`,
  'gi',
);
const directImageLinkPattern = new RegExp(
  `(?:Download:\\s*)?\\[(${imageGenerationFileUrl})\\]\\(\\1\\)`,
  'gi',
);
const standaloneImageUrlPattern = new RegExp(`(^|\\n)(${imageGenerationFileUrl})(?=\\s|$)`, 'gi');

function hasMarkdownImageForUrl(content: string, url: string) {
  const escapedUrl = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`!\\[[^\\]]*\\]\\(${escapedUrl}\\)`, 'i').test(content);
}

function normalizeImageGenerationMarkdown(content: string) {
  const normalizedEscapedImages = content.replace(escapedImageMarkdownPattern, '![$1]($2)');
  const normalizedLinks = normalizedEscapedImages.replace(
    directImageLinkPattern,
    (_match, url: string) =>
      hasMarkdownImageForUrl(normalizedEscapedImages, url) ? '' : `![Generated image](${url})`,
  );

  return normalizedLinks.replace(standaloneImageUrlPattern, (_match, prefix: string, url: string) =>
    hasMarkdownImageForUrl(normalizedLinks, url) ? prefix : `${prefix}![Generated image](${url})`,
  );
}

const Markdown = memo(function Markdown({ content = '', isLatestMessage }: TContentProps) {
  const LaTeXParsing = useRecoilValue<boolean>(store.LaTeXParsing);
  const isInitializing = content === '';

  const currentContent = useMemo(() => {
    if (isInitializing) {
      return '';
    }
    const normalizedContent = normalizeImageGenerationMarkdown(content);
    return LaTeXParsing ? preprocessLaTeX(normalizedContent) : normalizedContent;
  }, [content, LaTeXParsing, isInitializing]);

  const rehypePlugins = useMemo(
    () => [
      [rehypeKatex],
      [
        rehypeHighlight,
        {
          detect: true,
          ignoreMissing: true,
          subset: langSubset,
        },
      ],
    ],
    [],
  );

  const remarkPlugins: Pluggable[] = [
    supersub,
    remarkGfm,
    remarkDirective,
    artifactPlugin,
    [remarkMath, { singleDollarTextMath: false }],
    unicodeCitation,
    mcpUIResourcePlugin,
  ];

  if (isInitializing) {
    return (
      <div className="absolute">
        <p className="relative">
          <span className={isLatestMessage ? 'result-thinking' : ''} />
        </p>
      </div>
    );
  }

  return (
    <MarkdownErrorBoundary content={content} codeExecution={true}>
      <ArtifactProvider>
        <CodeBlockProvider>
          <ReactMarkdown
            /** @ts-ignore */
            remarkPlugins={remarkPlugins}
            /* @ts-ignore */
            rehypePlugins={rehypePlugins}
            components={
              {
                code,
                a,
                p,
                img,
                artifact: Artifact,
                citation: Citation,
                'highlighted-text': HighlightedText,
                'composite-citation': CompositeCitation,
                'mcp-ui-resource': MCPUIResource,
                'mcp-ui-carousel': MCPUIResourceCarousel,
              } as {
                [nodeType: string]: React.ElementType;
              }
            }
          >
            {currentContent}
          </ReactMarkdown>
        </CodeBlockProvider>
      </ArtifactProvider>
    </MarkdownErrorBoundary>
  );
});
Markdown.displayName = 'Markdown';

export default Markdown;
