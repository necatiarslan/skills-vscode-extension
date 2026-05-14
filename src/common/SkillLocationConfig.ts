import * as os from 'os';
import * as path from 'path';

export type SkillInstallMode = 'symlink' | 'copy';

export interface SkillAgentLocation {
  name: string;
  displayName: string;
  hostNames: string[];
  detectionPaths: string[];
  globalSkillDir: string;
  workspaceInstallDir: string;
  workspaceScanDirCandidates: string[];
  preferredInstallMode: SkillInstallMode;
}

export interface SkillLocationConfig {
  canonicalSkillRoot: string;
  agents: SkillAgentLocation[];
}

function buildSkillLocationConfig(): SkillLocationConfig {
  const homeDir = os.homedir();
  const workspaceScanDirCandidates = [
    'skills',
    '.skills/skills',
    '.copilot/skills',
    '.github/skills'
  ];

  return {
    canonicalSkillRoot: path.join(homeDir, '.skills', 'skills'),
    agents: [
      {
        name: 'vscode',
        displayName: 'Visual Studio Code',
        globalSkillDir: path.join(homeDir, '.copilot', 'skills'),
        detectionPaths: [path.join(homeDir, '.vscode')],
        hostNames: ['visual studio code', 'vscode', 'github copilot', 'copilot'],
        workspaceInstallDir: 'skills',
        workspaceScanDirCandidates,
        preferredInstallMode: 'symlink'
      },
      {
        name: 'cursor',
        displayName: 'Cursor',
        globalSkillDir: path.join(homeDir, '.cursor', 'skills'),
        detectionPaths: [path.join(homeDir, '.cursor')],
        hostNames: ['cursor'],
        workspaceInstallDir: 'skills',
        workspaceScanDirCandidates,
        preferredInstallMode: 'symlink'
      },
      {
        name: 'windsurf',
        displayName: 'Windsurf',
        globalSkillDir: path.join(homeDir, '.windsurf', 'skills'),
        detectionPaths: [path.join(homeDir, '.windsurf')],
        hostNames: ['windsurf'],
        workspaceInstallDir: 'skills',
        workspaceScanDirCandidates,
        preferredInstallMode: 'symlink'
      },
      {
        name: 'antigravity',
        displayName: 'Antigravity',
        globalSkillDir: path.join(homeDir, '.gemini', 'antigravity', 'skills'),
        detectionPaths: [path.join(homeDir, '.gemini', 'antigravity')],
        hostNames: ['antigravity'],
        workspaceInstallDir: 'skills',
        workspaceScanDirCandidates,
        preferredInstallMode: 'symlink'
      },
      {
        name: 'claude-code',
        displayName: 'Claude Code',
        globalSkillDir: path.join(homeDir, '.claude', 'skills'),
        detectionPaths: [path.join(homeDir, '.claude')],
        hostNames: ['claude', 'claude code'],
        workspaceInstallDir: 'skills',
        workspaceScanDirCandidates,
        preferredInstallMode: 'symlink'
      },
      {
        name: 'codex',
        displayName: 'Codex',
        globalSkillDir: path.join(process.env.CODEX_HOME?.trim() || path.join(homeDir, '.codex'), 'skills'),
        detectionPaths: [process.env.CODEX_HOME?.trim() || path.join(homeDir, '.codex'), '/etc/codex'],
        hostNames: ['codex'],
        workspaceInstallDir: 'skills',
        workspaceScanDirCandidates,
        preferredInstallMode: 'symlink'
      },
      {
        name: 'gemini-cli',
        displayName: 'Gemini CLI',
        globalSkillDir: path.join(homeDir, '.gemini', 'skills'),
        detectionPaths: [path.join(homeDir, '.gemini')],
        hostNames: ['gemini', 'gemini cli'],
        workspaceInstallDir: 'skills',
        workspaceScanDirCandidates,
        preferredInstallMode: 'symlink'
      },
      {
        name: 'opencode',
        displayName: 'OpenCode',
        globalSkillDir: path.join(homeDir, '.config', 'opencode', 'skills'),
        detectionPaths: [path.join(homeDir, '.config', 'opencode')],
        hostNames: ['opencode', 'open code'],
        workspaceInstallDir: 'skills',
        workspaceScanDirCandidates,
        preferredInstallMode: 'symlink'
      }
    ]
  };
}

export const SKILL_LOCATION_CONFIG = buildSkillLocationConfig();

export function getSkillAgentLocation(agentName: string): SkillAgentLocation | null {
  return SKILL_LOCATION_CONFIG.agents.find((agent) => agent.name === agentName) || null;
}
