import type t from 'librechat-data-provider';
import type { TranslationKeys, useLocalize } from '~/hooks';

type MockAgentDefinition = {
  descriptionKey: TranslationKeys;
  iconAsset: string;
  id: string;
  inputKey: TranslationKeys;
  nameKey: TranslationKeys;
  outputKey: TranslationKeys;
};

type MockAgentAvatarOptions = {
  className?: string;
  size?: 'fill' | 'xl';
};

type MockAgentOnboarding = {
  inputs: string;
  output: string;
};

const mockAgentIdPrefix = 'ethos-mock-agent-';

export const getMockMarketplaceIconSource = (iconAsset: string) => {
  if (iconAsset.endsWith('.svg')) {
    return `/assets/agent-icons/style-c/${iconAsset}`;
  }

  return `/assets/generated-agent-icons/style-c/${iconAsset}`;
};

const mockAgentDefinitions: MockAgentDefinition[] = [
  {
    id: `${mockAgentIdPrefix}lesson-plan-builder`,
    nameKey: 'com_agents_mock_lesson_plan_builder_name',
    descriptionKey: 'com_agents_mock_lesson_plan_builder_description',
    iconAsset: 'lesson-plan-builder.png',
    inputKey: 'com_agents_mock_lesson_plan_builder_inputs',
    outputKey: 'com_agents_mock_lesson_plan_builder_output',
  },
  {
    id: `${mockAgentIdPrefix}assessment-quiz-builder`,
    nameKey: 'com_agents_mock_assessment_quiz_builder_name',
    descriptionKey: 'com_agents_mock_assessment_quiz_builder_description',
    iconAsset: 'assessment-quiz-builder.png',
    inputKey: 'com_agents_mock_assessment_quiz_builder_inputs',
    outputKey: 'com_agents_mock_assessment_quiz_builder_output',
  },
  {
    id: `${mockAgentIdPrefix}rubric-creator`,
    nameKey: 'com_agents_mock_rubric_creator_name',
    descriptionKey: 'com_agents_mock_rubric_creator_description',
    iconAsset: 'rubric-creator.png',
    inputKey: 'com_agents_mock_rubric_creator_inputs',
    outputKey: 'com_agents_mock_rubric_creator_output',
  },
  {
    id: `${mockAgentIdPrefix}worksheet-generator`,
    nameKey: 'com_agents_mock_worksheet_generator_name',
    descriptionKey: 'com_agents_mock_worksheet_generator_description',
    iconAsset: 'worksheet-generator.png',
    inputKey: 'com_agents_mock_worksheet_generator_inputs',
    outputKey: 'com_agents_mock_worksheet_generator_output',
  },
  {
    id: `${mockAgentIdPrefix}vocabulary-spelling-list-builder`,
    nameKey: 'com_agents_mock_vocabulary_builder_name',
    descriptionKey: 'com_agents_mock_vocabulary_builder_description',
    iconAsset: 'vocabulary-spelling-list-builder.png',
    inputKey: 'com_agents_mock_vocabulary_builder_inputs',
    outputKey: 'com_agents_mock_vocabulary_builder_output',
  },
  {
    id: `${mockAgentIdPrefix}class-newsletter-creator`,
    nameKey: 'com_agents_mock_class_newsletter_creator_name',
    descriptionKey: 'com_agents_mock_class_newsletter_creator_description',
    iconAsset: 'class-newsletter-creator.png',
    inputKey: 'com_agents_mock_class_newsletter_creator_inputs',
    outputKey: 'com_agents_mock_class_newsletter_creator_output',
  },
  {
    id: `${mockAgentIdPrefix}504-plan-generator`,
    nameKey: 'com_agents_mock_504_plan_generator_name',
    descriptionKey: 'com_agents_mock_504_plan_generator_description',
    iconAsset: '504-plan-generator.png',
    inputKey: 'com_agents_mock_504_plan_generator_inputs',
    outputKey: 'com_agents_mock_504_plan_generator_output',
  },
  {
    id: `${mockAgentIdPrefix}announcement-writer`,
    nameKey: 'com_agents_mock_announcement_writer_name',
    descriptionKey: 'com_agents_mock_announcement_writer_description',
    iconAsset: 'announcement-writer.png',
    inputKey: 'com_agents_mock_announcement_writer_inputs',
    outputKey: 'com_agents_mock_announcement_writer_output',
  },
  {
    id: `${mockAgentIdPrefix}coloring-page-creator`,
    nameKey: 'com_agents_mock_coloring_page_creator_name',
    descriptionKey: 'com_agents_mock_coloring_page_creator_description',
    iconAsset: 'coloring-page-creator.png',
    inputKey: 'com_agents_mock_coloring_page_creator_inputs',
    outputKey: 'com_agents_mock_coloring_page_creator_output',
  },
  {
    id: `${mockAgentIdPrefix}conceptual-diagram-creator`,
    nameKey: 'com_agents_mock_conceptual_diagram_creator_name',
    descriptionKey: 'com_agents_mock_conceptual_diagram_creator_description',
    iconAsset: 'conceptual-diagram-creator.png',
    inputKey: 'com_agents_mock_conceptual_diagram_creator_inputs',
    outputKey: 'com_agents_mock_conceptual_diagram_creator_output',
  },
  {
    id: `${mockAgentIdPrefix}differentiation-adapter`,
    nameKey: 'com_agents_mock_differentiation_adapter_name',
    descriptionKey: 'com_agents_mock_differentiation_adapter_description',
    iconAsset: 'differentiation-adapter.png',
    inputKey: 'com_agents_mock_differentiation_adapter_inputs',
    outputKey: 'com_agents_mock_differentiation_adapter_output',
  },
  {
    id: `${mockAgentIdPrefix}educational-grants-funding-finder`,
    nameKey: 'com_agents_mock_educational_grants_funding_finder_name',
    descriptionKey: 'com_agents_mock_educational_grants_funding_finder_description',
    iconAsset: 'educational-grants-funding-finder.png',
    inputKey: 'com_agents_mock_educational_grants_funding_finder_inputs',
    outputKey: 'com_agents_mock_educational_grants_funding_finder_output',
  },
  {
    id: `${mockAgentIdPrefix}email-drafter`,
    nameKey: 'com_agents_mock_email_drafter_name',
    descriptionKey: 'com_agents_mock_email_drafter_description',
    iconAsset: 'email-drafter.png',
    inputKey: 'com_agents_mock_email_drafter_inputs',
    outputKey: 'com_agents_mock_email_drafter_output',
  },
  {
    id: `${mockAgentIdPrefix}letter-memo-generator`,
    nameKey: 'com_agents_mock_letter_memo_generator_name',
    descriptionKey: 'com_agents_mock_letter_memo_generator_description',
    iconAsset: 'letter-memo-generator.png',
    inputKey: 'com_agents_mock_letter_memo_generator_inputs',
    outputKey: 'com_agents_mock_letter_memo_generator_output',
  },
  {
    id: `${mockAgentIdPrefix}meeting-agenda-builder`,
    nameKey: 'com_agents_mock_meeting_agenda_builder_name',
    descriptionKey: 'com_agents_mock_meeting_agenda_builder_description',
    iconAsset: 'meeting-agenda-builder.png',
    inputKey: 'com_agents_mock_meeting_agenda_builder_inputs',
    outputKey: 'com_agents_mock_meeting_agenda_builder_output',
  },
  {
    id: `${mockAgentIdPrefix}meeting-notes-summarizer`,
    nameKey: 'com_agents_mock_meeting_notes_summarizer_name',
    descriptionKey: 'com_agents_mock_meeting_notes_summarizer_description',
    iconAsset: 'meeting-notes-summarizer.png',
    inputKey: 'com_agents_mock_meeting_notes_summarizer_inputs',
    outputKey: 'com_agents_mock_meeting_notes_summarizer_output',
  },
  {
    id: `${mockAgentIdPrefix}parent-conference-prep-sheet`,
    nameKey: 'com_agents_mock_parent_conference_prep_sheet_name',
    descriptionKey: 'com_agents_mock_parent_conference_prep_sheet_description',
    iconAsset: 'parent-conference-prep-sheet.png',
    inputKey: 'com_agents_mock_parent_conference_prep_sheet_inputs',
    outputKey: 'com_agents_mock_parent_conference_prep_sheet_output',
  },
  {
    id: `${mockAgentIdPrefix}policy-document-summarizer`,
    nameKey: 'com_agents_mock_policy_document_summarizer_name',
    descriptionKey: 'com_agents_mock_policy_document_summarizer_description',
    iconAsset: 'policy-document-summarizer.png',
    inputKey: 'com_agents_mock_policy_document_summarizer_inputs',
    outputKey: 'com_agents_mock_policy_document_summarizer_output',
  },
  {
    id: `${mockAgentIdPrefix}powerpoint-presentation-creator`,
    nameKey: 'com_agents_mock_powerpoint_presentation_creator_name',
    descriptionKey: 'com_agents_mock_powerpoint_presentation_creator_description',
    iconAsset: 'powerpoint-presentation-creator.png',
    inputKey: 'com_agents_mock_powerpoint_presentation_creator_inputs',
    outputKey: 'com_agents_mock_powerpoint_presentation_creator_output',
  },
  {
    id: `${mockAgentIdPrefix}professional-development-plan-creator`,
    nameKey: 'com_agents_mock_professional_development_plan_creator_name',
    descriptionKey: 'com_agents_mock_professional_development_plan_creator_description',
    iconAsset: 'professional-development-plan-creator.png',
    inputKey: 'com_agents_mock_professional_development_plan_creator_inputs',
    outputKey: 'com_agents_mock_professional_development_plan_creator_output',
  },
  {
    id: `${mockAgentIdPrefix}real-world-examples-generator`,
    nameKey: 'com_agents_mock_real_world_examples_generator_name',
    descriptionKey: 'com_agents_mock_real_world_examples_generator_description',
    iconAsset: 'real-world-examples-generator.png',
    inputKey: 'com_agents_mock_real_world_examples_generator_inputs',
    outputKey: 'com_agents_mock_real_world_examples_generator_output',
  },
  {
    id: `${mockAgentIdPrefix}report-card-comment-writer`,
    nameKey: 'com_agents_mock_report_card_comment_writer_name',
    descriptionKey: 'com_agents_mock_report_card_comment_writer_description',
    iconAsset: 'report-card-comment-writer.png',
    inputKey: 'com_agents_mock_report_card_comment_writer_inputs',
    outputKey: 'com_agents_mock_report_card_comment_writer_output',
  },
  {
    id: `${mockAgentIdPrefix}school-poster-designer`,
    nameKey: 'com_agents_mock_school_poster_designer_name',
    descriptionKey: 'com_agents_mock_school_poster_designer_description',
    iconAsset: 'school-poster-designer.png',
    inputKey: 'com_agents_mock_school_poster_designer_inputs',
    outputKey: 'com_agents_mock_school_poster_designer_output',
  },
  {
    id: `${mockAgentIdPrefix}social-media-post-generator`,
    nameKey: 'com_agents_mock_social_media_post_generator_name',
    descriptionKey: 'com_agents_mock_social_media_post_generator_description',
    iconAsset: 'social-media-post-generator.png',
    inputKey: 'com_agents_mock_social_media_post_generator_inputs',
    outputKey: 'com_agents_mock_social_media_post_generator_output',
  },
  {
    id: `${mockAgentIdPrefix}spreadsheet-excel-creator`,
    nameKey: 'com_agents_mock_spreadsheet_excel_creator_name',
    descriptionKey: 'com_agents_mock_spreadsheet_excel_creator_description',
    iconAsset: 'spreadsheet-excel-creator.png',
    inputKey: 'com_agents_mock_spreadsheet_excel_creator_inputs',
    outputKey: 'com_agents_mock_spreadsheet_excel_creator_output',
  },
  {
    id: `${mockAgentIdPrefix}standard-translator`,
    nameKey: 'com_agents_mock_standard_translator_name',
    descriptionKey: 'com_agents_mock_standard_translator_description',
    iconAsset: 'standard-translator.png',
    inputKey: 'com_agents_mock_standard_translator_inputs',
    outputKey: 'com_agents_mock_standard_translator_output',
  },
  {
    id: `${mockAgentIdPrefix}student-certificate-creator`,
    nameKey: 'com_agents_mock_student_certificate_creator_name',
    descriptionKey: 'com_agents_mock_student_certificate_creator_description',
    iconAsset: 'student-certificate-creator.png',
    inputKey: 'com_agents_mock_student_certificate_creator_inputs',
    outputKey: 'com_agents_mock_student_certificate_creator_output',
  },
  {
    id: `${mockAgentIdPrefix}survey-builder`,
    nameKey: 'com_agents_mock_survey_builder_name',
    descriptionKey: 'com_agents_mock_survey_builder_description',
    iconAsset: 'survey-builder.png',
    inputKey: 'com_agents_mock_survey_builder_inputs',
    outputKey: 'com_agents_mock_survey_builder_output',
  },
  {
    id: `${mockAgentIdPrefix}translation-assistant`,
    nameKey: 'com_agents_mock_translation_assistant_name',
    descriptionKey: 'com_agents_mock_translation_assistant_description',
    iconAsset: 'translation-assistant.png',
    inputKey: 'com_agents_mock_translation_assistant_inputs',
    outputKey: 'com_agents_mock_translation_assistant_output',
  },
  {
    id: `${mockAgentIdPrefix}word-doc-and-pdf-generator`,
    nameKey: 'com_agents_mock_word_doc_and_pdf_generator_name',
    descriptionKey: 'com_agents_mock_word_doc_and_pdf_generator_description',
    iconAsset: 'word-doc-and-pdf-generator.png',
    inputKey: 'com_agents_mock_word_doc_and_pdf_generator_inputs',
    outputKey: 'com_agents_mock_word_doc_and_pdf_generator_output',
  },
  {
    id: `${mockAgentIdPrefix}youtube-video-finder`,
    nameKey: 'com_agents_mock_youtube_video_finder_name',
    descriptionKey: 'com_agents_mock_youtube_video_finder_description',
    iconAsset: 'youtube-video-finder.png',
    inputKey: 'com_agents_mock_youtube_video_finder_inputs',
    outputKey: 'com_agents_mock_youtube_video_finder_output',
  },
  {
    id: `${mockAgentIdPrefix}lesson-plan-enhancer`,
    nameKey: 'com_agents_mock_lesson_plan_enhancer_name',
    descriptionKey: 'com_agents_mock_lesson_plan_enhancer_description',
    iconAsset: 'lesson-plan-enhancer.png',
    inputKey: 'com_agents_mock_lesson_plan_enhancer_inputs',
    outputKey: 'com_agents_mock_lesson_plan_enhancer_output',
  },
  {
    id: `${mockAgentIdPrefix}powerpoint-presentation-enhancer`,
    nameKey: 'com_agents_mock_powerpoint_presentation_enhancer_name',
    descriptionKey: 'com_agents_mock_powerpoint_presentation_enhancer_description',
    iconAsset: 'powerpoint-presentation-enhancer.png',
    inputKey: 'com_agents_mock_powerpoint_presentation_enhancer_inputs',
    outputKey: 'com_agents_mock_powerpoint_presentation_enhancer_output',
  },
  {
    id: `${mockAgentIdPrefix}agent-creation-agent`,
    nameKey: 'com_agents_mock_agent_creation_agent_name',
    descriptionKey: 'com_agents_mock_agent_creation_agent_description',
    iconAsset: 'agent-creation-agent.png',
    inputKey: 'com_agents_mock_agent_creation_agent_inputs',
    outputKey: 'com_agents_mock_agent_creation_agent_output',
  },
  {
    id: `${mockAgentIdPrefix}ethos-educate-support`,
    nameKey: 'com_agents_mock_ethos_educate_support_name',
    descriptionKey: 'com_agents_mock_ethos_educate_support_description',
    iconAsset: 'ethos-educate-support.png',
    inputKey: 'com_agents_mock_ethos_educate_support_inputs',
    outputKey: 'com_agents_mock_ethos_educate_support_output',
  },
  {
    id: `${mockAgentIdPrefix}mvp-culture-champion-assistant`,
    nameKey: 'com_agents_mock_mvp_culture_champion_assistant_name',
    descriptionKey: 'com_agents_mock_mvp_culture_champion_assistant_description',
    iconAsset: 'mvp-culture-champion-assistant.png',
    inputKey: 'com_agents_mock_mvp_culture_champion_assistant_inputs',
    outputKey: 'com_agents_mock_mvp_culture_champion_assistant_output',
  },
  {
    id: `${mockAgentIdPrefix}podcast-creator`,
    nameKey: 'com_agents_mock_podcast_creator_name',
    descriptionKey: 'com_agents_mock_podcast_creator_description',
    iconAsset: 'podcast-creator.png',
    inputKey: 'com_agents_mock_podcast_creator_inputs',
    outputKey: 'com_agents_mock_podcast_creator_output',
  },
  {
    id: `${mockAgentIdPrefix}transcript-to-worksheet`,
    nameKey: 'com_agents_mock_transcript_to_worksheet_name',
    descriptionKey: 'com_agents_mock_transcript_to_worksheet_description',
    iconAsset: 'transcript-to-worksheet.png',
    inputKey: 'com_agents_mock_transcript_to_worksheet_inputs',
    outputKey: 'com_agents_mock_transcript_to_worksheet_output',
  },
  {
    id: `${mockAgentIdPrefix}eoy-intech-support-guide`,
    nameKey: 'com_agents_mock_eoy_intech_support_guide_name',
    descriptionKey: 'com_agents_mock_eoy_intech_support_guide_description',
    iconAsset: 'eoy-intech-support-guide.png',
    inputKey: 'com_agents_mock_eoy_intech_support_guide_inputs',
    outputKey: 'com_agents_mock_eoy_intech_support_guide_output',
  },
  {
    id: `${mockAgentIdPrefix}eoy-power-school-guide`,
    nameKey: 'com_agents_mock_eoy_power_school_guide_name',
    descriptionKey: 'com_agents_mock_eoy_power_school_guide_description',
    iconAsset: 'eoy-power-school-guide.png',
    inputKey: 'com_agents_mock_eoy_power_school_guide_inputs',
    outputKey: 'com_agents_mock_eoy_power_school_guide_output',
  },
  {
    id: `${mockAgentIdPrefix}vocabulary-spelling-list-activity-creator`,
    nameKey: 'com_agents_mock_vocabulary_activity_creator_name',
    descriptionKey: 'com_agents_mock_vocabulary_activity_creator_description',
    iconAsset: 'vocabulary-spelling-list-activity-creator.png',
    inputKey: 'com_agents_mock_vocabulary_activity_creator_inputs',
    outputKey: 'com_agents_mock_vocabulary_activity_creator_output',
  },
  {
    id: `${mockAgentIdPrefix}logo-editor-agent`,
    nameKey: 'com_agents_mock_logo_editor_agent_name',
    descriptionKey: 'com_agents_mock_logo_editor_agent_description',
    iconAsset: 'logo-editor-agent.png',
    inputKey: 'com_agents_mock_logo_editor_agent_inputs',
    outputKey: 'com_agents_mock_logo_editor_agent_output',
  },
  {
    id: `${mockAgentIdPrefix}prompt-creation-agent`,
    nameKey: 'com_agents_mock_prompt_creation_agent_name',
    descriptionKey: 'com_agents_mock_prompt_creation_agent_description',
    iconAsset: 'prompt-creation-agent.png',
    inputKey: 'com_agents_mock_prompt_creation_agent_inputs',
    outputKey: 'com_agents_mock_prompt_creation_agent_output',
  },
];

const getMockAgentDefinition = (agent: Pick<t.Agent, 'id'> | null | undefined) =>
  mockAgentDefinitions.find((definition) => definition.id === agent?.id);

export const isMockMarketplaceAgent = (agent: Pick<t.Agent, 'id'> | null | undefined) =>
  getMockAgentDefinition(agent) != null;

export const getMockMarketplaceAgentOnboarding = (
  agent: Pick<t.Agent, 'id'> | null | undefined,
  localize: ReturnType<typeof useLocalize>,
): MockAgentOnboarding | null => {
  const definition = getMockAgentDefinition(agent);

  if (definition == null) {
    return null;
  }

  return {
    inputs: localize(definition.inputKey),
    output: localize(definition.outputKey),
  };
};

export const renderMockMarketplaceAvatar = (
  agent: Pick<t.Agent, 'id'> | null | undefined,
  { className = '', size = 'fill' }: MockAgentAvatarOptions = {},
) => {
  const definition = getMockAgentDefinition(agent);

  if (definition == null) {
    return null;
  }

  return (
    <span
      aria-hidden="true"
      className={`mock-marketplace-agent-icon mock-marketplace-agent-icon--${size} ${className}`}
    >
      <img
        alt=""
        className="mock-marketplace-agent-icon-image"
        src={getMockMarketplaceIconSource(definition.iconAsset)}
      />
    </span>
  );
};

export const getMockMarketplaceAgents = (localize: ReturnType<typeof useLocalize>): t.Agent[] =>
  mockAgentDefinitions.map((definition, index) => ({
    id: definition.id,
    name: localize(definition.nameKey),
    description: localize(definition.descriptionKey),
    avatar: {
      filepath: `assets/generated-agent-icons/${definition.iconAsset}`,
      source: 'ethos-toolkit',
    },
    created_at: 1_740_000_000 + index,
    provider: 'openAI',
    model: null,
    model_parameters: {
      temperature: null,
      maxContextTokens: null,
      max_context_tokens: null,
      max_output_tokens: null,
      top_p: null,
      frequency_penalty: null,
      presence_penalty: null,
    },
    category: 'general',
    isPublic: true,
  }));
