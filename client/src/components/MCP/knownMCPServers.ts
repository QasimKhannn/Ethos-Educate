export interface KnownMCPServerPresentation {
  displayName: string;
  iconPath: string;
}

interface KnownMCPServerDefinition extends KnownMCPServerPresentation {
  aliases: readonly string[];
}

const KNOWN_MCP_SERVER_DEFINITIONS: readonly KnownMCPServerDefinition[] = [
  {
    aliases: ['canva'],
    displayName: 'Canva',
    iconPath: '/assets/mcp/canva.svg',
  },
  {
    aliases: ['figma'],
    displayName: 'Figma',
    iconPath: '/assets/mcp/figma.svg',
  },
  {
    aliases: ['github'],
    displayName: 'GitHub',
    iconPath: '/assets/mcp/github.svg',
  },
  {
    aliases: ['gmail'],
    displayName: 'Gmail',
    iconPath: '/assets/mcp/gmail.svg',
  },
  {
    aliases: [
      'downloadable-files-creation',
      'downloadable_files_creation',
      'downloadablefilescreation',
      'lesson-planning',
      'lesson_planning',
      'lessonplanning',
    ],
    displayName: 'Document Workflow',
    iconPath: '/assets/mcp/downloadfiles.svg',
  },
  {
    aliases: ['google-calendar', 'google_calendar', 'googlecalendar'],
    displayName: 'Google Calendar',
    iconPath: '/assets/mcp/google-calendar.svg',
  },
  {
    aliases: ['google-drive', 'google_drive', 'googledrive'],
    displayName: 'Google Drive',
    iconPath: '/assets/mcp/google-drive.svg',
  },
  {
    aliases: ['imagegen', 'image-gen', 'image_generation', 'imagegeneration'],
    displayName: 'Image Generation',
    iconPath: '/assets/mcp/imagegen.svg',
  },
  {
    aliases: ['linear'],
    displayName: 'Linear',
    iconPath: '/assets/mcp/linear.svg',
  },
  {
    aliases: ['monday', 'monday-com', 'mondaycom'],
    displayName: 'monday.com',
    iconPath: '/assets/mcp/monday.svg',
  },
  {
    aliases: ['notion'],
    displayName: 'Notion',
    iconPath: '/assets/mcp/notion.svg',
  },
  {
    aliases: ['onedrive', 'one-drive'],
    displayName: 'OneDrive',
    iconPath: '/assets/mcp/onedrive.svg',
  },
  {
    aliases: ['outlook'],
    displayName: 'Outlook',
    iconPath: '/assets/mcp/outlook.svg',
  },
  {
    aliases: ['outlook-calendar', 'outlook_calendar', 'outlookcalendar'],
    displayName: 'Outlook Calendar',
    iconPath: '/assets/mcp/outlook-calendar.svg',
  },
  {
    aliases: ['outlook-email', 'outlook_email', 'outlookemail'],
    displayName: 'Outlook Email',
    iconPath: '/assets/mcp/outlook-email.svg',
  },
  {
    aliases: ['sharepoint', 'share-point'],
    displayName: 'SharePoint',
    iconPath: '/assets/mcp/sharepoint.svg',
  },
  {
    aliases: ['slack'],
    displayName: 'Slack',
    iconPath: '/assets/mcp/slack.svg',
  },
  {
    aliases: ['teams'],
    displayName: 'Teams',
    iconPath: '/assets/mcp/teams.svg',
  },
  {
    aliases: ['websearch', 'web-search', 'web_search'],
    displayName: 'Web Search',
    iconPath: '/assets/mcp/websearch.svg',
  },
] as const;

const KNOWN_MCP_SERVER_LOOKUP = KNOWN_MCP_SERVER_DEFINITIONS.reduce<
  Record<string, KnownMCPServerPresentation>
>((lookup, definition) => {
  const presentation = {
    displayName: definition.displayName,
    iconPath: definition.iconPath,
  };

  definition.aliases.forEach((alias) => {
    lookup[alias] = presentation;
  });

  return lookup;
}, {});

export const normalizeMCPServerName = (serverName: string): string =>
  serverName.trim().toLowerCase();

const getMCPServerLookupCandidates = (serverName: string): string[] => {
  const normalizedServerName = normalizeMCPServerName(serverName);

  return [
    normalizedServerName,
    normalizedServerName.replace(/^mcp[-_\s]+/, ''),
    normalizedServerName.replace(/[-_\s]+mcp$/, ''),
    normalizedServerName.replace(/[-_\s]+mcp[-_\s]+server$/, ''),
    normalizedServerName.replace(/[-_\s]+server$/, ''),
  ].filter(Boolean);
};

export const getKnownMCPServerPresentation = (
  serverName: string,
): KnownMCPServerPresentation | undefined => {
  const candidates = getMCPServerLookupCandidates(serverName);

  for (const candidate of candidates) {
    const exactMatch = KNOWN_MCP_SERVER_LOOKUP[candidate];
    if (exactMatch) {
      return exactMatch;
    }
  }

  return KNOWN_MCP_SERVER_DEFINITIONS.find((definition) =>
    definition.aliases.some((alias) => candidates.some((candidate) => candidate.includes(alias))),
  );
};

export const getKnownMCPServerDisplayName = (serverName: string): string | undefined =>
  getKnownMCPServerPresentation(serverName)?.displayName;

export const getKnownMCPServerIconPath = (serverName: string): string | undefined =>
  getKnownMCPServerPresentation(serverName)?.iconPath;
