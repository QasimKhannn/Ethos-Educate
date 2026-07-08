// cowork — connector catalog. The definition list of external connectors (MCP-backed) the
// Cowork agent can be granted, per project. This is metadata only; per-connector MCP servers
// and tool wiring are added in later phases. Cowork-only — nothing here affects normal chat.

export type CoworkConnectorAuth = 'oauth' | 'apikey' | 'platform';

export interface CoworkConnectorCredentialField {
  /** Stored key, e.g. "siteUrl", "apiKey". */
  key: string;
  /** Human label shown in the Connectors tab. */
  label: string;
  placeholder?: string;
  /** Render as a masked/secret input and never echo back to the client. */
  secret?: boolean;
}

/** Plain-language setup help shown behind the info icon, for non-technical users. */
export interface CoworkConnectorHelp {
  /** One-line summary of what's needed. */
  summary: string;
  /** Numbered, jargon-light steps to obtain the credential. */
  steps: string[];
  /** Optional official guide link. */
  url?: string;
}

export interface CoworkConnectorDef {
  /** Stable id stored in CoworkProject.enabledConnectors (e.g. "wordpress"). */
  id: string;
  label: string;
  description: string;
  /** How-to-connect help (shown for connectors that need a credential). */
  help?: CoworkConnectorHelp;
  /**
   * How a teacher connects it:
   * - `oauth`     — log in once (Google, Microsoft, Canva, Monday)
   * - `apikey`    — paste credential(s) in the Connectors tab (WordPress, Mailchimp, Airtable)
   * - `platform`  — no per-teacher auth; a single platform key (YouTube, read-only)
   */
  auth: CoworkConnectorAuth;
  /** Name of the librechat.yaml MCP server this maps to. Filled in as servers are wired. */
  mcpServer?: string;
  /** Tool names this connector's MCP server exposes (filled in when the server is wired). */
  mcpTools?: string[];
  /** For `apikey` connectors: the fields the teacher enters. */
  credentialFields?: CoworkConnectorCredentialField[];
  /** True if it can publish/send/modify (=> draft→approve gating later). */
  hasWriteActions: boolean;
  /**
   * `available` once its MCP server is wired (usable); `planned` otherwise. All start `planned`
   * in Phase 1 and flip to `available` as each connector is wired in later phases.
   */
  status: 'available' | 'planned';
}

export const COWORK_CONNECTORS: CoworkConnectorDef[] = [
  {
    id: 'youtube',
    label: 'YouTube',
    description: 'Search YouTube for teaching videos and resources.',
    auth: 'platform',
    // Platform connector: one shared YouTube Data API key (env YOUTUBE_API_KEY), read-only search.
    // No per-teacher credential; always on in Agent mode once the env key is set.
    mcpServer: 'youtube',
    hasWriteActions: false,
    status: 'available',
  },
  {
    id: 'wordpress',
    label: 'WordPress',
    description: 'Draft and publish posts and pages to your WordPress site.',
    auth: 'apikey',
    help: {
      summary:
        'You need your site address, your WordPress username, and an "Application Password" (a special password just for apps — not your normal login password).',
      steps: [
        'Sign in to your WordPress admin (usually yoursite.com/wp-admin).',
        'Click Users, then Profile (or your own user).',
        'Scroll down to the "Application Passwords" section.',
        'Type a name like "Ethos Cowork" and click "Add New Application Password".',
        'Copy the password it shows you (keep the spaces) — it is only shown once.',
        'Paste your site URL, username, and that password into the fields here.',
      ],
    },
    // Field keys MUST match the librechat.yaml `wordpress` server's customUserVars (the env-var names
    // the mcp-wordpress server reads), so saving them feeds the per-teacher connection directly.
    credentialFields: [
      { key: 'WORDPRESS_SITE_URL', label: 'Site URL', placeholder: 'https://yourschool.org' },
      { key: 'WORDPRESS_USERNAME', label: 'Username' },
      { key: 'WORDPRESS_APP_PASSWORD', label: 'Application Password', secret: true },
    ],
    mcpServer: 'wordpress',
    hasWriteActions: true,
    status: 'available',
  },
  {
    id: 'mailchimp',
    label: 'Mailchimp',
    description: 'Read Mailchimp campaigns, audiences, and reports.',
    auth: 'apikey',
    help: {
      summary: 'You need an "API key" from your Mailchimp account.',
      steps: [
        'Sign in to Mailchimp.',
        'Click your profile icon (bottom-left), then "Account & billing".',
        'Open the "Extras" menu and choose "API keys".',
        'Click "Create A Key" and copy the key it generates (it ends with something like "-us21").',
        'Paste the key into the field here.',
      ],
      url: 'https://mailchimp.com/help/about-api-keys/',
    },
    // Field key matches the librechat.yaml `mailchimp` server's customUserVars. The key already
    // contains the data-center suffix the server needs.
    credentialFields: [{ key: 'MAILCHIMP_API_KEY', label: 'API key', secret: true }],
    mcpServer: 'mailchimp',
    // The chosen MCP server is read-only (no campaign sends), so no write gate is needed yet.
    hasWriteActions: false,
    status: 'available',
  },
  {
    id: 'airtable',
    label: 'Airtable',
    description: 'Read and update Airtable bases and records.',
    auth: 'apikey',
    help: {
      summary: 'You need a "personal access token" from Airtable.',
      steps: [
        'Go to airtable.com and sign in.',
        'Open airtable.com/create/tokens (Builder Hub, then "Personal access tokens").',
        'Click "Create token" and give it a name.',
        'Add the access (scopes) and the base(s) you want it to reach.',
        'Click "Create token" and copy it.',
        'Paste the token into the field here.',
      ],
      url: 'https://airtable.com/developers/web/guides/personal-access-tokens',
    },
    // Field key matches the librechat.yaml `airtable` server's customUserVars (AIRTABLE_API_KEY).
    credentialFields: [{ key: 'AIRTABLE_API_KEY', label: 'Personal access token', secret: true }],
    mcpServer: 'airtable',
    hasWriteActions: true,
    status: 'available',
  },
  {
    id: 'monday',
    label: 'Monday.com',
    description: 'Manage boards, items, and updates.',
    auth: 'oauth',
    mcpServer: 'monday',
    hasWriteActions: true,
    // Wired in Phase 5: librechat.yaml `monday` server (hosted OAuth). No mcpTools listed →
    // the run-time injection grants every tool the server exposes (see initialize.js).
    status: 'available',
  },
  // cowork A3 — GitHub connector (read scope). Points at GitHub's official remote MCP server
  // (does its own OAuth, like Monday), read-only endpoint. Write scope (issues/PRs, workspace
  // push) arrives in Phase C behind the enforced write gate. No mcpTools listed → run-time
  // injection grants the whole (read-only) server toolset.
  {
    id: 'github',
    label: 'GitHub',
    description: 'Search and read your GitHub repositories, issues, and pull requests.',
    auth: 'oauth',
    mcpServer: 'github',
    hasWriteActions: false,
    help: {
      summary:
        'Click Connect and sign in to GitHub once, then choose which repositories or organizations to expose. Nothing is stored except the secure connection.',
      steps: [
        'Click "Connect".',
        'Sign in to GitHub in the popup and review the requested access.',
        'Choose the repositories or organizations the coworker may read.',
        'Approve — you are connected. Disconnect any time from this tab.',
      ],
      url: 'https://docs.github.com/en/copilot/customizing-copilot/using-model-context-protocol/using-the-github-mcp-server',
    },
    status: 'available',
  },
  // Google Workspace — hidden for now. Uncomment to show it in the Connectors tab once a Workspace
  // MCP server is deployed and reachable (set `mcpServer` + `status: 'available'` then). Until then
  // it stays out of the list so there's no dead "Connect" button.
  // {
  //   id: 'google_workspace',
  //   label: 'Google Workspace',
  //   description: 'Work with Google Docs, Drive, Classroom, and Calendar.',
  //   auth: 'oauth',
  //   hasWriteActions: true,
  //   status: 'planned',
  // },
  // Microsoft 365 — wired in Phase 5 as four separate Cloud Run MCP servers (each with its own
  // Azure AD OAuth callback). Represented as one tile per surface so each connects independently;
  // they share the same Azure AD app, so after the first login the rest are quick.
  {
    id: 'outlook',
    label: 'Outlook',
    description: 'Read your Outlook email.',
    auth: 'oauth',
    mcpServer: 'outlook',
    hasWriteActions: false,
    status: 'available',
  },
  {
    id: 'teams',
    label: 'Microsoft Teams',
    description: 'Read your Teams messages.',
    auth: 'oauth',
    mcpServer: 'teams',
    hasWriteActions: false,
    status: 'available',
  },
  {
    id: 'onedrive',
    label: 'OneDrive',
    description: 'Access your OneDrive files.',
    auth: 'oauth',
    mcpServer: 'onedrive',
    hasWriteActions: false,
    status: 'available',
  },
  {
    id: 'sharepoint',
    label: 'SharePoint',
    description: 'Access SharePoint files.',
    auth: 'oauth',
    mcpServer: 'sharepoint',
    hasWriteActions: false,
    status: 'available',
  },
  {
    id: 'canva',
    label: 'Canva',
    description: 'Create and edit Canva designs.',
    auth: 'oauth',
    mcpServer: 'canva',
    hasWriteActions: true,
    // Wired in Phase 5: librechat.yaml `canva` server (per-user OAuth). No mcpTools listed →
    // the run-time injection grants every tool the server exposes (see initialize.js).
    status: 'available',
  },
];

/** All connector definitions. */
export function listCoworkConnectors(): CoworkConnectorDef[] {
  return COWORK_CONNECTORS;
}

/** Look up one connector definition by id. */
export function getCoworkConnector(id: string): CoworkConnectorDef | undefined {
  return COWORK_CONNECTORS.find((c) => c.id === id);
}

/** Whether an id refers to a known connector. */
export function isValidConnectorId(id: string): boolean {
  return COWORK_CONNECTORS.some((c) => c.id === id);
}

/** Keep only ids that refer to known connectors (used when saving enabledConnectors). */
export function sanitizeConnectorIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) {
    return [];
  }
  return [...new Set(ids.filter((id): id is string => typeof id === 'string' && isValidConnectorId(id)))];
}
