import { useState, useEffect } from 'react';
import { Skeleton } from '@librechat/client';

export function NoImage() {
  return (
    <div className="border-token-border-medium flex h-full w-full items-center justify-center rounded-full border-2 border-dashed border-black">
      <svg
        stroke="currentColor"
        fill="none"
        strokeWidth="2"
        viewBox="0 0 24 24"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-4xl"
        height="1em"
        width="1em"
        xmlns="http://www.w3.org/2000/svg"
      >
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    </div>
  );
}

export const AgentAvatarRender = ({ url }: { url?: string }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  useEffect(() => {
    setIsLoaded(false);
  }, [url]);

  return (
    <div>
      <div className="relative h-20 w-20 overflow-hidden rounded-full">
        <img
          src={url}
          className="bg-token-surface-secondary dark:bg-token-surface-tertiary h-full w-full rounded-full object-cover"
          alt="Agent avatar"
          width="80"
          height="80"
          loading="lazy"
          key={url || 'default-key'}
          onLoad={() => setIsLoaded(true)}
          onError={() => setIsLoaded(false)}
          style={{
            opacity: isLoaded ? 1 : 0,
            transition: 'opacity 0.2s ease-in-out',
          }}
        />
        {!isLoaded && <Skeleton className="absolute inset-0 rounded-full" aria-hidden="true" />}
      </div>
    </div>
  );
};
