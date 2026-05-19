import type t from 'librechat-data-provider';

type MockMarketplaceAgent = t.Agent & {
  marketplacePromoted?: boolean;
};

interface SupportContact {
  name?: string;
  email?: string;
}

const defaultAgentAvatarPath = '/assets/agent-icons/default-agent.svg';

const agentAvatarByName: Record<string, string> = {
  '504 Plan Generator': '/assets/agent-icons/504-plan-generator.svg',
  'Announcement Writer': '/assets/agent-icons/announcement-writer.svg',
  'Assessment Item Analyzer': defaultAgentAvatarPath,
  'Assessment Quiz Builder': '/assets/agent-icons/assessment-quiz-builder.svg',
  'Budget Variance Explainer': defaultAgentAvatarPath,
  'Class Newsletter Creator': '/assets/agent-icons/class-newsletter-creator.svg',
  'Coloring Page Creator': '/assets/agent-icons/coloring-page-creator.svg',
  'Conceptual Diagram Creator': '/assets/agent-icons/conceptual-diagram-creator.svg',
  'Curriculum Pilot Researcher': defaultAgentAvatarPath,
  'Device Ticket Triage': defaultAgentAvatarPath,
  'Differentiation Adapter': '/assets/agent-icons/differentiation-adapter.svg',
  'District Outreach Sequence': defaultAgentAvatarPath,
  'Educational Grants & Funding Finder':
    '/assets/agent-icons/educational-grants-funding-finder.svg',
  'Email Drafter': '/assets/agent-icons/email-drafter.svg',
  'Enrollment Campaign Builder': defaultAgentAvatarPath,
  'Family Follow-Up Drafter': defaultAgentAvatarPath,
  'Interview Feedback Assistant': defaultAgentAvatarPath,
  'Lesson Plan Builder': '/assets/agent-icons/lesson-plan-builder.svg',
  'Letter & Memo Generator': '/assets/agent-icons/letter-memo-generator.svg',
  'Meeting Agenda Builder': '/assets/agent-icons/meeting-agenda-builder.svg',
  'Meeting Notes Summarizer': '/assets/agent-icons/meeting-notes-summarizer.svg',
  'Parent Conference Prep Sheet': '/assets/agent-icons/parent-conference-prep-sheet.svg',
  'Policy & Document Summarizer': '/assets/agent-icons/policy-document-summarizer.svg',
  'PowerPoint Presentation Creator': '/assets/agent-icons/powerpoint-presentation-creator.svg',
  'Procurement Summary Writer': defaultAgentAvatarPath,
  'Professional & Development Plan Creator':
    '/assets/agent-icons/professional-development-plan-creator.svg',
  'Real World Examples Generator': '/assets/agent-icons/real-world-examples-generator.svg',
  'Report Card Comment Writer': '/assets/agent-icons/report-card-comment-writer.svg',
  'Rubric Creator': '/assets/agent-icons/rubric-creator.svg',
  'School Poster Designer': '/assets/agent-icons/school-poster-designer.svg',
  'SIS Integration Checklist': defaultAgentAvatarPath,
  'Social Media Post Generator': '/assets/agent-icons/social-media-post-generator.svg',
  'Spreadsheet (Excel) Creator': '/assets/agent-icons/spreadsheet-excel-creator.svg',
  'Staff Onboarding Planner': defaultAgentAvatarPath,
  'Standard Translator': '/assets/agent-icons/standard-translator.svg',
  'Student Certificate Creator': '/assets/agent-icons/student-certificate-creator.svg',
  'Survey Builder': '/assets/agent-icons/survey-builder.svg',
  'Translation Assistant': '/assets/agent-icons/translation-assistant.svg',
  'Vocabulary/Spelling List Builder': '/assets/agent-icons/vocabulary-spelling-list-builder.svg',
  'Word Doc and PDF Generator': '/assets/agent-icons/word-doc-and-pdf-generator.svg',
  'Worksheet Generator': '/assets/agent-icons/worksheet-generator.svg',
  'YouTube Video Finder': '/assets/agent-icons/youtube-video-finder.svg',
};

export const getMockMarketplaceAgentAvatar = (name?: string | null): string | null =>
  name ? (agentAvatarByName[name] ?? defaultAgentAvatarPath) : null;

const createMockAgentAvatar = (filepath?: string | null): t.Agent['avatar'] =>
  filepath ? { filepath, source: 'mock-marketplace' } : null;

const defaultModelParameters: t.AgentModelParameters = {
  temperature: 0.4,
  maxContextTokens: 16000,
  max_context_tokens: 16000,
  max_output_tokens: 2400,
  top_p: 1,
  frequency_penalty: 0,
  presence_penalty: 0,
  useResponsesApi: true,
};

const baseCreatedAt = new Date('2026-04-20T08:00:00.000Z').getTime();

const categoryAliases: Record<string, string> = {
  general: 'general',
  hr: 'human_resources',
  human_resources: 'human_resources',
  rd: 'research_development',
  research_development: 'research_development',
  finance: 'finance',
  it: 'it',
  sales: 'sales',
  aftersales: 'after_sales',
  after_sales: 'after_sales',
};

const mockCategoryLabels: Record<string, Pick<t.TMarketplaceCategory, 'description' | 'label'>> = {
  general: {
    label: 'com_agents_category_general',
    description: 'com_agents_category_general_description',
  },
  human_resources: {
    label: 'com_agents_category_hr',
    description: 'com_agents_category_hr_description',
  },
  research_development: {
    label: 'com_agents_category_rd',
    description: 'com_agents_category_rd_description',
  },
  finance: {
    label: 'com_agents_category_finance',
    description: 'com_agents_category_finance_description',
  },
  it: {
    label: 'com_agents_category_it',
    description: 'com_agents_category_it_description',
  },
  sales: {
    label: 'com_agents_category_sales',
    description: 'com_agents_category_sales_description',
  },
  after_sales: {
    label: 'com_agents_category_aftersales',
    description: 'com_agents_category_aftersales_description',
  },
};

const normalizeCategoryValue = (value?: string | null) => {
  const normalizedValue =
    value
      ?.trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_') ?? '';
  return categoryAliases[normalizedValue] ?? normalizedValue;
};

const normalizeSearchValue = (value?: string | null) => value?.trim().toLowerCase() ?? '';

const parseCursor = (cursor?: string) => {
  const parsedCursor = Number(cursor);
  return Number.isFinite(parsedCursor) && parsedCursor > 0 ? parsedCursor : 0;
};

const createMockAgent = ({
  avatar,
  created_at,
  description,
  id,
  instructions,
  marketplacePromoted,
  name,
  category,
  conversation_starters,
  support_contact,
}: {
  avatar?: t.Agent['avatar'];
  created_at: number;
  description: string;
  id: string;
  instructions: string;
  marketplacePromoted?: boolean;
  name: string;
  category: string;
  conversation_starters?: string[];
  support_contact?: SupportContact;
}): MockMarketplaceAgent => ({
  id,
  name,
  author: 'Ethos Intelligence',
  authorName: 'Ethos Intelligence',
  description,
  created_at,
  avatar: avatar ?? createMockAgentAvatar(agentAvatarByName[name]),
  instructions,
  metadata: {
    mockMarketplace: true,
  },
  provider: 'openai',
  model: 'gpt-4.1',
  model_parameters: defaultModelParameters,
  conversation_starters,
  category,
  marketplacePromoted,
  support_contact,
});

const toMarketplaceAgent = ({
  marketplacePromoted: _marketplacePromoted,
  ...agent
}: MockMarketplaceAgent): t.Agent => agent;

const matchesSearch = (agent: MockMarketplaceAgent, normalizedSearch: string) => {
  if (!normalizedSearch) {
    return true;
  }

  const searchableValues = [
    agent.name,
    agent.description,
    agent.authorName,
    agent.instructions,
  ].filter((value): value is string => typeof value === 'string' && value.length > 0);

  return searchableValues.some((value) => value.toLowerCase().includes(normalizedSearch));
};

export const mockMarketplaceAgents: MockMarketplaceAgent[] = [
  createMockAgent({
    id: 'mock-student-certificate-creator',
    name: 'Student Certificate Creator',
    description:
      'Designs personalized, print-ready student achievement certificates with milestone-specific language and layout guidance.',
    category: 'general',
    created_at: baseCreatedAt,
    instructions:
      'Create polished certificate copy, title options, and a clean certificate structure for school celebrations.',
    conversation_starters: [
      'Draft a certificate for perfect attendance',
      'Write certificate text for a science fair winner',
    ],
    marketplacePromoted: true,
  }),
  createMockAgent({
    id: 'mock-educational-grants-funding-finder',
    name: 'Educational Grants & Funding Finder',
    description:
      'Searches for currently active grants and funding opportunities matched to the specific school context for individual teachers, schools, or districts with eligibility, award amounts, deadlines, and application links. Inputs required: who is applying, what funding is needed for, school type, grade levels served, state or region, and approximate funding amount needed.',
    category: 'general',
    created_at: baseCreatedAt - 1,
    instructions:
      'Identify currently active education grants and funding opportunities based on who is applying, the intended use of funds, school type, grade levels served, state or region, and approximate funding amount needed. Return eligibility, award amount, deadline, and application link for each relevant result.',
    conversation_starters: [
      'Find grants for STEM lab upgrades in Texas middle schools',
      'List funding sources for after-school literacy programs in urban elementary schools',
    ],
    marketplacePromoted: true,
    support_contact: {
      name: 'Ethos Intelligence',
    },
  }),
  createMockAgent({
    id: 'mock-spreadsheet-excel-creator',
    name: 'Spreadsheet (Excel) Creator',
    description:
      'Builds formula-ready spreadsheets for grade books, budgets, attendance tracking, rubrics, and school operations.',
    category: 'general',
    created_at: baseCreatedAt - 2,
    instructions:
      'Return spreadsheet structures, formula suggestions, and practical setup notes for educators and administrators.',
    conversation_starters: [
      'Build an attendance tracking spreadsheet',
      'Create an academic intervention tracker',
    ],
  }),
  createMockAgent({
    id: 'mock-social-media-post-generator',
    name: 'Social Media Post Generator',
    description:
      'Creates concise, school-safe social posts for announcements, campus highlights, student wins, and parent engagement.',
    category: 'general',
    created_at: baseCreatedAt - 3,
    instructions:
      'Write platform-ready captions with a positive tone, concise structure, and optional hashtag suggestions.',
    conversation_starters: [
      'Write a Facebook post about our honor roll celebration',
      'Draft an Instagram caption for teacher appreciation week',
    ],
  }),
  createMockAgent({
    id: 'mock-conceptual-diagram-creator',
    name: 'Conceptual Diagram Creator',
    description:
      'Creates structured, labeled diagrams for educational concepts, systems thinking, and lesson planning visuals.',
    category: 'general',
    created_at: baseCreatedAt - 4,
    instructions:
      'Organize concepts into a clear visual hierarchy and describe the best diagram structure for the lesson goal.',
    conversation_starters: [
      'Outline a water cycle concept map',
      'Create a compare-and-contrast diagram for ecosystems',
    ],
  }),
  createMockAgent({
    id: 'mock-standards-translator',
    name: 'Standard Translator',
    description:
      'Turns academic standards into plain-language learning goals, student-facing can-do statements, and family-friendly summaries.',
    category: 'general',
    created_at: baseCreatedAt - 5,
    instructions:
      'Translate standards into accessible language without losing rigor or instructional intent.',
    conversation_starters: [
      'Translate this math standard for 5th grade students',
      'Create a parent-friendly summary of this literacy standard',
    ],
  }),
  createMockAgent({
    id: 'mock-staff-onboarding-planner',
    name: 'Staff Onboarding Planner',
    description:
      'Builds structured onboarding plans for teachers, paraprofessionals, and campus hires with role-specific milestones.',
    category: 'human_resources',
    created_at: baseCreatedAt - 6,
    instructions:
      'Create a practical onboarding schedule with checklists, training milestones, and first-month priorities.',
    conversation_starters: [
      'Create a 30-day onboarding plan for a new teacher',
      'List onboarding tasks for a front office coordinator',
    ],
    marketplacePromoted: true,
  }),
  createMockAgent({
    id: 'mock-interview-feedback-assistant',
    name: 'Interview Feedback Assistant',
    description:
      'Summarizes interview notes into balanced feedback, hiring recommendations, and next-step prompts for school leaders.',
    category: 'human_resources',
    created_at: baseCreatedAt - 7,
    instructions:
      'Turn structured notes into concise, professional interview feedback with strengths, gaps, and recommendation logic.',
    conversation_starters: [
      'Summarize notes from a teacher interview',
      'Write a hiring recommendation for a counselor candidate',
    ],
  }),
  createMockAgent({
    id: 'mock-curriculum-pilot-researcher',
    name: 'Curriculum Pilot Researcher',
    description:
      'Reviews pilot goals, compares program options, and organizes evidence for curriculum adoption decisions.',
    category: 'research_development',
    created_at: baseCreatedAt - 8,
    instructions:
      'Compare curriculum options against district goals, implementation needs, and measurable pilot outcomes.',
    conversation_starters: [
      'Compare two literacy intervention programs',
      'Create pilot evaluation criteria for a new curriculum',
    ],
  }),
  createMockAgent({
    id: 'mock-assessment-item-analyzer',
    name: 'Assessment Item Analyzer',
    description:
      'Examines item rigor, alignment, and misconceptions to help teams improve formative and benchmark assessments.',
    category: 'research_development',
    created_at: baseCreatedAt - 9,
    instructions:
      'Review assessment items for standard alignment, cognitive demand, and clarity of distractors.',
    conversation_starters: [
      'Analyze these benchmark questions for rigor',
      'Identify likely misconceptions in this exit ticket',
    ],
  }),
  createMockAgent({
    id: 'mock-budget-variance-explainer',
    name: 'Budget Variance Explainer',
    description:
      'Translates budget movement into clear narratives for principals, finance teams, and executive updates.',
    category: 'finance',
    created_at: baseCreatedAt - 10,
    instructions:
      'Explain budget deltas, categorize major drivers, and surface follow-up questions for stakeholders.',
    conversation_starters: [
      'Explain this department budget variance',
      'Summarize quarter-over-quarter budget changes',
    ],
    marketplacePromoted: true,
  }),
  createMockAgent({
    id: 'mock-procurement-summary-writer',
    name: 'Procurement Summary Writer',
    description:
      'Converts purchasing details into concise procurement summaries, approval notes, and vendor comparison narratives.',
    category: 'finance',
    created_at: baseCreatedAt - 11,
    instructions:
      'Summarize procurement requests with justification, cost context, and a clean recommendation.',
    conversation_starters: [
      'Draft an approval summary for Chromebook purchases',
      'Compare two vendor bids for classroom furniture',
    ],
  }),
  createMockAgent({
    id: 'mock-device-ticket-triage',
    name: 'Device Ticket Triage',
    description:
      'Sorts common support requests into clear triage categories, likely causes, and next actions for campus IT teams.',
    category: 'it',
    created_at: baseCreatedAt - 12,
    instructions:
      'Categorize device issues, propose quick troubleshooting steps, and flag escalation risks.',
    conversation_starters: [
      'Triage a batch of student Chromebook tickets',
      'Create response steps for a classroom Wi-Fi issue',
    ],
  }),
  createMockAgent({
    id: 'mock-sis-integration-checklist',
    name: 'SIS Integration Checklist',
    description:
      'Builds rollout checklists for SIS integrations, rostering changes, and data validation across school systems.',
    category: 'it',
    created_at: baseCreatedAt - 13,
    instructions:
      'Create practical implementation checklists for SIS, rostering, and sync validation workstreams.',
    conversation_starters: [
      'Create a checklist for a new rostering sync',
      'List data validation steps before SIS go-live',
    ],
  }),
  createMockAgent({
    id: 'mock-enrollment-campaign-builder',
    name: 'Enrollment Campaign Builder',
    description:
      'Creates outreach sequences, campaign messages, and follow-up ideas for family recruitment and school choice events.',
    category: 'sales',
    created_at: baseCreatedAt - 14,
    instructions:
      'Write concise campaign messaging for prospective families across email, SMS, and event follow-ups.',
    conversation_starters: [
      'Build a spring enrollment email sequence',
      'Draft SMS reminders for an open house campaign',
    ],
  }),
  createMockAgent({
    id: 'mock-district-outreach-sequence',
    name: 'District Outreach Sequence',
    description:
      'Builds professional outreach sequences for district partnerships, renewals, and stakeholder follow-up.',
    category: 'sales',
    created_at: baseCreatedAt - 15,
    instructions:
      'Draft concise outreach touchpoints with clear value propositions and next-step asks.',
    conversation_starters: [
      'Write a district partnership follow-up email',
      'Create a 3-step outreach sequence for a renewal conversation',
    ],
  }),
  createMockAgent({
    id: 'mock-parent-conference-prep-sheet',
    name: 'Parent Conference Prep Sheet',
    description:
      'Converts academic, attendance, and behavior notes into a clean parent conference prep summary for teachers.',
    category: 'after_sales',
    created_at: baseCreatedAt - 16,
    instructions:
      'Organize student context into a concise conference prep document with strengths, concerns, and next actions.',
    conversation_starters: [
      'Prepare talking points for a parent conference',
      'Summarize student attendance and intervention notes',
    ],
    marketplacePromoted: true,
  }),
  createMockAgent({
    id: 'mock-family-follow-up-drafter',
    name: 'Family Follow-Up Drafter',
    description:
      'Drafts warm, professional follow-up messages after parent meetings, support plans, and school touchpoints.',
    category: 'after_sales',
    created_at: baseCreatedAt - 17,
    instructions:
      'Write clear follow-up messages that recap key points, reinforce support, and define next steps.',
    conversation_starters: [
      'Draft a follow-up email after a family meeting',
      'Write a recap message for an attendance intervention call',
    ],
  }),
  createMockAgent({
    id: 'mock-lesson-plan-builder',
    name: 'Lesson Plan Builder',
    description:
      'Creates standards-aligned lesson plans with objectives, activities, checks for understanding, and differentiation notes.',
    category: 'general',
    created_at: baseCreatedAt - 18,
    instructions:
      'Build practical lesson plans with clear learning targets, timed activities, materials, assessments, and extension options.',
    conversation_starters: [
      'Create a 45-minute lesson plan for fractions',
      'Build a lesson plan for analyzing primary sources',
    ],
    marketplacePromoted: true,
  }),
  createMockAgent({
    id: 'mock-rubric-creator',
    name: 'Rubric Creator',
    description:
      'Builds student-friendly analytic rubrics for projects, writing assignments, presentations, and performance tasks.',
    category: 'general',
    created_at: baseCreatedAt - 19,
    instructions:
      'Create clear rubric criteria, performance levels, point values, and language students can understand.',
    conversation_starters: [
      'Create a rubric for a science project',
      'Build a writing rubric for 7th grade essays',
    ],
  }),
  createMockAgent({
    id: 'mock-worksheet-generator',
    name: 'Worksheet Generator',
    description:
      'Generates printable practice worksheets with directions, examples, answer keys, and optional challenge sections.',
    category: 'general',
    created_at: baseCreatedAt - 20,
    instructions:
      'Create grade-appropriate worksheet content with clear instructions, varied item types, and a concise answer key.',
    conversation_starters: [
      'Make a worksheet for multiplying decimals',
      'Create reading comprehension questions for this passage',
    ],
  }),
  createMockAgent({
    id: 'mock-differentiation-adapter',
    name: 'Differentiation Adapter',
    description:
      'Adapts lessons, tasks, and materials for different readiness levels, language needs, accommodations, and enrichment.',
    category: 'general',
    created_at: baseCreatedAt - 21,
    instructions:
      'Modify instructional materials with practical scaffolds, extensions, accessibility supports, and small-group options.',
    conversation_starters: [
      'Differentiate this lesson for English learners',
      'Adapt this assignment for advanced students and students needing support',
    ],
  }),
  createMockAgent({
    id: 'mock-504-plan-generator',
    name: '504 Plan Generator',
    description:
      'Drafts structured 504 plan language, accommodation ideas, and classroom support notes for school teams.',
    category: 'general',
    created_at: baseCreatedAt - 22,
    instructions:
      'Create clear, school-appropriate 504 planning language with practical accommodations and implementation notes.',
    conversation_starters: [
      'Draft accommodations for attention and organization needs',
      'Create classroom support notes for a 504 meeting',
    ],
  }),
  createMockAgent({
    id: 'mock-report-card-comment-writer',
    name: 'Report Card Comment Writer',
    description:
      'Writes constructive report card comments that balance student strengths, growth areas, and next steps.',
    category: 'general',
    created_at: baseCreatedAt - 23,
    instructions:
      'Draft concise, professional report card comments with a warm tone and actionable academic or behavior next steps.',
    conversation_starters: [
      'Write report card comments for improving participation',
      'Draft a positive comment for strong reading growth',
    ],
  }),
  createMockAgent({
    id: 'mock-vocabulary-spelling-list-builder',
    name: 'Vocabulary/Spelling List Builder',
    description:
      'Creates vocabulary and spelling lists with definitions, examples, practice activities, and review prompts.',
    category: 'general',
    created_at: baseCreatedAt - 24,
    instructions:
      'Build age-appropriate word lists with student-friendly definitions, usage examples, and practice ideas.',
    conversation_starters: [
      'Create a vocabulary list for a weather unit',
      'Make a spelling list with practice sentences',
    ],
  }),
  createMockAgent({
    id: 'mock-assessment-quiz-builder',
    name: 'Assessment Quiz Builder',
    description:
      'Creates formative quizzes, exit tickets, and short assessments with answer keys and alignment notes.',
    category: 'general',
    created_at: baseCreatedAt - 25,
    instructions:
      'Write assessment items with a mix of formats, clear answer keys, and brief alignment notes for instructional use.',
    conversation_starters: [
      'Create a 10-question quiz on ecosystems',
      'Build an exit ticket for linear equations',
    ],
    marketplacePromoted: true,
  }),
  createMockAgent({
    id: 'mock-class-newsletter-creator',
    name: 'Class Newsletter Creator',
    description:
      'Drafts polished classroom newsletters with updates, reminders, highlights, and family-friendly formatting.',
    category: 'general',
    created_at: baseCreatedAt - 26,
    instructions:
      'Create clear newsletter copy with sections for learning updates, dates, reminders, celebrations, and family action items.',
    conversation_starters: [
      'Draft a weekly classroom newsletter',
      'Create a family update for our field trip week',
    ],
  }),
  createMockAgent({
    id: 'mock-announcement-writer',
    name: 'Announcement Writer',
    description:
      'Writes concise school announcements for events, reminders, schedule changes, and campus celebrations.',
    category: 'general',
    created_at: baseCreatedAt - 27,
    instructions:
      'Draft clear announcements with the right tone, audience, timing, and call to action for school communications.',
    conversation_starters: [
      'Write a morning announcement for picture day',
      'Draft a parent announcement about early dismissal',
    ],
  }),
  createMockAgent({
    id: 'mock-school-poster-designer',
    name: 'School Poster Designer',
    description:
      'Creates poster copy, layout direction, and visual hierarchy for school events, clubs, reminders, and campaigns.',
    category: 'general',
    created_at: baseCreatedAt - 28,
    instructions:
      'Return poster-ready headline options, concise supporting copy, layout notes, and accessibility-conscious design guidance.',
    conversation_starters: [
      'Design copy for a book fair poster',
      'Create a poster concept for attendance awareness',
    ],
  }),
  createMockAgent({
    id: 'mock-coloring-page-creator',
    name: 'Coloring Page Creator',
    description:
      'Generates classroom-friendly coloring page concepts with simple scenes, labels, and subject-specific prompts.',
    category: 'general',
    created_at: baseCreatedAt - 29,
    instructions:
      'Describe clean coloring page layouts with simple line-art elements, educational labels, and age-appropriate details.',
    conversation_starters: [
      'Create a coloring page idea for the water cycle',
      'Design a classroom rules coloring page',
    ],
  }),
  createMockAgent({
    id: 'mock-powerpoint-presentation-creator',
    name: 'PowerPoint Presentation Creator',
    description:
      'Builds slide outlines, speaker notes, and classroom presentation structures for lessons, meetings, and trainings.',
    category: 'general',
    created_at: baseCreatedAt - 30,
    instructions:
      'Create slide-by-slide presentation plans with titles, key bullets, visual suggestions, and optional speaker notes.',
    conversation_starters: [
      'Create a 10-slide presentation on ecosystems',
      'Build slides for a staff training agenda',
    ],
  }),
  createMockAgent({
    id: 'mock-word-doc-and-pdf-generator',
    name: 'Word Doc and PDF Generator',
    description:
      'Drafts structured document content for handouts, guides, forms, letters, and printable school materials.',
    category: 'general',
    created_at: baseCreatedAt - 31,
    instructions:
      'Create polished document-ready content with headings, sections, tables where useful, and print-friendly organization.',
    conversation_starters: ['Create a parent permission form', 'Draft a printable study guide'],
  }),
  createMockAgent({
    id: 'mock-translation-assistant',
    name: 'Translation Assistant',
    description:
      'Translates school-facing communication while preserving tone, clarity, and family-friendly language.',
    category: 'general',
    created_at: baseCreatedAt - 32,
    instructions:
      'Translate or adapt school messages with clear language, cultural sensitivity, and concise formatting.',
    conversation_starters: [
      'Translate this parent email into Spanish',
      'Adapt this message for multilingual families',
    ],
  }),
  createMockAgent({
    id: 'mock-youtube-video-finder',
    name: 'YouTube Video Finder',
    description:
      'Helps identify classroom-appropriate YouTube video search targets, vetting criteria, and viewing guides.',
    category: 'general',
    created_at: baseCreatedAt - 33,
    instructions:
      'Suggest targeted search terms, evaluation criteria, and discussion prompts for finding useful instructional videos.',
    conversation_starters: [
      'Find video search ideas for photosynthesis',
      'Create a viewing guide for a history video',
    ],
  }),
  createMockAgent({
    id: 'mock-real-world-examples-generator',
    name: 'Real World Examples Generator',
    description:
      'Connects academic concepts to practical, student-relevant examples, scenarios, and classroom discussion prompts.',
    category: 'general',
    created_at: baseCreatedAt - 34,
    instructions:
      'Generate concrete real-world examples that make abstract concepts easier to teach and discuss.',
    conversation_starters: [
      'Give real-world examples of ratios',
      'Create everyday scenarios for persuasive writing',
    ],
  }),
  createMockAgent({
    id: 'mock-meeting-agenda-builder',
    name: 'Meeting Agenda Builder',
    description:
      'Creates focused meeting agendas with outcomes, time blocks, discussion prompts, and follow-up sections.',
    category: 'general',
    created_at: baseCreatedAt - 35,
    instructions:
      'Build practical agendas with purpose, timing, decision points, roles, and next-step capture fields.',
    conversation_starters: [
      'Create an agenda for a grade-level PLC',
      'Build a staff meeting agenda for data review',
    ],
  }),
  createMockAgent({
    id: 'mock-meeting-notes-summarizer',
    name: 'Meeting Notes Summarizer',
    description:
      'Turns rough meeting notes into organized summaries, decisions, action items, owners, and follow-up reminders.',
    category: 'general',
    created_at: baseCreatedAt - 36,
    instructions:
      'Summarize notes into concise sections with decisions, action items, open questions, and next meeting topics.',
    conversation_starters: [
      'Summarize these PLC meeting notes',
      'Turn this meeting transcript into action items',
    ],
  }),
  createMockAgent({
    id: 'mock-policy-document-summarizer',
    name: 'Policy & Document Summarizer',
    description:
      'Summarizes policies, handbooks, reports, and long documents into key points, implications, and action items.',
    category: 'research_development',
    created_at: baseCreatedAt - 37,
    instructions:
      'Create clear summaries of long documents with audience-specific takeaways, risks, requirements, and follow-up questions.',
    conversation_starters: [
      'Summarize this district policy for teachers',
      'Pull action items from this handbook section',
    ],
  }),
  createMockAgent({
    id: 'mock-letter-memo-generator',
    name: 'Letter & Memo Generator',
    description:
      'Drafts professional school letters, memos, notices, and internal communication with clear structure and tone.',
    category: 'general',
    created_at: baseCreatedAt - 38,
    instructions:
      'Write polished letters or memos with the correct audience, purpose, concise body copy, and next-step language.',
    conversation_starters: [
      'Draft a memo about updated procedures',
      'Write a parent letter about a school event',
    ],
  }),
  createMockAgent({
    id: 'mock-email-drafter',
    name: 'Email Drafter',
    description:
      'Writes professional, concise emails for families, staff, vendors, and district partners.',
    category: 'general',
    created_at: baseCreatedAt - 39,
    instructions:
      'Draft emails with a clear subject line, appropriate tone, concise body, and direct call to action.',
    conversation_starters: [
      'Draft an email to families about testing week',
      'Write a follow-up email to a vendor',
    ],
  }),
  createMockAgent({
    id: 'mock-professional-development-plan-creator',
    name: 'Professional & Development Plan Creator',
    description:
      'Creates professional development plans with goals, learning activities, timelines, evidence, and reflection prompts.',
    category: 'human_resources',
    created_at: baseCreatedAt - 40,
    instructions:
      'Build practical development plans for educators or staff with measurable goals, supports, milestones, and evidence of growth.',
    conversation_starters: [
      'Create a PD plan for classroom management',
      'Build a development plan for instructional coaching',
    ],
  }),
  createMockAgent({
    id: 'mock-survey-builder',
    name: 'Survey Builder',
    description:
      'Creates surveys for families, staff, and students with focused questions, response scales, and analysis notes.',
    category: 'research_development',
    created_at: baseCreatedAt - 41,
    instructions:
      'Design concise surveys with clear objectives, accessible wording, balanced response options, and practical analysis guidance.',
    conversation_starters: [
      'Create a parent feedback survey',
      'Build a staff survey about professional learning needs',
    ],
  }),
];

export const getMockMarketplaceCategories = (): t.TMarketplaceCategory[] => {
  const counts = mockMarketplaceAgents.reduce<Map<string, number>>((categoryCounts, agent) => {
    const categoryValue = normalizeCategoryValue(agent.category);
    categoryCounts.set(categoryValue, (categoryCounts.get(categoryValue) ?? 0) + 1);
    return categoryCounts;
  }, new Map<string, number>());

  const categories = Object.entries(mockCategoryLabels).reduce<t.TMarketplaceCategory[]>(
    (items, [value, metadata]) => {
      const count = counts.get(value) ?? 0;
      if (count === 0) {
        return items;
      }

      items.push({
        value,
        count,
        label: metadata.label,
        description: metadata.description,
      });
      return items;
    },
    [],
  );

  return [
    ...categories,
    {
      value: 'all',
      label: 'com_agents_all_category',
      description: 'com_agents_all_description',
      count: mockMarketplaceAgents.length,
    },
  ];
};

export const getMockMarketplaceAgentsResponse = (
  params: t.AgentListParams,
): t.AgentListResponse => {
  const normalizedCategory = normalizeCategoryValue(params.category);
  const normalizedSearch = normalizeSearchValue(params.search);
  const pageSize = Math.max(params.limit ?? 10, 1);
  const pageStart = parseCursor(params.cursor);

  const matchingAgents = mockMarketplaceAgents.reduce<t.Agent[]>((agents, agent) => {
    if (params.promoted === 1 && agent.marketplacePromoted !== true) {
      return agents;
    }

    if (
      normalizedCategory &&
      normalizedCategory !== 'all' &&
      normalizeCategoryValue(agent.category) !== normalizedCategory
    ) {
      return agents;
    }

    if (!matchesSearch(agent, normalizedSearch)) {
      return agents;
    }

    agents.push(toMarketplaceAgent(agent));
    return agents;
  }, []);

  const pageData = matchingAgents.slice(pageStart, pageStart + pageSize);
  const nextPageStart = pageStart + pageData.length;
  const hasMore = nextPageStart < matchingAgents.length;

  return {
    object: 'list',
    data: pageData,
    first_id: pageData[0]?.id ?? '',
    last_id: pageData[pageData.length - 1]?.id ?? '',
    has_more: hasMore,
    after: hasMore ? String(nextPageStart) : undefined,
  };
};
