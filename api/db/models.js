const mongoose = require('mongoose');
const { createModels } = require('@librechat/data-schemas');
const models = createModels(mongoose);
const Invite = require('./inviteSchema');
const UserMembership = require('./userMembershipSchema');
const AdminConfig = require('./adminConfigSchema');
const AdminAuditLog = require('./adminAuditLogSchema');

module.exports = { ...models, Invite, UserMembership, AdminConfig, AdminAuditLog };
