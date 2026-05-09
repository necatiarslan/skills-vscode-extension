import * as https from 'https';
import * as url from 'url';
import { logToOutput } from '../common/UI';
import { Skill, SkillsApiResponse, CachedSearchResult, CachedSkillDetail } from './types';

/**
 * SkillsApiService - Handles all communication with skillsmp.com API
 * Includes caching, error handling, and search functionality
 */
export class SkillsApiService {
  private static readonly API_BASE = 'https://skillsmp.com/api/v1';
  private static readonly API_KEY = 'sk_live_skillsmp_xOJ-jdymDoGS9FBzTWVcwk_hdnQ9QGGeMRFstrbYArk';
  private static readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  private searchCache: Map<string, CachedSearchResult> = new Map();
  private detailCache: Map<string, CachedSkillDetail> = new Map();

  /**
   * Search for skills by query string
   * Results are cached for 5 minutes
   */
  public async search(query: string, page: number = 1, limit: number = 20): Promise<Skill[]> {
    const cacheKey = `${query}:${page}:${limit}`;

    // Check cache first
    if (this.searchCache.has(cacheKey)) {
      const cached = this.searchCache.get(cacheKey)!;
      if (Date.now() - cached.timestamp < SkillsApiService.CACHE_TTL_MS) {
        logToOutput(`[Cache HIT] search: ${query}`);
        return cached.skills;
      }
    }

    try {
      logToOutput(`[API] Searching skills: ${query}`);
      const response = await this.makeRequest(
        `/skills/search?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`
      );

      const parsed = JSON.parse(response) as unknown;
      const skills = this.extractSkillsFromSearchResponse(parsed);

      this.searchCache.set(cacheKey, {
        skills,
        timestamp: Date.now()
      });

      return skills;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logToOutput(`[ERROR] Search failed: ${errorMsg}`);
      throw error;
    }
  }

  /**
   * Fetch detailed information for a specific skill
   */
  public async fetchDetail(skillId: string): Promise<Skill | null> {
    // Check cache first
    if (this.detailCache.has(skillId)) {
      const cached = this.detailCache.get(skillId)!;
      if (Date.now() - cached.timestamp < SkillsApiService.CACHE_TTL_MS) {
        logToOutput(`[Cache HIT] detail: ${skillId}`);
        return cached.skill;
      }
    }

    try {
      logToOutput(`[API] Fetching skill detail: ${skillId}`);
      const response = await this.makeRequest(`/skills/${skillId}`);
      const parsed = JSON.parse(response) as unknown;
      const skill = this.extractSkillFromDetailResponse(parsed);

      if (!skill) {
        return null;
      }

      // Cache the result
      this.detailCache.set(skillId, { skill, timestamp: Date.now() });

      return skill;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logToOutput(`[ERROR] Fetch detail failed: ${errorMsg}`);
      return null;
    }
  }

  /**
   * Clear all caches
   */
  public clearCache(): void {
    this.searchCache.clear();
    this.detailCache.clear();
    logToOutput('[Cache] Cleared all caches');
  }

  /**
   * Make HTTPS request to API
   */
  private makeRequest(endpoint: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const requestUrl = `${SkillsApiService.API_BASE}${endpoint}`;
      const parsedUrl = url.parse(requestUrl);

      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.path,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${SkillsApiService.API_KEY}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Skills-VSCode-Extension/1.0'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(data);
          } else {
            reject(new Error(`API Error: ${res.statusCode} ${res.statusMessage}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.end();
    });
  }

  /**
   * Normalize search response payloads from API.
   * Supported shapes:
   * 1) { success: true, data: { skills: Skill[] } }
   * 2) { data: Skill[] }
   * 3) Skill[]
   */
  private extractSkillsFromSearchResponse(payload: unknown): Skill[] {
    if (Array.isArray(payload)) {
      return payload.map((item) => this.normalizeSkill(item)).filter((s): s is Skill => s !== null);
    }

    if (this.isRecord(payload)) {
      const apiResponse = payload as Partial<SkillsApiResponse> & { data?: unknown };

      if (Array.isArray(apiResponse.data)) {
        return apiResponse.data
          .map((item) => this.normalizeSkill(item))
          .filter((s): s is Skill => s !== null);
      }

      if (this.isRecord(apiResponse.data) && Array.isArray((apiResponse.data as { skills?: unknown }).skills)) {
        return ((apiResponse.data as { skills: unknown[] }).skills)
          .map((item) => this.normalizeSkill(item))
          .filter((s): s is Skill => s !== null);
      }
    }

    throw new Error('Unexpected search response shape from API');
  }

  /**
   * Normalize detail response payloads from API.
   */
  private extractSkillFromDetailResponse(payload: unknown): Skill | null {
    if (this.isRecord(payload) && this.isRecord(payload.data) && this.isRecord(payload.data.skill)) {
      return this.normalizeSkill(payload.data.skill);
    }

    if (this.isRecord(payload) && this.isRecord(payload.data)) {
      return this.normalizeSkill(payload.data);
    }

    return this.normalizeSkill(payload);
  }

  /**
   * Normalize raw API object into Skill.
   */
  private normalizeSkill(raw: unknown): Skill | null {
    if (!this.isRecord(raw)) {
      return null;
    }

    const id = this.toStringOrEmpty(raw.id);
    const name = this.toStringOrEmpty(raw.name);
    const author = this.toStringOrEmpty(raw.author);

    if (!id || !name || !author) {
      return null;
    }

    return {
      id,
      name,
      author,
      description: this.toStringOrEmpty(raw.description),
      githubUrl: this.toStringOrEmpty(raw.githubUrl ?? raw.github_url),
      skillUrl: this.toStringOrEmpty(raw.skillUrl ?? raw.skill_url),
      stars: this.toNumberOrZero(raw.stars),
      updatedAt: this.toStringOrEmpty(raw.updatedAt ?? raw.updated_at),
      tags: Array.isArray(raw.tags)
        ? raw.tags.map((tag) => this.toStringOrEmpty(tag)).filter((tag) => tag.length > 0)
        : undefined
    };
  }

  private isRecord(value: unknown): value is Record<string, any> {
    return typeof value === 'object' && value !== null;
  }

  private toStringOrEmpty(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    return '';
  }

  private toNumberOrZero(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return 0;
  }
}

// Export singleton instance
export const skillsApiService = new SkillsApiService();
