import * as os from 'os';
import * as path from 'path';

export type SkillInstallMode = 'symlink' | 'copy';

export interface SkillAgentLocation {
  name: string;
  displayName: string;
  hostNames: string[];
  detectionPaths: string[];
  globalSkillDir: string;
  projectSkillDir: string;
  isUniversal: boolean;
  preferredInstallMode: SkillInstallMode;
}

export interface SkillLocationConfig {
  canonicalSkillRoot: string;
  agents: SkillAgentLocation[];
}

function buildSkillLocationConfig(): SkillLocationConfig {
  const homeDir = os.homedir();
  const claudeHome = process.env.CLAUDE_CONFIG_DIR?.trim() || path.join(homeDir, '.claude');
  const codexHome = process.env.CODEX_HOME?.trim() || path.join(homeDir, '.codex');

  return {
    canonicalSkillRoot: path.join(homeDir, '.agents', 'skills'),
    agents: [
      {
        name: 'vscode',
        displayName: 'Visual Studio Code',
        globalSkillDir: path.join(homeDir, '.copilot', 'skills'),
        detectionPaths: [path.join(homeDir, '.vscode')],
        hostNames: ['visual studio code', 'vscode', 'github copilot', 'copilot'],
        projectSkillDir: '.agents/skills',
        isUniversal: true,
        preferredInstallMode: 'symlink'
      },
      {
        name: 'cursor',
        displayName: 'Cursor',
        globalSkillDir: path.join(homeDir, '.cursor', 'skills'),
        detectionPaths: [path.join(homeDir, '.cursor')],
        hostNames: ['cursor'],
        projectSkillDir: '.agents/skills',
        isUniversal: true,
        preferredInstallMode: 'symlink'
      },
      {
        name: 'windsurf',
        displayName: 'Windsurf',
        globalSkillDir: path.join(homeDir, '.codeium', 'windsurf', 'skills'),
        detectionPaths: [path.join(homeDir, '.codeium', 'windsurf')],
        hostNames: ['windsurf'],
        projectSkillDir: '.windsurf/skills',
        isUniversal: false,
        preferredInstallMode: 'symlink'
      },
      {
        name: 'antigravity',
        displayName: 'Antigravity',
        globalSkillDir: path.join(homeDir, '.gemini', 'antigravity', 'skills'),
        detectionPaths: [path.join(homeDir, '.gemini', 'antigravity')],
        hostNames: ['antigravity'],
        projectSkillDir: '.agents/skills',
        isUniversal: true,
        preferredInstallMode: 'symlink'
      },
      {
        name: 'claude-code',
        displayName: 'Claude Code',
        globalSkillDir: path.join(claudeHome, 'skills'),
        detectionPaths: [claudeHome],
        hostNames: ['claude', 'claude code'],
        projectSkillDir: '.claude/skills',
        isUniversal: false,
        preferredInstallMode: 'symlink'
      },
      {
        name: 'codex',
        displayName: 'Codex',
        globalSkillDir: path.join(codexHome, 'skills'),
        detectionPaths: [codexHome, '/etc/codex'],
        hostNames: ['codex'],
        projectSkillDir: '.agents/skills',
        isUniversal: true,
        preferredInstallMode: 'symlink'
      },
      {
        name: 'gemini-cli',
        displayName: 'Gemini CLI',
        globalSkillDir: path.join(homeDir, '.gemini', 'skills'),
        detectionPaths: [path.join(homeDir, '.gemini')],
        hostNames: ['gemini', 'gemini cli'],
        projectSkillDir: '.agents/skills',
        isUniversal: true,
        preferredInstallMode: 'symlink'
      },
      {
        name: 'opencode',
        displayName: 'OpenCode',
        globalSkillDir: path.join(homeDir, '.config', 'opencode', 'skills'),
        detectionPaths: [path.join(homeDir, '.config', 'opencode')],
        hostNames: ['opencode', 'open code'],
        projectSkillDir: '.agents/skills',
        isUniversal: true,
        preferredInstallMode: 'symlink'
      }
    ]
  };
}

export const SKILL_LOCATION_CONFIG = buildSkillLocationConfig();

export function getSkillAgentLocation(agentName: string): SkillAgentLocation | null {
  return SKILL_LOCATION_CONFIG.agents.find((agent) => agent.name === agentName) || null;
}
