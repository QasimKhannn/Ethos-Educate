import React from 'react';
import { FileSources } from 'librechat-data-provider';
import { useToastContext } from '@librechat/client';
import { useCodeOutputDownload, useFileDownload } from '~/data-provider';
import { useLocalize } from '~/hooks';

interface LogLinkProps {
  href: string;
  filename: string;
  file_id?: string;
  user?: string;
  source?: string;
  children: React.ReactNode;
}

interface AttachmentLinkOptions {
  href: string;
  filename: string;
  file_id?: string;
  user?: string;
  source?: string;
}

/**
 * Determines if a file is stored locally (not an external API URL).
 * Files with these sources are stored on the LibreChat server and should
 * use the /api/files/download endpoint instead of direct URL access.
 */
const isLocallyStoredSource = (source?: string): boolean => {
  if (!source) {
    return false;
  }
  return [FileSources.local, FileSources.firebase, FileSources.s3, FileSources.azure_blob].includes(
    source as FileSources,
  );
};

const isUnavailableDownloadHref = (href: string): boolean => {
  if (!href || href === '/') {
    return true;
  }

  try {
    const url = new URL(href, window.location.origin);
    return url.origin === window.location.origin && url.pathname === '/';
  } catch {
    return false;
  }
};

export const useAttachmentLink = ({
  href,
  filename,
  file_id,
  user,
  source,
}: AttachmentLinkOptions) => {
  const { showToast } = useToastContext();
  const localize = useLocalize();

  const useLocalDownload = isLocallyStoredSource(source) && !!file_id && !!user;
  const { refetch: downloadFromApi } = useFileDownload(user, file_id);
  const { refetch: downloadFromUrl } = useCodeOutputDownload(href);

  const handleDownload = async (event: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
    event.preventDefault();

    if (!useLocalDownload && isUnavailableDownloadHref(href)) {
      showToast({
        status: 'error',
        message: localize('com_ui_download_unavailable'),
      });
      return;
    }

    try {
      const stream = useLocalDownload ? await downloadFromApi() : await downloadFromUrl();
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

  return { handleDownload };
};

const LogLink: React.FC<LogLinkProps> = ({ href, filename, file_id, user, source, children }) => {
  const { handleDownload } = useAttachmentLink({ href, filename, file_id, user, source });
  return (
    <a
      href={href}
      onClick={handleDownload}
      target="_blank"
      rel="noopener noreferrer"
      className="!text-blue-400 visited:!text-purple-400 hover:underline"
    >
      {children}
    </a>
  );
};

export default LogLink;
