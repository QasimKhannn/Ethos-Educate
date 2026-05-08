const { nanoid } = require('nanoid');
const { EnvVar } = require('@librechat/agents');
const { logger } = require('@librechat/data-schemas');
const {
  checkAccess,
  loadWebSearchAuth,
  resolveCodeExecutionRuntime,
} = require('@librechat/api');
const {
  Tools,
  AuthType,
  Permissions,
  ToolCallTypes,
  PermissionTypes,
} = require('librechat-data-provider');
const { processFileURL, uploadImageBuffer } = require('~/server/services/Files/process');
const {
  processCodeOutput,
  processLocalCodeOutput,
} = require('~/server/services/Files/Code/process');
const { createToolCall, getToolCallsByConvo } = require('~/models/ToolCall');
const { loadAuthValues } = require('~/server/services/Tools/credentials');
const { loadTools } = require('~/app/clients/tools/util');
const { getRoleByName } = require('~/models/Role');
const { getMessage } = require('~/models/Message');
const { ERROR_CODES, sendErrorResponse } = require('~/server/utils/errorResponse');

const fieldsMap = {
  [Tools.execute_code]: [EnvVar.CODE_API_KEY],
};

const toolAccessPermType = {
  [Tools.execute_code]: PermissionTypes.RUN_CODE,
};

/**
 * Verifies web search authentication, ensuring each category has at least
 * one fully authenticated service.
 *
 * @param {ServerRequest} req - The request object
 * @param {ServerResponse} res - The response object
 * @returns {Promise<void>} A promise that resolves when the function has completed
 */
const verifyWebSearchAuth = async (req, res) => {
  try {
    const appConfig = req.config;
    const userId = req.user.id;
    /** @type {TCustomConfig['webSearch']} */
    const webSearchConfig = appConfig?.webSearch || {};
    const result = await loadWebSearchAuth({
      userId,
      loadAuthValues,
      webSearchConfig,
      throwError: false,
    });

    return res.status(200).json({
      authenticated: result.authenticated,
      authTypes: result.authTypes,
    });
  } catch (error) {
    logger.error('Error in verifyWebSearchAuth', error);
    return sendErrorResponse(res, error, {
      fallbackCode: ERROR_CODES.SERVICE_UNAVAILABLE,
      message: "We couldn't verify your web search connection.",
      action: 'Try again in a moment.',
    });
  }
};

/**
 * @param {ServerRequest} req - The request object, containing information about the HTTP request.
 * @param {ServerResponse} res - The response object, used to send back the desired HTTP response.
 * @returns {Promise<void>} A promise that resolves when the function has completed.
 */
const verifyToolAuth = async (req, res) => {
  try {
    const { toolId } = req.params;
    if (toolId === Tools.web_search) {
      return await verifyWebSearchAuth(req, res);
    }
    const authFields = fieldsMap[toolId];
    if (!authFields) {
      return sendErrorResponse(res, null, {
        code: ERROR_CODES.NOT_FOUND,
        message: "We couldn't find that tool.",
        action: 'Refresh the page and try again.',
      });
    }
    let result;
    try {
      result = await loadAuthValues({
        userId: req.user.id,
        authFields,
        throwError: false,
      });
    } catch (error) {
      logger.error('Error loading auth values', error);
      res.status(200).json({ authenticated: false, message: AuthType.USER_PROVIDED });
      return;
    }
    if (toolId === Tools.execute_code) {
      const codeApiKey = result[EnvVar.CODE_API_KEY];
      const runtime = resolveCodeExecutionRuntime({ codeApiKey });
      if (runtime === 'local') {
        res.status(200).json({ authenticated: true, message: AuthType.SYSTEM_DEFINED });
        return;
      }
    }
    let isUserProvided = false;
    for (const field of authFields) {
      if (!result[field]) {
        res.status(200).json({ authenticated: false, message: AuthType.USER_PROVIDED });
        return;
      }
      if (!isUserProvided && process.env[field] !== result[field]) {
        isUserProvided = true;
      }
    }
    res.status(200).json({
      authenticated: true,
      message: isUserProvided ? AuthType.USER_PROVIDED : AuthType.SYSTEM_DEFINED,
    });
  } catch (error) {
    return sendErrorResponse(res, error, {
      fallbackCode: ERROR_CODES.REQUEST_FAILED,
      message: "We couldn't verify that tool right now.",
      action: 'Try again in a moment.',
    });
  }
};

/**
 * @param {ServerRequest} req - The request object, containing information about the HTTP request.
 * @param {ServerResponse} res - The response object, used to send back the desired HTTP response.
 * @param {NextFunction} next - The next middleware function to call.
 * @returns {Promise<void>} A promise that resolves when the function has completed.
 */
const callTool = async (req, res) => {
  try {
    const appConfig = req.config;
    const { toolId = '' } = req.params;
    if (!fieldsMap[toolId]) {
      logger.warn(`[${toolId}/call] User ${req.user.id} attempted call to invalid tool`);
      return sendErrorResponse(res, null, {
        code: ERROR_CODES.NOT_FOUND,
        message: "We couldn't find that tool.",
        action: 'Refresh the page and try again.',
      });
    }

    const { partIndex, blockIndex, messageId, conversationId, ...args } = req.body;
    if (!messageId) {
      logger.warn(`[${toolId}/call] User ${req.user.id} attempted call without message ID`);
      return sendErrorResponse(res, null, {
        code: ERROR_CODES.INVALID_INPUT,
        message: 'This tool request is missing the message it belongs to.',
        action: 'Refresh the page and try again.',
      });
    }

    const message = await getMessage({ user: req.user.id, messageId });
    if (!message) {
      logger.debug(`[${toolId}/call] User ${req.user.id} attempted call with invalid message ID`);
      return sendErrorResponse(res, null, {
        code: ERROR_CODES.NOT_FOUND,
        message: "We couldn't find the message for this tool request.",
        action: 'Refresh the page and try again.',
      });
    }
    logger.debug(`[${toolId}/call] User: ${req.user.id}`);
    let hasAccess = true;
    if (toolAccessPermType[toolId]) {
      hasAccess = await checkAccess({
        user: req.user,
        permissionType: toolAccessPermType[toolId],
        permissions: [Permissions.USE],
        getRoleByName,
      });
    }
    if (!hasAccess) {
      logger.warn(
        `[${toolAccessPermType[toolId]}] Forbidden: Insufficient permissions for User ${req.user.id}: ${Permissions.USE}`,
      );
      return sendErrorResponse(res, null, {
        code: ERROR_CODES.PERMISSION_DENIED,
        message: "You don't have access to use this tool.",
        action: 'Ask an administrator for access or use a different tool.',
      });
    }
    const { loadedTools } = await loadTools({
      user: req.user.id,
      tools: [toolId],
      functions: true,
      options: {
        req,
        returnMetadata: true,
        processFileURL,
        uploadImageBuffer,
      },
      webSearch: appConfig.webSearch,
      fileStrategy: appConfig.fileStrategy,
      imageOutputType: appConfig.imageOutputType,
    });

    const tool = loadedTools[0];
    const toolCallId = `${req.user.id}_${nanoid()}`;
    const result = await tool.invoke({
      args,
      name: toolId,
      id: toolCallId,
      type: ToolCallTypes.TOOL_CALL,
    });

    const { content, artifact } = result;
    const toolCallData = {
      toolId,
      messageId,
      partIndex,
      blockIndex,
      conversationId,
      result: content,
      user: req.user.id,
    };

    if (!artifact || !artifact.files || toolId !== Tools.execute_code) {
      createToolCall(toolCallData).catch((error) => {
        logger.error(`Error creating tool call: ${error.message}`);
      });
      return res.status(200).json({
        result: content,
      });
    }

    const artifactPromises = [];
    for (const file of artifact.files) {
      const { id, name, local_path } = file;
      artifactPromises.push(
        (async () => {
          const fileMetadata = local_path
            ? await processLocalCodeOutput({
                req,
                name,
                local_path,
                messageId,
                toolCallId,
                conversationId,
              })
            : await processCodeOutput({
                req,
                id,
                name,
                apiKey: tool.apiKey,
                messageId,
                toolCallId,
                conversationId,
                session_id: artifact.session_id,
              });

          if (!fileMetadata) {
            return null;
          }

          return fileMetadata;
        })().catch((error) => {
          logger.error('Error processing code output:', error);
          return null;
        }),
      );
    }
    const attachments = await Promise.all(artifactPromises);
    toolCallData.attachments = attachments;
    createToolCall(toolCallData).catch((error) => {
      logger.error(`Error creating tool call: ${error.message}`);
    });
    res.status(200).json({
      result: content,
      attachments,
    });
  } catch (error) {
    logger.error('Error calling tool', error);
    return sendErrorResponse(res, error, {
      fallbackCode: ERROR_CODES.REQUEST_FAILED,
      message: "We couldn't run that tool.",
      action: 'Try again in a moment.',
    });
  }
};

const getToolCalls = async (req, res) => {
  try {
    const { conversationId } = req.query;
    const toolCalls = await getToolCallsByConvo(conversationId, req.user.id);
    res.status(200).json(toolCalls);
  } catch (error) {
    logger.error('Error getting tool calls', error);
    return sendErrorResponse(res, error, {
      fallbackCode: ERROR_CODES.REQUEST_FAILED,
      message: "We couldn't load the tool results for this chat.",
      action: 'Refresh the page and try again.',
    });
  }
};

module.exports = {
  callTool,
  getToolCalls,
  verifyToolAuth,
};
