const { logger } = require('@librechat/data-schemas');
const {
  FileContext,
  PermissionBits,
  hasPermissions,
  ResourceType,
} = require('librechat-data-provider');
const { getEffectivePermissions } = require('~/server/services/PermissionService');
const { getAgents } = require('~/models/Agent');
const { getFiles } = require('~/models');
const {
  isExpiredGeneratedFile,
  removeExpiredGeneratedFile,
} = require('~/server/services/Files/GeneratedImageRetention');

const rejectExpiredGeneratedFile = (req, res, file) => {
  removeExpiredGeneratedFile(file, req.config).catch((error) => {
    logger.error(`[fileAccess] Failed to remove expired generated file ${file.file_id}:`, error);
  });
  return res.status(410).json({
    error: 'Gone',
    message:
      file.context === FileContext.generated_document
        ? 'Document expired - generate a new copy.'
        : 'This generated image expired after 7 days and is no longer available.',
  });
};

/**
 * Checks if user has access to a file through agent permissions
 * Files inherit permissions from agents - if you can view the agent, you can access its files
 */
const checkAgentBasedFileAccess = async ({ userId, role, fileId }) => {
  try {
    /** Agents that have this file in their tool_resources */
    const agentsWithFile = await getAgents({
      $or: [
        { 'tool_resources.execute_code.file_ids': fileId },
        { 'tool_resources.file_search.file_ids': fileId },
        { 'tool_resources.context.file_ids': fileId },
        { 'tool_resources.ocr.file_ids': fileId },
      ],
    });

    if (!agentsWithFile || agentsWithFile.length === 0) {
      return false;
    }

    // Check if user has access to any of these agents
    for (const agent of agentsWithFile) {
      // Check if user is the agent author
      if (agent.author && agent.author.toString() === userId) {
        logger.debug(`[fileAccess] User is author of agent ${agent.id}`);
        return true;
      }

      // Check ACL permissions for VIEW access on the agent
      try {
        const permissions = await getEffectivePermissions({
          userId,
          role,
          resourceType: ResourceType.AGENT,
          resourceId: agent._id || agent.id,
        });

        if (hasPermissions(permissions, PermissionBits.VIEW)) {
          logger.debug(`[fileAccess] User ${userId} has VIEW permissions on agent ${agent.id}`);
          return true;
        }
      } catch (permissionError) {
        logger.warn(
          `[fileAccess] Permission check failed for agent ${agent.id}:`,
          permissionError.message,
        );
        // Continue checking other agents
      }
    }

    return false;
  } catch (error) {
    logger.error('[fileAccess] Error checking agent-based access:', error);
    return false;
  }
};

/**
 * Middleware to check if user can access a file
 * Checks: 1) File ownership, 2) Agent-based access (file inherits agent permissions)
 */
const fileAccess = async (req, res, next) => {
  try {
    const fileId = req.params.file_id;
    const userId = req.user?.id;
    const userRole = req.user?.role;
    if (!fileId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'file_id is required',
      });
    }

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const [file] = await getFiles({ file_id: fileId });
    if (!file) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'File not found',
      });
    }

    if (file.user && file.user.toString() === userId) {
      if (isExpiredGeneratedFile(file)) {
        return rejectExpiredGeneratedFile(req, res, file);
      }
      req.fileAccess = { file };
      return next();
    }

    /** Agent-based access (file inherits agent permissions) */
    const hasAgentAccess = await checkAgentBasedFileAccess({ userId, role: userRole, fileId });
    if (hasAgentAccess) {
      if (isExpiredGeneratedFile(file)) {
        return rejectExpiredGeneratedFile(req, res, file);
      }
      req.fileAccess = { file };
      return next();
    }

    logger.warn(`[fileAccess] User ${userId} denied access to file ${fileId}`);
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Insufficient permissions to access this file',
    });
  } catch (error) {
    logger.error('[fileAccess] Error checking file access:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to check file access permissions',
    });
  }
};

module.exports = {
  fileAccess,
};
