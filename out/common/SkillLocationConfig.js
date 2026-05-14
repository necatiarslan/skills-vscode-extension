"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SKILL_LOCATION_CONFIG = void 0;
exports.getSkillAgentLocation = getSkillAgentLocation;
const os = require("os");
const path = require("path");
function buildSkillLocationConfig() {
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
exports.SKILL_LOCATION_CONFIG = buildSkillLocationConfig();
function getSkillAgentLocation(agentName) {
    return exports.SKILL_LOCATION_CONFIG.agents.find((agent) => agent.name === agentName) || null;
}
//# sourceMappingURL=SkillLocationConfig.js.map