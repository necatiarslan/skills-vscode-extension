/**
 * Skill data model from skillsmp.com API
 */
export interface Skill {
  id: string;
  name: string;
  author: string;
  description: string;
  githubUrl: string;
  skillUrl: string;
  stars: number;
  updatedAt: string;
  tags?: string[];
}

/**
 * Skill API response wrapper
 */
export interface SkillsApiResponse {
  success?: boolean;
  data: {
    skills: Skill[];
  };
  pagination: {
    total: number;
    page: number;
    limit: number;
  };
}

/**
 * Cached search result with timestamp
 */
export interface CachedSearchResult {
  skills: Skill[];
  timestamp: number;
}

/**
 * Cached skill detail with timestamp
 */
export interface CachedSkillDetail {
  skill: Skill;
  timestamp: number;
}

/**
 * Tool configuration for installation
 */
export interface ToolConfig {
  name: string;
  displayName: string;
  globalDir: string;
  canonicalDir?: string;
  projectSkillDir: string;
  isUniversal: boolean;
  detectionPaths: string[];
  hostNames: string[];
  preferredInstallMode?: InstallMethod;
  installed: boolean;
}

export type InstallMethod = 'symlink' | 'copy';

export interface InstallSourceInfo {
  githubUrl: string;
  owner: string;
  repo: string;
  branch: string;
  skillPath: string;
}

export interface InstallResult {
  tool: ToolConfig;
  canonicalPath: string;
  installPath: string;
  installMethod: InstallMethod;
  source: InstallSourceInfo;
}

/**
 * Installed skill record per tool
 */
export interface InstalledSkill {
  skillId: string;
  name: string;
  author: string;
  version: string;
  installedAt: number;
  localPath: string;
  canonicalPath?: string;
  installMethod?: InstallMethod;
  sourceUrl?: string;
  sourceBranch?: string;
  sourcePath?: string;
}

export type SkillInstallScope = 'global' | 'workspace';
export type SkillInstallKind = 'managed' | 'other';

export interface MarketplaceInstalledSkill {
  skillId: string;
  name: string;
  author: string;
  description?: string;
  localPath: string;
  scope: SkillInstallScope;
  kind: SkillInstallKind;
  outdated?: boolean;
  canOpenDetails: boolean;
  canUninstall: boolean;
}

export interface MarketplaceInstalledGroups {
  installedGlobal: MarketplaceInstalledSkill[];
  installedWorkspace: MarketplaceInstalledSkill[];
}

export interface GitHubRepoContext {
  owner: string;
  repo: string;
  branch: string;
  skillPath: string;
  sourceUrl: string;
}

export interface GitHubRepoEntry {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size?: number;
  downloadUrl?: string;
  htmlUrl: string;
  sha?: string;
}

export interface GitHubRepoMetadata {
  fullName: string;
  description: string;
  defaultBranch: string;
  stargazersCount: number;
  forksCount: number;
  openIssuesCount: number;
  updatedAt: string;
  licenseName?: string;
  htmlUrl: string;
}

export interface GitHubDirectoryResult {
  context: GitHubRepoContext;
  currentPath: string;
  entries: GitHubRepoEntry[];
}

export interface GitHubFilePreview {
  context: GitHubRepoContext;
  path: string;
  name: string;
  htmlUrl: string;
  languageHint: string;
  content: string;
  truncated: boolean;
  tooLarge: boolean;
  isBinary: boolean;
}

export interface LocalRepoEntry {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size?: number;
}

export interface LocalDirectoryResult {
  currentPath: string;
  entries: LocalRepoEntry[];
}

export interface LocalFilePreview {
  path: string;
  name: string;
  languageHint: string;
  content: string;
  truncated: boolean;
  tooLarge: boolean;
  isBinary: boolean;
}

export interface SkillDetailPayload {
  skill: Skill;
  repoContext: GitHubRepoContext;
  repoMetadata: GitHubRepoMetadata;
  rootDirectory: GitHubDirectoryResult;
  initialDirectory?: GitHubDirectoryResult;
  initialPreview?: GitHubFilePreview;
  localRootDirectory?: LocalDirectoryResult;
  localInitialDirectory?: LocalDirectoryResult;
  localInitialPreview?: LocalFilePreview;
  skillEmoji: string;
  skillMarkdown?: string;
}
