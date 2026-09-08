import { useMemo, useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { Button } from '@librechat/client';
import { TriangleAlert } from 'lucide-react';
import {
  Constants,
  dataService,
  actionDelimiter,
  actionDomainSeparator,
} from 'librechat-data-provider';
import type { TAttachment } from 'librechat-data-provider';
import type { ToolActivityStatus } from './ToolActivityCard';
import { useMessageContext } from '~/Providers';
import { useLocalize, useProgress } from '~/hooks';
import { AttachmentGroup } from './Parts';
import ExpiredGeneratedArtifact from './ExpiredGeneratedArtifact';
import Markdown from './Markdown';
import ToolCallInfo from './ToolCallInfo';
import ToolActivityCard from './ToolActivityCard';
import {
  getGeneratedArtifactDisplayText,
  getGeneratedDocumentLinks,
  splitGeneratedDocumentLinksByExpiry,
} from './generatedArtifacts';
import { getToolActivityPresentation } from './toolPresentation';
import { logger, cn } from '~/utils';

function getToolActivityStatus(
  error: boolean,
  progress: number,
  isSubmitting: boolean,
  hasPendingAuth: boolean,
): ToolActivityStatus {
  if (error) {
    return 'failed';
  }
  if (progress >= 1) {
    return 'completed';
  }
  if (hasPendingAuth && isSubmitting) {
    return 'needs_auth';
  }
  if (!isSubmitting) {
    return 'interrupted';
  }
  return 'working';
}

export default function ToolCall({
  initialProgress = 0.1,
  isLast = false,
  isSubmitting,
  name,
  args: _args = '',
  output,
  attachments,
  auth,
}: {
  initialProgress: number;
  isLast?: boolean;
  isSubmitting: boolean;
  name: string;
  args: string | Record<string, unknown>;
  output?: string | null;
  attachments?: TAttachment[];
  auth?: string;
  expires_at?: number;
}) {
  const localize = useLocalize();
  const { generatedArtifactExpiries } = useMessageContext();
  const [showInfo, setShowInfo] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | undefined>(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const prevShowInfoRef = useRef<boolean>(showInfo);

  const { function_name, domain, isMCPToolCall, mcpServerName } = useMemo(() => {
    if (typeof name !== 'string') {
      return { function_name: '', domain: null, isMCPToolCall: false, mcpServerName: '' };
    }
    if (name.includes(Constants.mcp_delimiter)) {
      const [func, server] = name.split(Constants.mcp_delimiter);
      return {
        function_name: func || '',
        domain: server && (server.replaceAll(actionDomainSeparator, '.') || null),
        isMCPToolCall: true,
        mcpServerName: server || '',
      };
    }
    const [func, _domain] = name.includes(actionDelimiter)
      ? name.split(actionDelimiter)
      : [name, ''];
    return {
      function_name: func || '',
      domain: _domain && (_domain.replaceAll(actionDomainSeparator, '.') || null),
      isMCPToolCall: false,
      mcpServerName: '',
    };
  }, [name]);

  const actionId = useMemo(() => {
    if (isMCPToolCall || !auth) {
      return '';
    }
    try {
      const url = new URL(auth);
      const redirectUri = url.searchParams.get('redirect_uri') || '';
      const match = redirectUri.match(/\/api\/actions\/([^/]+)\/oauth\/callback/);
      return match?.[1] || '';
    } catch {
      return '';
    }
  }, [auth, isMCPToolCall]);

  const handleOAuthClick = useCallback(async () => {
    if (!auth) {
      return;
    }
    try {
      if (isMCPToolCall && mcpServerName) {
        await dataService.bindMCPOAuth(mcpServerName);
      } else if (actionId) {
        await dataService.bindActionOAuth(actionId);
      }
    } catch (e) {
      logger.error('Failed to bind OAuth CSRF cookie', e);
    }
    window.open(auth, '_blank', 'noopener,noreferrer');
  }, [auth, isMCPToolCall, mcpServerName, actionId]);

  const displayOutput = useMemo(
    () => (typeof output === 'string' ? getGeneratedArtifactDisplayText(output) : output),
    [output],
  );
  const normalizedOutput =
    typeof displayOutput === 'string' ? displayOutput.trim().toLowerCase() : '';
  const error =
    normalizedOutput.includes('error processing tool') || normalizedOutput.startsWith('error:');

  const generatedDocuments = useMemo(
    () => getGeneratedDocumentLinks(displayOutput),
    [displayOutput],
  );
  const generatedDocumentGroups = useMemo(
    () => splitGeneratedDocumentLinksByExpiry(generatedDocuments, generatedArtifactExpiries),
    [generatedDocuments, generatedArtifactExpiries],
  );
  const generatedDocumentMarkdown = useMemo(
    () =>
      generatedDocumentGroups.available
        .map(({ filename, href }) => `[${filename}](${href})`)
        .join('\n\n'),
    [generatedDocumentGroups.available],
  );

  const args = useMemo(() => {
    if (typeof _args === 'string') {
      return _args;
    }
    try {
      return JSON.stringify(_args, null, 2);
    } catch (e) {
      logger.error(
        'client/src/components/Chat/Messages/Content/ToolCall.tsx - Failed to stringify args',
        e,
      );
      return '';
    }
  }, [_args]) as string | undefined;

  const hasInfo = useMemo(
    () => (args?.length ?? 0) > 0 || (displayOutput?.length ?? 0) > 0,
    [args, displayOutput],
  );

  const authDomain = useMemo(() => {
    const authURL = auth ?? '';
    if (!authURL) {
      return '';
    }
    try {
      const url = new URL(authURL);
      return url.hostname;
    } catch (e) {
      logger.error(
        'client/src/components/Chat/Messages/Content/ToolCall.tsx - Failed to parse auth URL',
        e,
      );
      return '';
    }
  }, [auth]);

  const progress = useProgress(initialProgress);
  const status = getToolActivityStatus(error, progress, isSubmitting, authDomain.length > 0);
  const presentation = getToolActivityPresentation(function_name, mcpServerName);
  const showActivityCard =
    status === 'working' ||
    status === 'needs_auth' ||
    (status === 'completed' &&
      presentation.category !== 'image' &&
      presentation.category !== 'document');

  useLayoutEffect(() => {
    if (showInfo !== prevShowInfoRef.current) {
      prevShowInfoRef.current = showInfo;
      setIsAnimating(true);

      if (showInfo && contentRef.current) {
        requestAnimationFrame(() => {
          if (contentRef.current) {
            const height = contentRef.current.scrollHeight;
            setContentHeight(height + 4);
          }
        });
      } else {
        setContentHeight(0);
      }

      const timer = setTimeout(() => {
        setIsAnimating(false);
      }, 400);

      return () => clearTimeout(timer);
    }
  }, [showInfo]);

  useEffect(() => {
    if (!contentRef.current) {
      return;
    }
    const resizeObserver = new ResizeObserver((entries) => {
      if (showInfo && !isAnimating) {
        for (const entry of entries) {
          if (entry.target === contentRef.current) {
            setContentHeight(entry.contentRect.height + 4);
          }
        }
      }
    });
    resizeObserver.observe(contentRef.current);
    return () => {
      resizeObserver.disconnect();
    };
  }, [showInfo, isAnimating]);

  if (!isLast && (!function_name || function_name.length === 0) && !output) {
    return null;
  }

  return (
    <>
      {showActivityCard && (
        <ToolActivityCard
          hasDetails={hasInfo}
          isExpanded={showInfo}
          onToggleDetails={() => setShowInfo((prev) => !prev)}
          presentation={presentation}
          status={status}
        />
      )}
      <div
        className="relative"
        style={{
          height: showInfo ? contentHeight : 0,
          overflow: 'hidden',
          transition:
            'height 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          opacity: showInfo ? 1 : 0,
          transformOrigin: 'top',
          willChange: 'height, opacity',
          perspective: '1000px',
          backfaceVisibility: 'hidden',
          WebkitFontSmoothing: 'subpixel-antialiased',
        }}
      >
        <div
          className={cn(
            'overflow-hidden rounded-xl border border-border-light bg-surface-secondary shadow-md',
            showInfo && 'shadow-lg',
          )}
          style={{
            transform: showInfo ? 'translateY(0) scale(1)' : 'translateY(-8px) scale(0.98)',
            opacity: showInfo ? 1 : 0,
            transition:
              'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <div ref={contentRef}>
            {showInfo && hasInfo && (
              <ToolCallInfo
                key="tool-call-info"
                input={args ?? ''}
                output={displayOutput}
                domain={authDomain || (domain ?? '')}
                function_name={function_name}
                pendingAuth={status === 'needs_auth'}
                attachments={attachments}
              />
            )}
          </div>
        </div>
      </div>
      {generatedDocumentMarkdown && (
        <div className="my-2 rounded-lg border border-border-light bg-surface-secondary px-3 py-2 text-sm">
          <Markdown content={generatedDocumentMarkdown} isLatestMessage={isLast} />
        </div>
      )}
      {generatedDocumentGroups.expired.length > 0 && (
        <ExpiredGeneratedArtifact
          artifactType="document"
          count={generatedDocumentGroups.expired.length}
        />
      )}
      {auth != null && auth && status === 'needs_auth' && (
        <div className="flex w-full flex-col gap-2.5">
          <div className="mb-1 mt-2">
            <Button
              className="font-mediu inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm"
              variant="default"
              rel="noopener noreferrer"
              onClick={handleOAuthClick}
            >
              {localize('com_ui_sign_in_to_domain', { 0: authDomain })}
            </Button>
          </div>
          <p className="flex items-center text-xs text-text-warning">
            <TriangleAlert className="mr-1.5 inline-block h-4 w-4" aria-hidden="true" />
            {localize('com_assistants_allow_sites_you_trust')}
          </p>
        </div>
      )}
      {attachments && attachments.length > 0 && <AttachmentGroup attachments={attachments} />}
    </>
  );
}
