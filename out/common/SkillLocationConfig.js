"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SKILL_LOCATION_CONFIG = void 0;
exports.getSkillAgentLocation = getSkillAgentLocation;
const os = __importStar(require("os"));
const path = __importStar(require("path"));
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