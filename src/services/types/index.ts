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
  installed: boolean;
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
}
