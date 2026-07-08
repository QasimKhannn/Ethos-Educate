// cowork — Phase B2 multi-tenant isolation regression tests.
//
// The isolation invariant: every project/resource-scoped Cowork model function must build an
// OWNER-scoped query ({ ..., user }). These tests assert that invariant at the source, so a future
// edit that drops the `user` scope (a cross-tenant IDOR) fails CI. Pure unit tests — the DB layer
// is mocked; real mongoose is used only for ObjectId validation.

const leanValue = (val) => ({ lean: jest.fn().mockResolvedValue(val) });

jest.mock('~/db/models', () => ({
  CoworkProject: {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    findOneAndDelete: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    countDocuments: jest.fn(),
  },
  Conversation: {},
  Message: { find: jest.fn(), countDocuments: jest.fn() },
  CoworkSkill: {
    findOne: jest.fn(),
    findOneAndDelete: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    countDocuments: jest.fn(),
  },
}));

const db = require('~/db/models');
const {
  getUserCoworkProject,
  deleteCoworkProject,
  addCoworkProjectConversation,
  removeCoworkConversation,
} = require('~/models/CoworkProject');
const { getCoworkSkill, deleteCoworkSkill } = require('~/models/CoworkSkill');

const USER = 'user-aaa';
const OTHER = 'user-bbb';
const PROJECT = 'proj-123';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Cowork multi-tenant isolation (B2)', () => {
  describe('CoworkProject — every query is owner-scoped', () => {
    it('getUserCoworkProject queries by { _id, user }', async () => {
      db.CoworkProject.findOne.mockReturnValue(leanValue({ _id: PROJECT, user: USER }));
      await getUserCoworkProject({ user: USER, projectId: PROJECT });
      expect(db.CoworkProject.findOne).toHaveBeenCalledWith({ _id: PROJECT, user: USER });
    });

    it("denies another user's project id (owner filter yields no doc)", async () => {
      db.CoworkProject.findOne.mockReturnValue(leanValue(null));
      const res = await getUserCoworkProject({ user: OTHER, projectId: PROJECT });
      expect(db.CoworkProject.findOne).toHaveBeenCalledWith({ _id: PROJECT, user: OTHER });
      expect(res).toBeNull();
    });

    it('deleteCoworkProject scopes the delete by { _id, user }', async () => {
      db.CoworkProject.findOneAndDelete.mockReturnValue(leanValue(null));
      await deleteCoworkProject({ user: USER, projectId: PROJECT });
      expect(db.CoworkProject.findOneAndDelete).toHaveBeenCalledWith({ _id: PROJECT, user: USER });
    });

    it('addCoworkProjectConversation scopes the update filter by { _id, user }', async () => {
      db.CoworkProject.findOneAndUpdate.mockReturnValue(leanValue(null));
      await addCoworkProjectConversation({ user: USER, projectId: PROJECT, conversationId: 'c1' });
      expect(db.CoworkProject.findOneAndUpdate.mock.calls[0][0]).toEqual({ _id: PROJECT, user: USER });
    });

    it('removeCoworkConversation scopes the update filter by { _id, user }', async () => {
      db.CoworkProject.findOneAndUpdate.mockReturnValue(leanValue(null));
      await removeCoworkConversation({ user: USER, projectId: PROJECT, conversationId: 'c1' });
      expect(db.CoworkProject.findOneAndUpdate.mock.calls[0][0]).toEqual({ _id: PROJECT, user: USER });
    });

    it('removeCoworkConversation requires a conversationId', async () => {
      await expect(removeCoworkConversation({ user: USER, projectId: PROJECT })).rejects.toThrow(
        /conversationId/,
      );
    });
  });

  describe('CoworkSkill — every query is owner-scoped', () => {
    const VALID_ID = '507f1f77bcf86cd799439011';

    it('getCoworkSkill queries by { _id, user }', async () => {
      db.CoworkSkill.findOne.mockReturnValue(leanValue({ _id: VALID_ID, user: USER }));
      await getCoworkSkill({ user: USER, skillId: VALID_ID });
      expect(db.CoworkSkill.findOne).toHaveBeenCalledWith({ _id: VALID_ID, user: USER });
    });

    it('deleteCoworkSkill scopes the delete by { _id, user }', async () => {
      db.CoworkSkill.findOneAndDelete.mockReturnValue(leanValue(null));
      await deleteCoworkSkill({ user: USER, skillId: VALID_ID });
      expect(db.CoworkSkill.findOneAndDelete).toHaveBeenCalledWith({ _id: VALID_ID, user: USER });
    });

    it('rejects an invalid skill id without touching the DB', async () => {
      const res = await getCoworkSkill({ user: USER, skillId: 'not-a-valid-objectid' });
      expect(res).toBeNull();
      expect(db.CoworkSkill.findOne).not.toHaveBeenCalled();
    });
  });
});
