// cowork — loads builtin skills from disk and builds the prompt injection block.
//
// A "skill" is a directory under the skills root containing a SKILL.md with YAML
// frontmatter (name, description). The body is the model-facing instructions.
// This module is pure (the skills root is injected) so it unit-tests against a
// fixture dir and is reusable by routes + the agent prompt builder.

import * as path from 'path';
import { promises as fs } from 'fs';

export type CoworkSkillSource = 'builtin' | 'custom';

export interface CoworkSkillMeta {
  /** Stable id — the skill directory name for builtin skills. */
  id: string;
  name: string;
  description: string;
  source: CoworkSkillSource;
}

export interface CoworkSkill extends CoworkSkillMeta {
  /** Full SKILL.md body (frontmatter stripped). */
  content: string;
}

const SKILL_FILE = 'SKILL.md';

/**
 * Minimal YAML-frontmatter parser for the simple `key: value` blocks SKILL.md
 * uses (optionally quoted values). Avoids pulling in a YAML dependency.
 */
export function parseFrontmatter(markdown: string): {
  meta: Record<string, string>;
  body: string;
} {
  const match = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/.exec(markdown);
  if (!match) {
    return { meta: {}, body: markdown };
  }
  const meta: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const kv = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line.trim());
    if (!kv) {
      continue;
    }
    let value = kv[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    meta[kv[1]] = value;
  }
  return { meta, body: match[2] };
}

/** True if a path segment is a safe single dir name (no separators / traversal). */
function isSafeId(id: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(id);
}

/** List the builtin skills found under `skillsRoot` (one per subdir with a SKILL.md). */
export async function listBuiltinSkills(skillsRoot: string): Promise<CoworkSkillMeta[]> {
  let entries: import('fs').Dirent[];
  try {
    entries = await fs.readdir(skillsRoot, { withFileTypes: true });
  } catch {
    return [];
  }

  const skills: CoworkSkillMeta[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !isSafeId(entry.name)) {
      continue;
    }
    const skillFile = path.join(skillsRoot, entry.name, SKILL_FILE);
    let raw: string;
    try {
      raw = await fs.readFile(skillFile, 'utf8');
    } catch {
      continue; // dir without a SKILL.md is not a skill
    }
    const { meta } = parseFrontmatter(raw);
    skills.push({
      id: entry.name,
      name: meta.name || entry.name,
      description: meta.description || '',
      source: 'builtin',
    });
  }
  skills.sort((a, b) => a.id.localeCompare(b.id));
  return skills;
}

/** Load a single builtin skill (metadata + full body) by id. */
export async function loadBuiltinSkill(
  skillsRoot: string,
  id: string,
): Promise<CoworkSkill | null> {
  if (!isSafeId(id)) {
    return null;
  }
  const skillFile = path.join(skillsRoot, id, SKILL_FILE);
  let raw: string;
  try {
    raw = await fs.readFile(skillFile, 'utf8');
  } catch {
    return null;
  }
  const { meta, body } = parseFrontmatter(raw);
  return {
    id,
    name: meta.name || id,
    description: meta.description || '',
    source: 'builtin',
    content: body.trim(),
  };
}

/**
 * Build the system-prompt block for a set of enabled skills.
 * Each skill contributes its full SKILL.md guidance under a labeled section.
 */
export function buildSkillsPrompt(skills: CoworkSkill[]): string {
  if (skills.length === 0) {
    return '';
  }
  const sections = skills.map(
    (s) => `## Skill: ${s.name}\n${s.description ? `${s.description}\n\n` : ''}${s.content}`,
  );
  return [
    'You have the following skills enabled. Each provides authoritative instructions for a task type — follow them when the task matches.',
    '',
    ...sections,
  ].join('\n');
}
