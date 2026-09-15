const mockLogger = {
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
};

const mockGenerationJobManager = {
  completeJob: jest.fn().mockResolvedValue(undefined),
  createJob: jest.fn(),
  decrementPendingRequest: jest.fn().mockResolvedValue(undefined),
  emitDone: jest.fn().mockResolvedValue(undefined),
  emitError: jest.fn().mockResolvedValue(undefined),
  getJob: jest.fn(),
  getResumeState: jest.fn(),
  setContentParts: jest.fn(),
  setCollectedUsage: jest.fn(),
  updateMetadata: jest.fn(),
};

const mockSaveConvo = jest.fn();
const mockSaveMessage = jest.fn();

jest.mock('@librechat/data-schemas', () => ({ logger: mockLogger }));

jest.mock('@librechat/api', () => ({
  Constants: { NO_PARENT: '00000000-0000-0000-0000-000000000000' },
  GenerationJobManager: mockGenerationJobManager,
  buildMessageFiles: jest.fn().mockReturnValue([]),
  checkAndIncrementPendingRequest: jest.fn().mockResolvedValue({ allowed: true }),
  decrementPendingRequest: (...args) => mockGenerationJobManager.decrementPendingRequest(...args),
  getViolationInfo: jest.fn(),
  sanitizeMessageForTransmit: jest.fn((message) => message),
}));

jest.mock('~/cache', () => ({ logViolation: jest.fn() }));

jest.mock('~/models', () => ({
  saveConvo: (...args) => mockSaveConvo(...args),
  saveMessage: (...args) => mockSaveMessage(...args),
}));

jest.mock('~/server/cleanup', () => ({
  clientRegistry: new Map(),
  disposeClient: jest.fn(),
  requestDataMap: new Map(),
}));

jest.mock('~/server/middleware', () => ({ handleAbortError: jest.fn() }));

const AgentController = require('../request');

const endpointOption = {
  endpoint: 'agents',
  endpointType: 'agents',
  model_parameters: { model: 'test-model' },
  modelLabel: 'Ethos-Pro',
  projectId: 'project-123',
  spec: 'Ethos-Pro',
};

const createRequest = () => ({
  body: {
    endpointOption,
    messageId: '48b398ff-3b74-4d81-88f5-0798801a3ea4',
    parentMessageId: '00000000-0000-0000-0000-000000000000',
    text: 'Hello',
  },
  user: { id: 'user-123' },
});

const createResponse = (order) => ({
  headersSent: false,
  json: jest.fn(() => {
    order.push('response');
  }),
  status: jest.fn().mockReturnThis(),
});

const createJob = () => ({
  abortController: new AbortController(),
  createdAt: Date.now(),
  emitter: { on: jest.fn() },
  readyPromise: Promise.resolve(),
});

describe('ResumableAgentController initial persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGenerationJobManager.createJob.mockResolvedValue(createJob());
    mockGenerationJobManager.getJob.mockResolvedValue({ createdAt: expect.any(Number) });
    mockGenerationJobManager.getResumeState.mockResolvedValue({
      conversationId: 'conversation-123',
      responseMessageId: 'response-123',
      userMessage: {
        messageId: '48b398ff-3b74-4d81-88f5-0798801a3ea4',
      },
    });
  });

  it('persists the first message and conversation before returning the conversation ID', async () => {
    const order = [];
    const req = createRequest();
    const res = createResponse(order);

    mockSaveMessage.mockImplementation(async () => {
      order.push('message');
    });
    mockSaveConvo.mockImplementation(async () => {
      order.push('conversation');
      return { conversationId: 'conversation-123' };
    });

    const initializeClient = jest.fn().mockResolvedValue({
      client: {
        sendMessage: jest.fn(() => new Promise(() => undefined)),
      },
    });

    await AgentController(req, res, jest.fn(), initializeClient, jest.fn());

    expect(order).toEqual(['message', 'conversation', 'response']);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: expect.any(String), status: 'started' }),
    );
    expect(mockSaveConvo).toHaveBeenCalledWith(
      req,
      expect.objectContaining({
        model: 'test-model',
        modelLabel: 'Ethos-Pro',
        projectId: 'project-123',
        spec: 'Ethos-Pro',
      }),
      expect.any(Object),
    );
  });

  it('does not expose a conversation ID or start the agent when persistence fails', async () => {
    const req = createRequest();
    const res = createResponse([]);
    const initializeClient = jest.fn();

    mockSaveMessage.mockRejectedValue(new Error('database unavailable'));

    await AgentController(req, res, jest.fn(), initializeClient, jest.fn());

    expect(res.json).not.toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: expect.any(String), status: 'started' }),
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(mockGenerationJobManager.completeJob).toHaveBeenCalledWith(
      expect.any(String),
      'database unavailable',
    );
    expect(initializeClient).not.toHaveBeenCalled();
  });

  it('persists an assistant error when background generation fails', async () => {
    const req = createRequest();
    const res = createResponse([]);

    mockSaveMessage.mockResolvedValue(undefined);
    mockSaveConvo.mockResolvedValue({ conversationId: 'conversation-123' });

    const initializeClient = jest.fn().mockResolvedValue({
      client: {
        sendMessage: jest.fn().mockRejectedValue(new Error('invalid deployment')),
        sender: 'Ethos-Pro',
      },
    });

    await AgentController(req, res, jest.fn(), initializeClient, jest.fn());
    await new Promise((resolve) => setImmediate(resolve));

    expect(mockSaveMessage).toHaveBeenCalledWith(
      req,
      expect.objectContaining({
        conversationId: 'conversation-123',
        error: true,
        isCreatedByUser: false,
        messageId: 'response-123',
        parentMessageId: '48b398ff-3b74-4d81-88f5-0798801a3ea4',
        sender: 'Ethos-Pro',
      }),
      expect.any(Object),
    );
    expect(mockGenerationJobManager.emitError).toHaveBeenCalledWith(
      expect.any(String),
      'invalid deployment',
    );
  });
});
