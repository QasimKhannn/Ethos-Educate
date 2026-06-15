// cowork — unit tests for CoworkSkillsService (fixture skills dir, no DB).
import * as os from 'os';
import * as path from 'path';
import { promises as fs } from 'fs';
import {
  parseFrontmatter,
  listBuiltinSkills,
  loadBuiltinSkill,
  buildSkillsPrompt,
} from './CoworkSkillsService';

describe('CoworkSkillsService', () => {
  let root: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'cowork-skills-'));
    // A well-formed skill.
    await fs.mkdir(path.join(root, 'pptx'));
    await fs.writeFile(
      path.join(root, 'pptx', 'SKILL.md'),
      `---\nname: pptx\ndescription: "Make slide decks"\nlicense: Proprietary\n---\n\n# PPTX\n\nBody instructions here.`,
    );
    // A skill whose name falls back to the dir name.
    await fs.mkdir(path.join(root, 'docx'));
    await fs.writeFile(path.join(root, 'docx', 'SKILL.md'), `# no frontmatter\n\njust body`);
    // A directory that is not a skill (no SKILL.md) — should be ignored.
    await fs.mkdir(path.join(root, 'notaskill'));
    await fs.writeFile(path.join(root, 'notaskill', 'readme.txt'), 'nope');
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  describe('parseFrontmatter', () => {
    it('extracts quoted and unquoted keys and returns the body', () => {
      const { meta, body } = parseFrontmatter(
        `---\nname: pptx\ndescription: "Make slide decks"\n---\nHello body`,
      );
      expect(meta.name).toBe('pptx');
      expect(meta.description).toBe('Make slide decks');
      expect(body.trim()).toBe('Hello body');
    });

    it('returns the whole input as body when there is no frontmatter', () => {
      const { meta, body } = parseFrontmatter('# just markdown');
      expect(meta).toEqual({});
      expect(body).toBe('# just markdown');
    });
  });

  describe('listBuiltinSkills', () => {
    it('lists only dirs containing a SKILL.md, sorted by id', async () => {
      const skills = await listBuiltinSkills(root);
      expect(skills.map((s) => s.id)).toEqual(['docx', 'pptx']);
      const pptx = skills.find((s) => s.id === 'pptx');
      expect(pptx).toMatchObject({ name: 'pptx', description: 'Make slide decks', source: 'builtin' });
    });

    it('falls back to the dir name when frontmatter lacks a name', async () => {
      const skills = await listBuiltinSkills(root);
      expect(skills.find((s) => s.id === 'docx')?.name).toBe('docx');
    });

    it('returns [] for a missing root', async () => {
      expect(await listBuiltinSkills(path.join(root, 'nope'))).toEqual([]);
    });
  });

  describe('loadBuiltinSkill', () => {
    it('loads metadata + body content', async () => {
      const skill = await loadBuiltinSkill(root, 'pptx');
      expect(skill?.content).toContain('Body instructions here.');
      expect(skill?.content).not.toContain('---');
    });

    it('rejects unsafe ids and missing skills', async () => {
      expect(await loadBuiltinSkill(root, '../etc')).toBeNull();
      expect(await loadBuiltinSkill(root, 'ghost')).toBeNull();
    });
  });

  describe('buildSkillsPrompt', () => {
    it('returns empty string for no skills', () => {
      expect(buildSkillsPrompt([])).toBe('');
    });

    it('includes each enabled skill name and content', () => {
      const prompt = buildSkillsPrompt([
        { id: 'pptx', name: 'pptx', description: 'Make slide decks', source: 'builtin', content: 'DECK RULES' },
      ]);
      expect(prompt).toContain('Skill: pptx');
      expect(prompt).toContain('Make slide decks');
      expect(prompt).toContain('DECK RULES');
    });
  });
});
