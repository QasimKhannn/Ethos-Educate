const fs = require('fs');
const mongoose = require('mongoose');

const promptCardsByAgentName = {
  '504 Plan Generator': [
    {
      label: 'Draft a 504 plan',
      description: 'Turn student needs into a review-ready accommodation plan.',
      prompt:
        'Create a draft Section 504 accommodation plan for a student. I will provide the student grade, diagnosis or documented need, learning barriers, current supports, classroom concerns, assessment needs, and any school context. Organize the plan into practical accommodations, staff responsibilities, implementation notes, and review considerations. Keep the language professional, student-centered, and appropriate for school team review.',
    },
    {
      label: 'Review accommodations',
      description: 'Check an existing plan for clarity, coverage, and gaps.',
      prompt:
        'Review this existing 504 plan or accommodation list. Identify what is clear, what may be missing, what could be more measurable, and which accommodations may need stronger implementation details. Keep feedback practical for a school-based 504 team and avoid medical or legal conclusions.',
    },
    {
      label: 'Meeting prep notes',
      description: 'Prepare talking points and questions for a 504 meeting.',
      prompt:
        'Help me prepare for a 504 meeting. I will share the student context, concerns, current accommodations, parent or teacher input, and meeting goal. Create a concise prep sheet with agenda items, questions to ask, evidence to review, possible accommodations, and neutral talking points for the team.',
    },
  ],
  'Announcement Writer': [
    {
      label: 'School announcement',
      description: 'Write a clear announcement for families or staff.',
      prompt:
        'Write a polished school announcement. I will provide the audience, topic, date, key details, action needed, deadline, and tone. Make it clear, warm, concise, and ready to send, with a subject line and a short version if helpful.',
    },
    {
      label: 'Reminder message',
      description: 'Create a short reminder with the next action upfront.',
      prompt:
        'Create a reminder announcement for this school item. Put the most important action first, include the date/time/location if provided, and make the message easy for busy families or staff to scan. Include a subject line and a brief text-message version.',
    },
    {
      label: 'Urgent update',
      description: 'Make a time-sensitive notice calm and direct.',
      prompt:
        'Draft an urgent but calm school update. I will share what happened, who is affected, what people should do now, what is being handled by the school, and where to ask questions. Keep the tone professional, reassuring, and direct.',
    },
  ],
  'Assessment & Quiz Builder': [
    {
      label: 'Build a quiz',
      description: 'Generate questions aligned to a topic or standard.',
      prompt:
        'Create an assessment or quiz for this topic. I will provide the grade, standard or learning target, content to assess, question count, difficulty, and preferred question types. Include an answer key, point values, and a mix of recall, application, and higher-order questions.',
    },
    {
      label: 'Exit ticket',
      description: 'Make a quick check for understanding.',
      prompt:
        'Create a short exit ticket for today\'s lesson. I will provide the grade, objective, and what students practiced. Include 3 to 5 questions, a quick answer key, and one follow-up suggestion based on common misunderstandings.',
    },
    {
      label: 'Revise questions',
      description: 'Improve assessment items for rigor and clarity.',
      prompt:
        'Review and improve these quiz or assessment questions. Check for clarity, alignment, appropriate difficulty, bias, answer quality, and whether the questions truly measure the intended skill. Provide revised questions and a clean answer key.',
    },
  ],
  'Class Newsletter Creator': [
    {
      label: 'Weekly newsletter',
      description: 'Turn class updates into a family-ready newsletter.',
      prompt:
        'Create a weekly class newsletter. I will provide the grade, dates, learning highlights, reminders, upcoming events, homework or practice notes, celebrations, and any family action items. Make it friendly, organized, and easy to scan.',
    },
    {
      label: 'Event newsletter',
      description: 'Write a focused update for a class event or unit.',
      prompt:
        'Create a class newsletter section for this upcoming event or unit. Include what students are doing, why it matters, important dates, what families should know, and how they can support at home. Keep it warm and concise.',
    },
    {
      label: 'Simplify update',
      description: 'Make a draft newsletter clearer and shorter.',
      prompt:
        'Improve this class newsletter draft. Make it easier for families to read, reduce repetition, organize it into clear sections, and keep the tone positive and professional. Preserve all important dates and action items.',
    },
  ],
  'Coloring Page Creator': [
    {
      label: 'Topic coloring page',
      description: 'Create a classroom coloring page concept.',
      prompt:
        'Design a printable coloring page concept for this lesson topic. I will provide the grade, subject, topic, vocabulary, and any visual elements to include or avoid. Describe the page layout clearly and include a short student-facing caption.',
    },
    {
      label: 'Vocabulary page',
      description: 'Build a coloring page around key terms.',
      prompt:
        'Create a vocabulary-based coloring page. I will provide the terms, grade level, and topic. For each term, suggest a simple visual element that students can color, plus a brief label or definition that fits on the page.',
    },
    {
      label: 'Early finisher activity',
      description: 'Make a low-prep activity tied to current content.',
      prompt:
        'Create an early finisher coloring activity tied to this lesson. Include the visual concept, student directions, optional challenge questions, and a short teacher note explaining how it reinforces the content.',
    },
  ],
  'Conceptual Diagram Creator': [
    {
      label: 'Create a diagram',
      description: 'Turn a concept into a clear visual structure.',
      prompt:
        'Create a conceptual diagram for this topic. I will provide the grade, concept, key terms, relationships, and desired format if I have one. Give me a clean diagram plan with labels, arrows or groupings, and a short explanation for students.',
    },
    {
      label: 'Compare ideas',
      description: 'Show relationships, similarities, and differences.',
      prompt:
        'Build a visual comparison diagram for these ideas. Organize the similarities, differences, cause-and-effect links, or categories in a way students can understand. Include suggested labels and a brief teacher explanation.',
    },
    {
      label: 'Process flow',
      description: 'Map a sequence, cycle, or workflow.',
      prompt:
        'Create a process-flow diagram for this sequence or cycle. I will share the steps and any key vocabulary. Make the order clear, identify decision points or repeated stages if relevant, and include concise student-friendly wording.',
    },
  ],
  'Differentiation Adapter': [
    {
      label: 'Differentiate lesson',
      description: 'Adapt a lesson for varied readiness levels.',
      prompt:
        'Differentiate this lesson for my students. I will provide the grade, objective, activity, student needs, time available, and any constraints. Create support, core, and extension versions while keeping the same learning target.',
    },
    {
      label: 'Support struggling students',
      description: 'Add scaffolds without lowering the goal.',
      prompt:
        'Adapt this assignment for students who need extra support. Keep the learning objective intact, add scaffolds, simplify directions, suggest vocabulary supports, and include checks for understanding. I will paste the original task and student needs.',
    },
    {
      label: 'Extend advanced learners',
      description: 'Add challenge options for students ready for more.',
      prompt:
        'Create extension options for students who already understand this lesson. I will provide the objective and current task. Add meaningful challenge choices, deeper thinking prompts, and a way for students to show mastery.',
    },
  ],
  'Downloadable Word Doc or PDF': [
    {
      label: 'Build a document',
      description: 'Create a clean Word/PDF-ready school document.',
      prompt:
        'Create a downloadable Word/PDF-ready document. I will provide the document purpose, audience, title, content, sections, tone, and any formatting needs. Return a polished structure with headings, clean copy, and any tables or checklists needed.',
    },
    {
      label: 'Format existing text',
      description: 'Turn rough content into a polished document.',
      prompt:
        'Format this rough text into a professional school document. Organize it with a clear title, headings, spacing guidance, and clean language. Preserve the important details and make it ready to export as a Word document or PDF.',
    },
    {
      label: 'Create template',
      description: 'Make a reusable document template.',
      prompt:
        'Create a reusable template for this document type. I will provide the audience and purpose. Include placeholders, recommended sections, concise instructions for the person filling it out, and a polished final layout.',
    },
  ],
  'EOY InTech Support Guide': [
    {
      label: 'Create support guide',
      description: 'Build end-of-year InTech instructions.',
      prompt:
        'Create an end-of-year InTech support guide. I will provide the audience, systems involved, deadlines, required steps, contacts, and known issues. Organize it into clear sections with step-by-step directions and troubleshooting notes.',
    },
    {
      label: 'Troubleshooting steps',
      description: 'Turn an InTech issue into a support checklist.',
      prompt:
        'Create a troubleshooting guide for this InTech issue. I will share the problem, error message, user role, device or browser if relevant, and what has already been tried. Give clear steps, escalation criteria, and a support-ready summary.',
    },
    {
      label: 'Staff checklist',
      description: 'Make an EOY checklist staff can follow.',
      prompt:
        'Create a concise end-of-year technology checklist for staff. Include what to complete, where to complete it, due dates, what evidence or confirmation is needed, and who to contact for help.',
    },
  ],
  'EOY Power School Guide': [
    {
      label: 'PowerSchool guide',
      description: 'Write end-of-year PowerSchool directions.',
      prompt:
        'Create an end-of-year PowerSchool guide. I will provide the audience, required tasks, fields or screens, deadlines, validation steps, and common mistakes. Make it step-by-step, accurate, and easy for school staff to follow.',
    },
    {
      label: 'Task checklist',
      description: 'Turn EOY tasks into a checklist.',
      prompt:
        'Create a PowerSchool end-of-year checklist. Group tasks by role or timeline, include expected completion evidence, and flag dependencies or items that should be verified before closing the year.',
    },
    {
      label: 'Explain an error',
      description: 'Make a PowerSchool issue easier to resolve.',
      prompt:
        'Help explain and troubleshoot this PowerSchool issue. I will share the error message, screen, task, user role, and what we tried. Give likely causes, safe next steps, and a concise message we can send to support if escalation is needed.',
    },
  ],
  'Educational Grants & Funding Finder': [
    {
      label: 'Find grant matches',
      description: 'Identify grants that fit your school need.',
      prompt:
        'Find and organize grant or funding opportunities for this need. I will provide the school type, location, grade levels, funding purpose, rough amount, timeline, and eligibility constraints. Return likely matches with eligibility notes, deadlines, award range, and application links if available.',
    },
    {
      label: 'Grant plan',
      description: 'Turn an idea into an application strategy.',
      prompt:
        'Help me plan a grant application. I will share the funding opportunity, project idea, students served, need statement, budget estimate, timeline, and outcomes. Create an application outline, required materials checklist, and next steps.',
    },
    {
      label: 'Funding pitch',
      description: 'Draft a concise proposal summary.',
      prompt:
        'Draft a short funding pitch for this education project. Include the need, target students, proposed solution, expected impact, rough budget, timeline, and why the project is worth funding. Keep it clear and persuasive.',
    },
  ],
  'Email Drafter': [
    {
      label: 'Draft an email',
      description: 'Turn notes into a ready-to-send email.',
      prompt:
        'Draft a professional email. I will provide the recipient, purpose, key points, tone, deadline, and desired next action. Include a clear subject line and keep the message concise, respectful, and ready to send.',
    },
    {
      label: 'Rewrite my email',
      description: 'Improve tone, clarity, and structure.',
      prompt:
        'Rewrite this email draft to make it clearer and more professional. Keep the intent, soften any wording that may read too harsh, make the ask obvious, and preserve important details such as dates, names, and next steps.',
    },
    {
      label: 'Family email',
      description: 'Create a warm message for parents or guardians.',
      prompt:
        'Write a family-facing email. I will provide the student or class context, message goal, key details, and requested family action. Keep the tone warm, clear, and supportive, with a subject line and a concise closing.',
    },
  ],
  'Ethos Educate Support': [
    {
      label: 'Report an issue',
      description: 'Create a clear support request with details.',
      prompt:
        'Help me write an Ethos Educate support request. I will provide what I was trying to do, the exact error message, page or feature, browser/device, steps to reproduce, and screenshots or files if relevant. Format it so support can troubleshoot quickly.',
    },
    {
      label: 'Understand an error',
      description: 'Translate an error into next steps.',
      prompt:
        'Help me understand this Ethos Educate error. I will paste the error message and describe what happened before it appeared. Explain likely causes in plain language and list safe troubleshooting steps before escalation.',
    },
    {
      label: 'Feature question',
      description: 'Ask how to use a specific Ethos feature.',
      prompt:
        'Help me ask or answer a question about an Ethos Educate feature. I will describe the feature, what I expected, and what I see. Provide a clear explanation, suggested steps, and any information support may need if it is not working.',
    },
  ],
  'Lesson Plan Builder': [
    {
      label: 'Build a lesson',
      description: 'Create a complete lesson from objective to assessment.',
      prompt:
        'Build a complete lesson plan. I will provide the grade, subject, standard or objective, topic, time, materials, student context, and any required instructional model. Include lesson objective, vocabulary, warm-up, direct instruction, guided practice, independent practice, checks for understanding, differentiation, and exit ticket.',
    },
    {
      label: 'Plan from standard',
      description: 'Turn a standard into teachable lesson steps.',
      prompt:
        'Create a lesson plan from this standard. Break down what students need to know and do, write a student-friendly objective, sequence the instruction, include practice tasks, and provide an assessment aligned to the standard.',
    },
    {
      label: 'Improve my lesson',
      description: 'Strengthen a draft lesson for clarity and engagement.',
      prompt:
        'Review and improve this lesson plan. Look for alignment, pacing, engagement, checks for understanding, differentiation, and assessment quality. Return a revised plan and a short list of what changed and why.',
    },
  ],
  'Letter & Memo Generator': [
    {
      label: 'Write a memo',
      description: 'Create a polished internal memo.',
      prompt:
        'Write a professional memo. I will provide the audience, purpose, background, key points, decision or request, deadline, and tone. Format it with a clear subject, concise summary, details, and next steps.',
    },
    {
      label: 'Formal letter',
      description: 'Draft a school letter for families or partners.',
      prompt:
        'Draft a formal letter. I will provide the recipient, context, key message, required details, tone, and signature line. Make it clear, respectful, and ready to use with appropriate school communication language.',
    },
    {
      label: 'Revise document',
      description: 'Make an existing letter or memo clearer.',
      prompt:
        'Revise this letter or memo for clarity, tone, and organization. Preserve the meaning, tighten the wording, make the request or decision easy to understand, and keep the final version professional.',
    },
  ],
  'Logo Editor Agent': [
    {
      label: 'Logo concept brief',
      description: 'Turn brand notes into a clear logo direction.',
      prompt:
        'Create a logo editing brief. I will provide the current logo, organization or event name, audience, desired style, colors, required text, and what should change. Give clear design directions and alternative concepts.',
    },
    {
      label: 'Refine logo',
      description: 'Suggest improvements to an existing logo.',
      prompt:
        'Review this logo and suggest improvements. Focus on readability, balance, color, spacing, scalability, and whether it fits the audience. Provide specific edit instructions that a designer or image tool can follow.',
    },
    {
      label: 'Brand variants',
      description: 'Create logo variations for different uses.',
      prompt:
        'Plan logo variants for this brand or event. Include a primary version, small-icon version, one-color version, and light/dark background guidance. I will provide the logo context, colors, and usage needs.',
    },
  ],
  'MVP Culture Champion Assistant': [
    {
      label: 'Recognition message',
      description: 'Write a culture-aligned shoutout.',
      prompt:
        'Write a recognition message for an MVP Culture Champion moment. I will provide the person or team, what they did, the value or behavior shown, audience, and tone. Make it specific, sincere, and ready to share.',
    },
    {
      label: 'Culture activity',
      description: 'Plan a simple staff culture-building activity.',
      prompt:
        'Create a staff culture activity. I will provide the goal, group size, time available, setting, and any theme. Include facilitation steps, materials, discussion prompts, and a short debrief tied to the culture value.',
    },
    {
      label: 'Campaign plan',
      description: 'Outline a culture push for a week or month.',
      prompt:
        'Plan a culture champion campaign. I will provide the focus value, timeline, audience, and desired behavior. Create a simple plan with messages, activities, recognition ideas, and ways to measure engagement.',
    },
  ],
  'Meeting Agenda Builder': [
    {
      label: 'Build agenda',
      description: 'Turn topics into a timed meeting plan.',
      prompt:
        'Build a meeting agenda. I will provide the meeting purpose, attendees, topics, time available, decisions needed, and any prework. Create a timed agenda with owners, desired outcomes, discussion questions, and a parking lot section.',
    },
    {
      label: 'Decision meeting',
      description: 'Structure a meeting around clear decisions.',
      prompt:
        'Create an agenda for a decision-making meeting. I will provide the decision, background, options, stakeholders, and time limit. Include pre-read needs, discussion flow, decision criteria, and final action capture.',
    },
    {
      label: 'Staff meeting',
      description: 'Organize announcements, discussion, and action items.',
      prompt:
        'Create a staff meeting agenda. I will provide updates, discussion topics, celebrations, required decisions, and time available. Make it organized, realistic, and easy for a facilitator to run.',
    },
  ],
  'Meeting Notes Summarizer': [
    {
      label: 'Summarize notes',
      description: 'Turn messy notes into decisions and actions.',
      prompt:
        'Summarize these meeting notes. Extract the purpose, key discussion points, decisions made, action items with owners and deadlines, unresolved questions, and follow-up message. Keep it concise and practical.',
    },
    {
      label: 'Action item list',
      description: 'Pull tasks, owners, and due dates from notes.',
      prompt:
        'Extract action items from these meeting notes or transcript. Create a table with task, owner, deadline, status if known, dependencies, and any missing information that needs confirmation.',
    },
    {
      label: 'Send recap',
      description: 'Create a professional post-meeting recap email.',
      prompt:
        'Write a meeting recap email from these notes. Include a short summary, decisions, action items, deadlines, and next meeting or follow-up needs. Keep the tone clear and professional.',
    },
  ],
  'Parent Conference Prep Sheet': [
    {
      label: 'Prep conference',
      description: 'Create a teacher prep sheet for a parent meeting.',
      prompt:
        'Create a parent conference prep sheet. I will provide the student name, grade, academic strengths and concerns, behavior or attendance notes, assessment data, parent concerns, and conference goal. Organize talking points, evidence, questions, and next steps in neutral language.',
    },
    {
      label: 'Talking points',
      description: 'Turn student notes into balanced talking points.',
      prompt:
        'Create balanced parent conference talking points from these notes. Include strengths, growth areas, specific evidence, suggested supports, and family partnership questions. Keep the tone respectful and student-centered.',
    },
    {
      label: 'Follow-up plan',
      description: 'Draft next steps after a parent conference.',
      prompt:
        'Create a follow-up plan after a parent conference. I will provide what was discussed, commitments made, concerns, and timeline. Summarize action items for teacher, student, and family, plus a brief follow-up email.',
    },
  ],
  'Podcast Creator': [
    {
      label: 'Podcast outline',
      description: 'Turn a topic into a structured episode plan.',
      prompt:
        'Create a podcast episode outline. I will provide the topic, audience, length, purpose, key points, tone, and any required segments. Include episode title, hook, segment flow, discussion questions, and closing.',
    },
    {
      label: 'Write script',
      description: 'Draft a host-ready podcast script.',
      prompt:
        'Write a podcast script for this topic. Include a strong intro, natural transitions, speaker notes, key explanations, examples, and outro. Keep the voice conversational and appropriate for the audience.',
    },
    {
      label: 'Student podcast',
      description: 'Create a classroom podcast assignment.',
      prompt:
        'Design a student podcast activity. I will provide the grade, topic, learning target, group size, and time available. Include directions, episode structure, roles, checklist, and rubric criteria.',
    },
  ],
  'Policy & Document Summarizer': [
    {
      label: 'Summarize policy',
      description: 'Turn a long document into plain language.',
      prompt:
        'Summarize this policy or document in plain language. Identify the purpose, who it affects, key requirements, deadlines, responsibilities, exceptions, and action items. Keep the summary accurate and easy to scan.',
    },
    {
      label: 'Staff guidance',
      description: 'Translate policy into practical staff steps.',
      prompt:
        'Convert this policy into practical staff guidance. Create a concise overview, what staff must do, what to avoid, timeline or reporting requirements, and a quick FAQ for common questions.',
    },
    {
      label: 'Compare versions',
      description: 'Highlight changes between document versions.',
      prompt:
        'Compare these two policy or document versions. Identify what changed, what stayed the same, possible operational impact, and questions to clarify. Present the comparison in a clear table.',
    },
  ],
  'Poster Creator': [
    {
      label: 'Event poster',
      description: 'Create copy and layout for a school poster.',
      prompt:
        'Create a print-ready poster concept for this event. I will provide the event name, date, time, location, audience, call to action, tone, and any brand requirements. Include headline, supporting copy, layout notes, and visual direction.',
    },
    {
      label: 'Awareness poster',
      description: 'Design a poster for a campaign or reminder.',
      prompt:
        'Create a school awareness poster. I will provide the topic, audience, key message, desired behavior, and tone. Give a strong headline, short body copy, visual concept, and call to action.',
    },
    {
      label: 'Revise poster copy',
      description: 'Make poster text shorter and stronger.',
      prompt:
        'Improve this poster copy. Make the headline clearer, shorten the wording, strengthen the call to action, and suggest layout hierarchy so it is readable from a distance.',
    },
  ],
  'PowerPoint Presentation Creator': [
    {
      label: 'Build slide deck',
      description: 'Create a complete presentation outline.',
      prompt:
        'Create a complete PowerPoint slide deck. I will provide the presentation title, purpose, audience, slide count, key topics, tone, and any branding or required sections. Include slide titles, bullets, speaker notes, and visual suggestions for each slide.',
    },
    {
      label: 'Staff presentation',
      description: 'Make a clear deck for a staff meeting or training.',
      prompt:
        'Create a staff-facing presentation. I will provide the topic, audience, meeting length, goals, and key messages. Structure it with an opening, agenda, content slides, discussion prompts, action steps, and closing.',
    },
    {
      label: 'Parent presentation',
      description: 'Build a family-friendly presentation.',
      prompt:
        'Create a parent-facing presentation. I will provide the topic, audience, goals, and key details. Keep the language clear and accessible, include visuals to support understanding, and add speaker notes for each slide.',
    },
  ],
  'Professional Development Plan Creator': [
    {
      label: 'PD session plan',
      description: 'Design a professional learning session.',
      prompt:
        'Create a professional development session plan. I will provide the topic, audience, time, goals, materials, facilitation style, and desired outcomes. Include agenda, activities, discussion prompts, checks for understanding, and follow-up tasks.',
    },
    {
      label: 'PD series',
      description: 'Map a multi-session learning arc.',
      prompt:
        'Create a professional development series plan. I will provide the focus area, timeline, staff audience, current need, and desired change in practice. Outline sessions, objectives, activities, evidence of implementation, and follow-up support.',
    },
    {
      label: 'Coaching plan',
      description: 'Create a focused teacher coaching cycle.',
      prompt:
        'Build a teacher coaching or support plan. I will provide the instructional goal, teacher context, evidence, timeline, and support resources. Include coaching moves, observation focus, feedback questions, and progress indicators.',
    },
  ],
  'Prompt Writer': [
    {
      label: 'Write better prompt',
      description: 'Turn a rough ask into a strong AI prompt.',
      prompt:
        'Rewrite my rough AI prompt to get a better result. Ask for missing context if needed, then create a clear prompt with role, task, context, constraints, output format, and quality criteria. Keep it practical and ready to paste.',
    },
    {
      label: 'Prompt template',
      description: 'Create a reusable prompt for repeated work.',
      prompt:
        'Create a reusable AI prompt template for this recurring task. Include placeholders for variable details, instructions for tone and format, and a checklist for what the user should provide before running it.',
    },
    {
      label: 'Debug a prompt',
      description: 'Fix a prompt that gives weak results.',
      prompt:
        'Analyze this prompt and explain why the output may be weak. Then rewrite it to be more specific, structured, and reliable. Include a better version and optional follow-up prompts.',
    },
  ],
  'Real World Examples Generator': [
    {
      label: 'Generate examples',
      description: 'Make abstract content easier to understand.',
      prompt:
        'Generate real-world examples for this concept. I will provide the grade, subject, concept, student context, and any local or school relevance. Create examples that are accurate, age-appropriate, and easy to connect to the lesson.',
    },
    {
      label: 'Student scenarios',
      description: 'Create relatable scenarios for practice.',
      prompt:
        'Create student-friendly scenarios that apply this concept. Include several contexts, short prompts or questions for students, and an answer guide or explanation for the teacher.',
    },
    {
      label: 'Misconception examples',
      description: 'Show correct and incorrect examples side by side.',
      prompt:
        'Create examples and non-examples for this concept. Explain why each example fits or does not fit, include common misconceptions, and add quick discussion questions to check understanding.',
    },
  ],
  'Report Card Comment Writer': [
    {
      label: 'Write comments',
      description: 'Create polished report card comments.',
      prompt:
        'Write report card comments. I will provide the student name, grade, strengths, growth areas, academic performance, behavior or work habits, and tone. Create professional, specific, family-friendly comments with next-step language.',
    },
    {
      label: 'Positive comment',
      description: 'Highlight strengths with clear evidence.',
      prompt:
        'Write a positive report card comment from these notes. Make it specific, sincere, and connected to learning behaviors or academic growth. Include one next step if appropriate.',
    },
    {
      label: 'Growth comment',
      description: 'Address concerns with supportive language.',
      prompt:
        'Write a report card comment for a student who needs growth in these areas. Keep the tone respectful and constructive, include evidence, name the next step, and avoid language that feels harsh or vague.',
    },
  ],
  'Rubric Creator': [
    {
      label: 'Build rubric',
      description: 'Create criteria and performance levels.',
      prompt:
        'Create a rubric for this assignment. I will provide the grade, task, learning targets, product type, point scale, and criteria. Build clear performance levels with student-friendly descriptors and scoring guidance.',
    },
    {
      label: 'Student-friendly rubric',
      description: 'Make rubric language students can understand.',
      prompt:
        'Create a student-friendly rubric for this task. Use clear criteria, simple performance-level language, and examples of what strong work looks like. Include a quick self-check section.',
    },
    {
      label: 'Revise rubric',
      description: 'Improve an existing rubric for clarity and alignment.',
      prompt:
        'Review and improve this rubric. Check for alignment to the task, clarity, measurable criteria, fair scoring levels, and student-friendly language. Return a revised version and brief notes on changes.',
    },
  ],
  'School Poster Designer': [
    {
      label: 'Design poster',
      description: 'Create poster copy and visual direction.',
      prompt:
        'Design a school poster concept. I will provide the message, audience, location where it will be posted, tone, colors, and required text. Include headline, short supporting copy, visual direction, and layout guidance.',
    },
    {
      label: 'Behavior reminder',
      description: 'Make a positive expectations poster.',
      prompt:
        'Create a positive behavior reminder poster. I will provide the expectation, student age, setting, and school tone. Use clear, encouraging language and include a simple visual concept.',
    },
    {
      label: 'Campaign poster',
      description: 'Build a poster for a school initiative.',
      prompt:
        'Create a poster for this school campaign or initiative. Include a strong headline, brief explanation, call to action, visual concept, and optional versions for hallway, classroom, and social sharing.',
    },
  ],
  'Social Media Post Generator': [
    {
      label: 'Create post',
      description: 'Write a school social post with visual direction.',
      prompt:
        'Create a school social media post. I will provide the platform, audience, topic, key details, tone, and desired action. Include caption, suggested visual, hashtags if appropriate, and a shorter alternate version.',
    },
    {
      label: 'Event promotion',
      description: 'Promote an event clearly and warmly.',
      prompt:
        'Create social media copy for this school event. Include what it is, who it is for, date/time/location, why it matters, and the action families or staff should take. Keep it platform-friendly.',
    },
    {
      label: 'Celebrate success',
      description: 'Write a recognition or celebration post.',
      prompt:
        'Create a celebratory school social post. I will provide who or what we are celebrating, key details, names to include or avoid, tone, and visual notes. Keep it positive, concise, and community-centered.',
    },
  ],
  'Spreadsheet (Excel) Creator': [
    {
      label: 'Build spreadsheet',
      description: 'Design columns, formulas, and structure.',
      prompt:
        'Create a spreadsheet plan for this task. I will provide the purpose, data fields, calculations needed, users, and output format. Return sheet tabs, columns, formulas, validation rules, and sample rows if helpful.',
    },
    {
      label: 'Formula help',
      description: 'Create or fix formulas for a workbook.',
      prompt:
        'Help me create Excel formulas. I will describe the columns, calculation goal, example data, and expected result. Provide the exact formulas, where to place them, and notes for copying them down.',
    },
    {
      label: 'Tracker template',
      description: 'Make a reusable tracker for school operations.',
      prompt:
        'Create a reusable spreadsheet tracker. I will provide what needs tracking, users, statuses, dates, metrics, and reporting needs. Include columns, dropdown options, formulas, summary views, and formatting suggestions.',
    },
  ],
  'Standards Translator': [
    {
      label: 'Translate standard',
      description: 'Turn a standard into plain teacher language.',
      prompt:
        'Translate this academic standard into plain language. Explain what students need to know and be able to do, key vocabulary, prerequisite skills, common misconceptions, and what mastery might look like.',
    },
    {
      label: 'Student objective',
      description: 'Create student-friendly learning targets.',
      prompt:
        'Create student-friendly learning targets from this standard. Include an "I can" statement, success criteria, quick examples, and a short check for understanding aligned to the standard.',
    },
    {
      label: 'Plan from standard',
      description: 'Break a standard into teachable lesson steps.',
      prompt:
        'Unpack this standard into a lesson planning guide. Identify the core skill, content knowledge, vocabulary, scaffolded steps, practice ideas, and assessment evidence that would show mastery.',
    },
  ],
  'Student Certificate Creator': [
    {
      label: 'Create certificate',
      description: 'Write certificate text for a student award.',
      prompt:
        'Create certificate wording for a student award. I will provide the student name, award title, reason, school or class, date, signer, and tone. Make it polished, celebratory, and ready to place on a certificate.',
    },
    {
      label: 'Award ideas',
      description: 'Generate meaningful award categories.',
      prompt:
        'Generate student award certificate ideas. I will provide the grade, class context, behaviors or achievements to recognize, and tone. Create award titles with short descriptions and sample certificate wording.',
    },
    {
      label: 'Class set',
      description: 'Create certificate wording for multiple students.',
      prompt:
        'Create a set of personalized certificate blurbs. I will provide student names and brief notes for each. Return polished award titles and short certificate text for each student, keeping the tone equitable and positive.',
    },
  ],
  'Survey Builder': [
    {
      label: 'Build survey',
      description: 'Create questions for feedback or planning.',
      prompt:
        'Create a survey. I will provide the audience, purpose, topic, number of questions, response types, and how results will be used. Include clear questions, answer options, and a short intro message.',
    },
    {
      label: 'Family survey',
      description: 'Make a family-friendly feedback form.',
      prompt:
        'Create a family-facing survey. I will provide the topic, grade or school context, and feedback needed. Keep the language clear, respectful, and easy to answer. Include multiple-choice and open-ended questions.',
    },
    {
      label: 'Improve survey',
      description: 'Fix bias, clarity, and answer choices.',
      prompt:
        'Review and improve this survey. Check for confusing wording, leading questions, missing answer choices, survey length, and whether the questions match the goal. Return a revised survey.',
    },
  ],
  'Translation Assistant': [
    {
      label: 'Translate message',
      description: 'Translate school communication with tone intact.',
      prompt:
        'Translate this school communication. I will paste the message and provide the target language, audience, and any tone requirements. Preserve formatting, names, dates, and important details. Include a brief note that AI translation should be reviewed for accuracy before sending.',
    },
    {
      label: 'Family-friendly version',
      description: 'Make a translated message clear for families.',
      prompt:
        'Translate and adapt this message for families. Keep the meaning accurate, use clear family-friendly language, preserve all important dates and actions, and avoid jargon. I will provide the message and target language.',
    },
    {
      label: 'Check translation tone',
      description: 'Review wording for clarity, respect, and accuracy.',
      prompt:
        'Review this translated school message for tone and clarity. Compare it to the original if provided, flag anything that may be confusing or too formal, and suggest a revised version that is respectful and easy for families to understand.',
    },
  ],
  'Video Transcript to Worksheet': [
    {
      label: 'Make worksheet',
      description: 'Turn a transcript into student questions.',
      prompt:
        'Create a worksheet from this video transcript. I will provide the transcript, grade, subject, learning goal, and desired length. Include vocabulary, comprehension questions, higher-order questions, and an answer key.',
    },
    {
      label: 'Guided notes',
      description: 'Create a fill-in or note-taking guide.',
      prompt:
        'Turn this transcript into guided notes. Include key terms, fill-in-the-blank items, pause-and-think questions, and a short summary task. Keep it aligned to the grade and learning target I provide.',
    },
    {
      label: 'Discussion questions',
      description: 'Generate prompts for after watching a video.',
      prompt:
        'Create discussion questions from this video transcript. Include literal, analytical, and connection questions, plus a short teacher guide with likely answers or talking points.',
    },
  ],
  'Vocabulary & Spelling Activity Creator': [
    {
      label: 'Build activity',
      description: 'Create vocabulary or spelling practice.',
      prompt:
        'Create a vocabulary or spelling activity. I will provide the word list, grade level, subject, skill focus, and time available. Include student directions, practice tasks, challenge options, and an answer key if needed.',
    },
    {
      label: 'Word work stations',
      description: 'Design small-group or center activities.',
      prompt:
        'Create word work station activities for this list. Include 3 to 5 stations with directions, materials, timing, and differentiation ideas for students who need support or extension.',
    },
    {
      label: 'Assessment practice',
      description: 'Make quick review questions for word mastery.',
      prompt:
        'Create vocabulary or spelling review practice. Include sentence use, definitions or meaning checks, word patterns, editing practice, and a quick formative assessment with answer key.',
    },
  ],
  'Vocabulary & Spelling List Builder': [
    {
      label: 'Build word list',
      description: 'Generate words aligned to topic or skill.',
      prompt:
        'Build a vocabulary or spelling list. I will provide the grade, subject, topic, phonics or spelling pattern, standards, and difficulty. Include words, student-friendly definitions if relevant, and suggested groupings.',
    },
    {
      label: 'Level the list',
      description: 'Create support, core, and challenge word sets.',
      prompt:
        'Create leveled vocabulary or spelling lists for this class. I will provide the topic or pattern and grade level. Make support, core, and challenge lists with notes about why words belong in each level.',
    },
    {
      label: 'Add definitions',
      description: 'Attach meanings and examples to words.',
      prompt:
        'Add student-friendly definitions and example sentences to this vocabulary list. Keep the language grade-appropriate and include any common confusions or related words that would help students.',
    },
  ],
  'Worksheet Generator': [
    {
      label: 'Create worksheet',
      description: 'Build a student-ready worksheet and key.',
      prompt:
        'Create a worksheet for this lesson. I will provide the grade, subject, topic, objective, question count, difficulty, and format. Include student directions, problems or tasks, space for answers if useful, and an answer key.',
    },
    {
      label: 'Practice set',
      description: 'Generate targeted practice with gradual difficulty.',
      prompt:
        'Create a practice set for this skill. Start with simpler items, build to more challenging ones, include a few mixed review questions, and provide an answer key with brief explanations where helpful.',
    },
    {
      label: 'Revise worksheet',
      description: 'Improve a draft worksheet for clarity and alignment.',
      prompt:
        'Review and improve this worksheet. Check directions, alignment to the objective, difficulty progression, readability, and answer key accuracy. Return a polished revised version.',
    },
  ],
  'YouTube Video Finder': [
    {
      label: 'Find lesson videos',
      description: 'Search for videos aligned to a topic.',
      prompt:
        'Find YouTube videos for this lesson topic. I will provide the grade, subject, topic, desired length, student needs, and any content to avoid. Return video options with title, channel, length, why it fits, and suggested use.',
    },
    {
      label: 'Compare videos',
      description: 'Evaluate video options for classroom use.',
      prompt:
        'Compare these YouTube videos for classroom use. Evaluate alignment, clarity, age appropriateness, pacing, possible concerns, and best use in a lesson. Recommend the strongest option.',
    },
    {
      label: 'Video lesson plan',
      description: 'Plan how to use a video in instruction.',
      prompt:
        'Create a lesson activity around a YouTube video. I will provide the video link or topic, grade, subject, and objective. Include before-viewing prompt, during-viewing questions, after-viewing task, and assessment idea.',
    },
  ],
};

function getEnvValue(key) {
  if (process.env[key]) {
    return process.env[key];
  }

  if (!fs.existsSync('.env')) {
    return undefined;
  }

  const env = fs.readFileSync('.env', 'utf8');
  const entry = env
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.startsWith(`${key}=`));

  if (!entry) {
    return undefined;
  }

  return entry.slice(key.length + 1).replace(/^['"]|['"]$/g, '');
}

async function main() {
  const mongoUri = getEnvValue('MONGO_URI');
  if (!mongoUri) {
    throw new Error('MONGO_URI is required');
  }

  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 15000 });

  const collection = mongoose.connection.db.collection('agents');
  const names = Object.keys(promptCardsByAgentName);
  const agents = await collection
    .find({ name: { $in: names } }, { projection: { _id: 1, name: 1 } })
    .toArray();
  const foundNames = new Set(agents.map((agent) => agent.name));
  const missing = names.filter((name) => !foundNames.has(name));
  const now = new Date();

  const operations = agents.map((agent) => ({
    updateOne: {
      filter: { _id: agent._id },
      update: {
        $set: {
          recommended_prompts: promptCardsByAgentName[agent.name],
          show_recommended_prompts: true,
          updatedAt: now,
        },
      },
    },
  }));

  const result = operations.length
    ? await collection.bulkWrite(operations, { ordered: false })
    : { modifiedCount: 0, matchedCount: 0 };

  console.log(
    JSON.stringify(
      {
        matched: result.matchedCount,
        modified: result.modifiedCount,
        missing,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => undefined);
  });
