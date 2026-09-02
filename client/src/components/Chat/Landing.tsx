import { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { easings } from '@react-spring/web';
import { EModelEndpoint } from 'librechat-data-provider';
import { BirthdayIcon, TooltipAnchor, SplitText, useMediaQuery } from '@librechat/client';
import { useChatContext, useAgentsMapContext, useAssistantsMapContext } from '~/Providers';
import { useGetEndpointsQuery, useGetStartupConfig } from '~/data-provider';
import ConvoIcon from '~/components/Endpoints/ConvoIcon';
import ConversationStarters from './Input/ConversationStarters';
import { useLocalize, useAuthContext } from '~/hooks';
import { motionSpring, softRevealVariants } from '~/utils/motion';
import {
  getIconEndpoint,
  getEntity,
  getEntityEndpoint,
  isExpiringAgentAvatarUrl,
  normalizeAgentAvatarUrl,
  getStaticAgentIconUrlForName,
  normalizeAgentBrandText,
} from '~/utils';

const containerClassName = 'chat-landing-mark-shell';
const selectedToolGuideKey = 'eduToolkitSelectedToolGuide';
const titleRevealAnimationFrom = {
  opacity: 0,
  transform: 'translate3d(0,0.45rem,0)',
};
const titleRevealAnimationTo = {
  opacity: 1,
  transform: 'translate3d(0,0,0)',
};

interface SelectedToolGuide {
  agentId: string;
  name: string;
  category?: string;
  description?: string;
  avatarUrl?: string | null;
}

function getTextSizeClass(text: string | undefined | null) {
  if (!text) {
    return 'text-xl sm:text-2xl';
  }

  if (text.length < 40) {
    return 'text-2xl sm:text-4xl';
  }

  if (text.length < 70) {
    return 'text-xl sm:text-2xl';
  }

  return 'text-lg sm:text-md';
}

export default function Landing({ centerFormOnLanding }: { centerFormOnLanding: boolean }) {
  const { conversation } = useChatContext();
  const agentsMap = useAgentsMapContext();
  const assistantMap = useAssistantsMapContext();
  const { data: startupConfig } = useGetStartupConfig();
  const { data: endpointsConfig } = useGetEndpointsQuery();
  const { user } = useAuthContext();
  const localize = useLocalize();
  const shouldReduceMotion = useReducedMotion();
  const isSmallScreen = useMediaQuery('(max-width: 768px)');
  const isCustomWelcome = typeof startupConfig?.interface?.customWelcome === 'string';

  const [textHasMultipleLines, setTextHasMultipleLines] = useState(false);
  const [lineCount, setLineCount] = useState(1);
  const [contentHeight, setContentHeight] = useState(0);
  const [selectedToolGuideAvatarFailed, setSelectedToolGuideAvatarFailed] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const endpointType = useMemo(() => {
    let ep = conversation?.endpoint ?? '';
    if (ep === EModelEndpoint.azureOpenAI) {
      ep = EModelEndpoint.openAI;
    }
    return getIconEndpoint({
      endpointsConfig,
      iconURL: conversation?.iconURL,
      endpoint: ep,
    });
  }, [conversation?.endpoint, conversation?.iconURL, endpointsConfig]);

  const { entity } = getEntity({
    endpoint: getEntityEndpoint({
      conversationEndpoint: conversation?.endpoint,
      displayEndpoint: endpointType,
    }),
    agentsMap,
    assistantMap,
    agent_id: conversation?.agent_id,
    assistant_id: conversation?.assistant_id,
  });

  const name = entity?.name ?? '';
  const description = normalizeAgentBrandText((entity?.description || conversation?.greeting) ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  const selectedToolGuide = useMemo<SelectedToolGuide | null>(() => {
    if (conversation?.endpoint !== EModelEndpoint.agents || !conversation.agent_id) {
      return null;
    }

    const rawGuide = localStorage.getItem(selectedToolGuideKey);
    if (!rawGuide) {
      return null;
    }

    try {
      const guide = JSON.parse(rawGuide) as Partial<SelectedToolGuide>;
      if (guide.agentId !== conversation.agent_id || !guide.name) {
        return null;
      }

      return {
        agentId: guide.agentId,
        name: guide.name,
        category: guide.category,
        description: guide.description,
        avatarUrl: guide.avatarUrl,
      };
    } catch {
      return null;
    }
  }, [conversation?.agent_id, conversation?.endpoint]);
  const selectedToolGuideName = normalizeAgentBrandText(selectedToolGuide?.name);
  const headingName = normalizeAgentBrandText(name) || selectedToolGuideName;
  const selectedToolGuidePreferredAvatarUrl = normalizeAgentAvatarUrl(
    selectedToolGuide?.avatarUrl ?? conversation?.iconURL ?? null,
  );
  const selectedToolGuideStaticAvatarUrl = getStaticAgentIconUrlForName(
    selectedToolGuideName || name,
  );
  const selectedToolGuideAvatarUrl =
    selectedToolGuidePreferredAvatarUrl &&
    !isExpiringAgentAvatarUrl(selectedToolGuidePreferredAvatarUrl)
      ? selectedToolGuidePreferredAvatarUrl
      : (selectedToolGuideStaticAvatarUrl ?? selectedToolGuidePreferredAvatarUrl);
  const shouldShowSelectedToolGuideAvatar =
    selectedToolGuideAvatarUrl != null && !selectedToolGuideAvatarFailed;

  const getGreeting = useCallback(() => {
    if (typeof startupConfig?.interface?.customWelcome === 'string') {
      const customWelcome = normalizeAgentBrandText(startupConfig.interface.customWelcome);
      if (user?.name && customWelcome.includes('{{user.name}}')) {
        return customWelcome.replace(/{{user.name}}/g, user.name);
      }
      return customWelcome;
    }

    const now = new Date();
    const hours = now.getHours();

    const dayOfWeek = now.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    if (hours >= 0 && hours < 5) {
      return localize('com_ui_late_night');
    } else if (hours < 12) {
      if (isWeekend) {
        return localize('com_ui_weekend_morning');
      }
      return localize('com_ui_good_morning');
    } else if (hours < 17) {
      return localize('com_ui_good_afternoon');
    } else {
      return localize('com_ui_good_evening');
    }
  }, [localize, startupConfig?.interface?.customWelcome, user?.name]);

  const handleLineCountChange = useCallback((count: number) => {
    setTextHasMultipleLines(count > 1);
    setLineCount(count);
  }, []);

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.offsetHeight);
    }
  }, [lineCount, description]);

  useEffect(() => {
    setSelectedToolGuideAvatarFailed(false);
  }, [selectedToolGuideAvatarUrl]);

  const getDynamicMargin = useMemo(() => {
    let margin = 'mb-0';
    const descriptionLength = description.length;

    if (lineCount > 2 || descriptionLength > 220) {
      margin = 'mb-12';
    } else if (descriptionLength > 120) {
      margin = 'mb-10';
    } else if (lineCount > 1 || description) {
      margin = 'mb-6';
    } else if (textHasMultipleLines) {
      margin = 'mb-3';
    }

    if (contentHeight > 200) {
      margin = 'mb-16';
    } else if (contentHeight > 150) {
      margin = 'mb-12';
    }

    return margin;
  }, [lineCount, description, textHasMultipleLines, contentHeight]);

  const shouldShowMobileUserName = isSmallScreen && !isCustomWelcome && !!user?.name;
  const greetingText =
    isCustomWelcome || isSmallScreen
      ? getGreeting()
      : getGreeting() + (user?.name ? ', ' + user.name : '');
  const titleAnimationFrom = shouldReduceMotion ? titleRevealAnimationTo : titleRevealAnimationFrom;
  const titleAnimationDelay = shouldReduceMotion ? 0 : 42;

  return (
    <div
      className={`chat-landing-shell flex h-full transform-gpu flex-col items-center justify-center pb-16 transition-all duration-200 ${centerFormOnLanding ? 'max-h-full sm:max-h-0' : 'max-h-full'} ${getDynamicMargin}`}
    >
      <div ref={contentRef} className="chat-landing-content flex flex-col items-center gap-0 p-2">
        <div className="chat-landing-heading">
          <motion.div
            variants={softRevealVariants}
            initial={shouldReduceMotion ? false : 'hidden'}
            animate="visible"
            transition={shouldReduceMotion ? { duration: 0 } : motionSpring}
            className="chat-landing-mark"
          >
            {shouldShowSelectedToolGuideAvatar ? (
              <div className={containerClassName}>
                <img
                  src={selectedToolGuideAvatarUrl}
                  alt=""
                  aria-hidden="true"
                  className="chat-landing-agent-avatar"
                  loading="eager"
                  decoding="async"
                  onError={() => setSelectedToolGuideAvatarFailed(true)}
                />
              </div>
            ) : (
              <ConvoIcon
                agentsMap={agentsMap}
                assistantMap={assistantMap}
                conversation={conversation}
                endpointsConfig={endpointsConfig}
                containerClassName={containerClassName}
                context="landing"
                className="chat-landing-mark-icon"
                size={48}
              />
            )}
            {startupConfig?.showBirthdayIcon && (
              <TooltipAnchor
                className="absolute -right-1 top-0"
                description={localize('com_ui_happy_birthday')}
                aria-label={localize('com_ui_happy_birthday')}
              >
                <BirthdayIcon />
              </TooltipAnchor>
            )}
          </motion.div>
          {headingName ? (
            <div className="chat-landing-heading-copy">
              <SplitText
                key={`split-text-${headingName}`}
                text={headingName}
                className={`chat-landing-title ${getTextSizeClass(headingName)} font-medium text-text-primary`}
                delay={titleAnimationDelay}
                textAlign="center"
                animationFrom={titleAnimationFrom}
                animationTo={titleRevealAnimationTo}
                easing={easings.easeOutCubic}
                threshold={0}
                rootMargin="0px"
                onLineCountChange={handleLineCountChange}
              />
            </div>
          ) : (
            <div className="chat-landing-heading-copy">
              <SplitText
                key={`split-text-${greetingText}${user?.name ? '-user' : ''}`}
                text={greetingText}
                className={`chat-landing-title ${getTextSizeClass(greetingText)} font-medium text-text-primary`}
                delay={titleAnimationDelay}
                textAlign="center"
                animationFrom={titleAnimationFrom}
                animationTo={titleRevealAnimationTo}
                easing={easings.easeOutCubic}
                threshold={0}
                rootMargin="0px"
                onLineCountChange={handleLineCountChange}
              />
              {shouldShowMobileUserName && (
                <motion.p
                  variants={softRevealVariants}
                  initial={shouldReduceMotion ? false : 'hidden'}
                  animate="visible"
                  transition={
                    shouldReduceMotion
                      ? { duration: 0 }
                      : {
                          ...motionSpring,
                          delay: 0.08,
                        }
                  }
                  className="mt-2 max-w-[15rem] text-balance text-center text-xl font-medium leading-tight text-text-primary"
                >
                  {user?.name}
                </motion.p>
              )}
            </div>
          )}
        </div>
        {description && (
          <motion.div
            variants={softRevealVariants}
            initial={shouldReduceMotion ? false : 'hidden'}
            animate="visible"
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : {
                    ...motionSpring,
                    delay: 0.1,
                  }
            }
            className="chat-landing-description animate-fadeIn mt-4 text-center"
          >
            {description}
          </motion.div>
        )}
        <ConversationStarters />
      </div>
    </div>
  );
}
