import type { IntakeTemplate } from './agentIntake';

export type AgentIntakeLaunchStatus = 'queued' | 'submitted';

export type AgentIntakeLaunch = {
  id: string;
  agentId: string;
  template: IntakeTemplate;
  prompt: string;
  status: AgentIntakeLaunchStatus;
  createdAt: number;
};

const storagePrefix = 'ethos-agent-intake-launch:';
export const agentIntakeLaunchMaxAgeMs = 30 * 60 * 1000;

const getStorage = (): Storage | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

const getStorageKey = (launchId: string) => `${storagePrefix}${launchId}`;

const isValidLaunch = (launch: AgentIntakeLaunch) =>
  typeof launch.id === 'string' &&
  typeof launch.agentId === 'string' &&
  (launch.template === 'worksheet' ||
    launch.template === 'assessment' ||
    launch.template === 'presentation') &&
  typeof launch.prompt === 'string' &&
  (launch.status === 'queued' || launch.status === 'submitted') &&
  Number.isFinite(launch.createdAt);

const readLaunch = (launchId: string): AgentIntakeLaunch | null => {
  const storage = getStorage();
  if (!storage || !launchId) {
    return null;
  }

  try {
    const rawLaunch = storage.getItem(getStorageKey(launchId));
    if (!rawLaunch) {
      return null;
    }

    const launch = JSON.parse(rawLaunch) as AgentIntakeLaunch;
    if (!isValidLaunch(launch) || launch.id !== launchId) {
      storage.removeItem(getStorageKey(launchId));
      return null;
    }

    return launch;
  } catch {
    return null;
  }
};

const createLaunchId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export const createAgentIntakeLaunch = ({
  agentId,
  template,
  prompt,
}: Omit<AgentIntakeLaunch, 'id' | 'status' | 'createdAt'>): AgentIntakeLaunch | null => {
  const storage = getStorage();
  if (!storage || !agentId.trim() || !prompt.trim()) {
    return null;
  }

  const launch: AgentIntakeLaunch = {
    id: createLaunchId(),
    agentId,
    template,
    prompt,
    status: 'queued',
    createdAt: Date.now(),
  };

  try {
    storage.setItem(getStorageKey(launch.id), JSON.stringify(launch));
    return launch;
  } catch {
    return null;
  }
};

export const getAgentIntakeLaunch = (launchId: string | null): AgentIntakeLaunch | null => {
  if (!launchId) {
    return null;
  }

  const launch = readLaunch(launchId);
  if (!launch || Date.now() - launch.createdAt <= agentIntakeLaunchMaxAgeMs) {
    return launch;
  }

  getStorage()?.removeItem(getStorageKey(launchId));
  return null;
};

export const markAgentIntakeLaunchSubmitted = (launchId: string | null) => {
  const launch = getAgentIntakeLaunch(launchId);
  const storage = getStorage();
  if (!launch || !storage) {
    return false;
  }

  try {
    storage.setItem(
      getStorageKey(launch.id),
      JSON.stringify({
        ...launch,
        status: 'submitted' as const,
      }),
    );
    return true;
  } catch {
    return false;
  }
};
