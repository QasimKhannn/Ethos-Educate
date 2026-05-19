import { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { easings } from '@react-spring/web';
import { EModelEndpoint } from 'librechat-data-provider';
import { BirthdayIcon, TooltipAnchor, SplitText, useMediaQuery } from '@librechat/client';
import type { TranslationKeys } from '~/hooks';
import { useChatContext, useAgentsMapContext, useAssistantsMapContext } from '~/Providers';
import { useGetEndpointsQuery, useGetStartupConfig } from '~/data-provider';
import ConvoIcon from '~/components/Endpoints/ConvoIcon';
import { useLocalize, useAuthContext } from '~/hooks';
import { motionSpring, softRevealVariants } from '~/utils/motion';
import { getIconEndpoint, getEntity } from '~/utils';

const containerClassName = 'chat-landing-mark-shell';
const selectedToolGuideKey = 'eduToolkitSelectedToolGuide';
const defaultGuidePlaceholderKey: TranslationKeys = 'com_agents_guide_placeholder_default';
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

const getToolGuideFieldKeys = (toolName: string): TranslationKeys[] => {
  const normalizedName = toolName.toLowerCase();

  if (normalizedName.includes('certificate')) {
    return [
      'com_agents_guide_field_student_name',
      'com_agents_guide_field_certificate_for',
      'com_agents_guide_field_grade_section',
      'com_agents_guide_field_tone_style',
      'com_agents_guide_field_date_signatory',
    ];
  }

  if (normalizedName.includes('grant') || normalizedName.includes('funding')) {
    return [
      'com_agents_guide_field_applicant',
      'com_agents_guide_field_funding_need',
      'com_agents_guide_field_school_context',
      'com_agents_guide_field_region',
      'com_agents_guide_field_amount',
    ];
  }

  if (normalizedName.includes('spreadsheet') || normalizedName.includes('excel')) {
    return [
      'com_agents_guide_field_spreadsheet_goal',
      'com_agents_guide_field_columns',
      'com_agents_guide_field_sample_rows',
      'com_agents_guide_field_formulas',
    ];
  }

  if (normalizedName.includes('social media')) {
    return [
      'com_agents_guide_field_platform',
      'com_agents_guide_field_audience',
      'com_agents_guide_field_message_goal',
      'com_agents_guide_field_tone_style',
    ];
  }

  if (normalizedName.includes('onboarding')) {
    return [
      'com_agents_guide_field_role',
      'com_agents_guide_field_timeline',
      'com_agents_guide_field_milestones',
      'com_agents_guide_field_resources',
    ];
  }

  return [
    'com_agents_guide_field_goal',
    'com_agents_guide_field_context',
    'com_agents_guide_field_audience',
    'com_agents_guide_field_output_format',
  ];
};

const guideFieldPlaceholderKeys = {
  com_agents_guide_field_amount: 'com_agents_guide_placeholder_amount',
  com_agents_guide_field_applicant: 'com_agents_guide_placeholder_applicant',
  com_agents_guide_field_audience: 'com_agents_guide_placeholder_audience',
  com_agents_guide_field_certificate_for: 'com_agents_guide_placeholder_certificate_for',
  com_agents_guide_field_columns: 'com_agents_guide_placeholder_columns',
  com_agents_guide_field_context: 'com_agents_guide_placeholder_context',
  com_agents_guide_field_date_signatory: 'com_agents_guide_placeholder_date_signatory',
  com_agents_guide_field_formulas: 'com_agents_guide_placeholder_formulas',
  com_agents_guide_field_funding_need: 'com_agents_guide_placeholder_funding_need',
  com_agents_guide_field_goal: 'com_agents_guide_placeholder_goal',
  com_agents_guide_field_grade_section: 'com_agents_guide_placeholder_grade_section',
  com_agents_guide_field_message_goal: 'com_agents_guide_placeholder_message_goal',
  com_agents_guide_field_milestones: 'com_agents_guide_placeholder_milestones',
  com_agents_guide_field_output_format: 'com_agents_guide_placeholder_output_format',
  com_agents_guide_field_platform: 'com_agents_guide_placeholder_platform',
  com_agents_guide_field_region: 'com_agents_guide_placeholder_region',
  com_agents_guide_field_resources: 'com_agents_guide_placeholder_resources',
  com_agents_guide_field_role: 'com_agents_guide_placeholder_role',
  com_agents_guide_field_sample_rows: 'com_agents_guide_placeholder_sample_rows',
  com_agents_guide_field_school_context: 'com_agents_guide_placeholder_school_context',
  com_agents_guide_field_spreadsheet_goal: 'com_agents_guide_placeholder_spreadsheet_goal',
  com_agents_guide_field_student_name: 'com_agents_guide_placeholder_student_name',
  com_agents_guide_field_timeline: 'com_agents_guide_placeholder_timeline',
  com_agents_guide_field_tone_style: 'com_agents_guide_placeholder_tone_style',
} satisfies Partial<Record<TranslationKeys, TranslationKeys>>;

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
    endpoint: endpointType,
    agentsMap,
    assistantMap,
    agent_id: conversation?.agent_id,
    assistant_id: conversation?.assistant_id,
  });

  const name = entity?.name ?? '';
  const description = (entity?.description || conversation?.greeting) ?? '';
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
  const selectedToolGuideFieldKeys = useMemo(
    () => (selectedToolGuide ? getToolGuideFieldKeys(selectedToolGuide.name) : []),
    [selectedToolGuide],
  );
  const selectedToolGuideFields = useMemo(
    () =>
      selectedToolGuideFieldKeys.map((key) => {
        const placeholderKey = guideFieldPlaceholderKeys[key] ?? defaultGuidePlaceholderKey;

        return {
          key,
          label: localize(key),
          placeholder: localize(placeholderKey),
        };
      }),
    [localize, selectedToolGuideFieldKeys],
  );
  const [selectedToolGuideValues, setSelectedToolGuideValues] = useState<
    Partial<Record<TranslationKeys, string>>
  >({});
  const selectedToolGuideCompletedCount = useMemo(
    () =>
      selectedToolGuideFieldKeys.reduce((count, key) => {
        const value = selectedToolGuideValues[key]?.trim();
        return value ? count + 1 : count;
      }, 0),
    [selectedToolGuideFieldKeys, selectedToolGuideValues],
  );
  const selectedToolGuideProgress =
    selectedToolGuideFields.length > 0
      ? selectedToolGuideCompletedCount / selectedToolGuideFields.length
      : 0;

  const handleSelectedToolGuideFieldChange = useCallback((key: TranslationKeys, value: string) => {
    setSelectedToolGuideValues((currentValues) => ({
      ...currentValues,
      [key]: value,
    }));
  }, []);
  const headingName = name || selectedToolGuide?.name || '';
  const selectedToolGuideAvatarUrl =
    selectedToolGuide?.avatarUrl ?? conversation?.iconURL ?? null;

  const getGreeting = useCallback(() => {
    if (typeof startupConfig?.interface?.customWelcome === 'string') {
      const customWelcome = startupConfig.interface.customWelcome;
      // Replace {{user.name}} with actual user name if available
      if (user?.name && customWelcome.includes('{{user.name}}')) {
        return customWelcome.replace(/{{user.name}}/g, user.name);
      }
      return customWelcome;
    }

    const now = new Date();
    const hours = now.getHours();

    const dayOfWeek = now.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Early morning (midnight to 4:59 AM)
    if (hours >= 0 && hours < 5) {
      return localize('com_ui_late_night');
    }
    // Morning (6 AM to 11:59 AM)
    else if (hours < 12) {
      if (isWeekend) {
        return localize('com_ui_weekend_morning');
      }
      return localize('com_ui_good_morning');
    }
    // Afternoon (12 PM to 4:59 PM)
    else if (hours < 17) {
      return localize('com_ui_good_afternoon');
    }
    // Evening (5 PM to 8:59 PM)
    else {
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
  }, [lineCount, description, selectedToolGuideFields.length]);

  useEffect(() => {
    setSelectedToolGuideValues({});
  }, [selectedToolGuide?.agentId]);

  const getDynamicMargin = useMemo(() => {
    let margin = 'mb-0';

    if (selectedToolGuideFields.length > 0) {
      return 'mb-40';
    }

    if (lineCount > 2 || (description && description.length > 100)) {
      margin = 'mb-10';
    } else if (lineCount > 1 || (description && description.length > 0)) {
      margin = 'mb-6';
    } else if (textHasMultipleLines) {
      margin = 'mb-4';
    }

    if (contentHeight > 200) {
      margin = 'mb-16';
    } else if (contentHeight > 150) {
      margin = 'mb-12';
    }

    return margin;
  }, [lineCount, description, textHasMultipleLines, contentHeight, selectedToolGuideFields.length]);

  const shouldShowMobileUserName = isSmallScreen && !isCustomWelcome && !!user?.name;
  const greetingText =
    isCustomWelcome || isSmallScreen
      ? getGreeting()
      : getGreeting() + (user?.name ? ', ' + user.name : '');
  const titleAnimationFrom = shouldReduceMotion ? titleRevealAnimationTo : titleRevealAnimationFrom;
  const titleAnimationDelay = shouldReduceMotion ? 0 : 42;

  return (
    <div
      className={`chat-landing-shell flex h-full transform-gpu flex-col items-center justify-center pb-16 transition-all duration-200 ${selectedToolGuideFields.length > 0 ? 'chat-landing-shell-selected-tool' : ''} ${centerFormOnLanding ? 'max-h-full sm:max-h-0' : 'max-h-full'} ${getDynamicMargin}`}
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
            {selectedToolGuideAvatarUrl ? (
              <div className={containerClassName}>
                <img
                  src={selectedToolGuideAvatarUrl}
                  alt=""
                  aria-hidden="true"
                  className="chat-landing-agent-avatar"
                  loading="lazy"
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
                  className="mt-2 max-w-[15rem] text-balance text-center text-xl font-medium leading-tight tracking-[-0.025em] text-text-primary"
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
            className="chat-landing-description animate-fadeIn mt-4 max-w-md text-center text-sm font-normal text-text-primary"
          >
            {description}
          </motion.div>
        )}
        {selectedToolGuide && (
          <motion.div
            variants={softRevealVariants}
            initial={shouldReduceMotion ? false : 'hidden'}
            animate="visible"
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : {
                    ...motionSpring,
                    delay: 0.16,
                  }
            }
            className="chat-selected-tool-guide"
            role="region"
            aria-label={`${selectedToolGuide.name} ${localize('com_agents_guide_setup_details')}`}
          >
            <div className="chat-selected-tool-guide-body">
              <div className="chat-selected-tool-guide-heading-row">
                <div className="chat-selected-tool-guide-heading-copy">
                  <h2>{localize('com_agents_guide_setup_details')}</h2>
                  <p>{localize('com_agents_guide_fill_in')}</p>
                </div>
                <div
                  className="chat-selected-tool-guide-progress"
                  aria-label={localize('com_agents_guide_details_added', {
                    0: String(selectedToolGuideCompletedCount),
                    1: String(selectedToolGuideFields.length),
                  })}
                >
                  <span className="chat-selected-tool-guide-progress-text">
                    {localize('com_agents_guide_details_added', {
                      0: String(selectedToolGuideCompletedCount),
                      1: String(selectedToolGuideFields.length),
                    })}
                  </span>
                  <span className="chat-selected-tool-guide-progress-track" aria-hidden="true">
                    <span
                      className="chat-selected-tool-guide-progress-bar"
                      style={{ transform: `scaleX(${selectedToolGuideProgress})` }}
                    />
                  </span>
                </div>
              </div>
              <form
                className="chat-selected-tool-guide-form"
                onSubmit={(event) => event.preventDefault()}
              >
                {selectedToolGuideFields.map((field) => {
                  const value = selectedToolGuideValues[field.key] ?? '';
                  const isFilled = value.trim().length > 0;

                  return (
                    <label
                      className="chat-selected-tool-guide-field"
                      data-filled={isFilled ? 'true' : 'false'}
                      key={field.key}
                    >
                      <span className="chat-selected-tool-guide-label">{field.label}</span>
                      <span className="chat-selected-tool-guide-input-shell">
                        <input
                          value={value}
                          onChange={(event) =>
                            handleSelectedToolGuideFieldChange(field.key, event.currentTarget.value)
                          }
                          placeholder={field.placeholder}
                        />
                        <span className="chat-selected-tool-guide-field-check" aria-hidden="true">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      </span>
                    </label>
                  );
                })}
              </form>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
