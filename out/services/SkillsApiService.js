"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.skillsApiService = exports.SkillsApiService = void 0;
const https = require("https");
const url = require("url");
const UI_1 = require("../common/UI");
/**
 * SkillsApiService - Handles all communication with skillsmp.com API
 * Includes caching, error handling, and search functionality
 */
class SkillsApiService {
    static API_BASE = 'https://skillsmp.com/api/v1';
    static API_KEY = 'sk_live_skillsmp_xOJ-jdymDoGS9FBzTWVcwk_hdnQ9QGGeMRFstrbYArk';
    static CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
    searchCache = new Map();
    detailCache = new Map();
    /**
     * Search for skills by query string
     * Results are cached for 5 minutes
     */
    async search(query, page = 1, limit = 20) {
        const cacheKey = `${query}:${page}:${limit}`;
        // Check cache first
        if (this.searchCache.has(cacheKey)) {
            const cached = this.searchCache.get(cacheKey);
            if (Date.now() - cached.timestamp < SkillsApiService.CACHE_TTL_MS) {
                (0, UI_1.logToOutput)(`[Cache HIT] search: ${query}`);
                return cached.skills;
            }
        }
        try {
            (0, UI_1.logToOutput)(`[API] Searching skills: ${query}`);
            const response = await this.makeRequest(`/skills/search?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`);
            const parsed = JSON.parse(response);
            const skills = this.extractSkillsFromSearchResponse(parsed);
            this.searchCache.set(cacheKey, {
                skills,
                timestamp: Date.now()
            });
            return skills;
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            (0, UI_1.logToOutput)(`[ERROR] Search failed: ${errorMsg}`);
            throw error;
        }
    }
    /**
     * Fetch detailed information for a specific skill
     */
    async fetchDetail(skillId) {
        // Check cache first
        if (this.detailCache.has(skillId)) {
            const cached = this.detailCache.get(skillId);
            if (Date.now() - cached.timestamp < SkillsApiService.CACHE_TTL_MS) {
                (0, UI_1.logToOutput)(`[Cache HIT] detail: ${skillId}`);
                return cached.skill;
            }
        }
        try {
            (0, UI_1.logToOutput)(`[API] Fetching skill detail: ${skillId}`);
            const response = await this.makeRequest(`/skills/${skillId}`);
            const parsed = JSON.parse(response);
            const skill = this.extractSkillFromDetailResponse(parsed);
            if (!skill) {
                return null;
            }
            // Cache the result
            this.detailCache.set(skillId, { skill, timestamp: Date.now() });
            return skill;
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            (0, UI_1.logToOutput)(`[ERROR] Fetch detail failed: ${errorMsg}`);
            return null;
        }
    }
    /**
     * Clear all caches
     */
    clearCache() {
        this.searchCache.clear();
        this.detailCache.clear();
        (0, UI_1.logToOutput)('[Cache] Cleared all caches');
    }
    /**
     * Make HTTPS request to API
     */
    makeRequest(endpoint) {
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
                    }
                    else {
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
    extractSkillsFromSearchResponse(payload) {
        if (Array.isArray(payload)) {
            return payload.map((item) => this.normalizeSkill(item)).filter((s) => s !== null);
        }
        if (this.isRecord(payload)) {
            const apiResponse = payload;
            if (Array.isArray(apiResponse.data)) {
                return apiResponse.data
                    .map((item) => this.normalizeSkill(item))
                    .filter((s) => s !== null);
            }
            if (this.isRecord(apiResponse.data) && Array.isArray(apiResponse.data.skills)) {
                return (apiResponse.data.skills)
                    .map((item) => this.normalizeSkill(item))
                    .filter((s) => s !== null);
            }
        }
        throw new Error('Unexpected search response shape from API');
    }
    /**
     * Normalize detail response payloads from API.
     */
    extractSkillFromDetailResponse(payload) {
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
    normalizeSkill(raw) {
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
    isRecord(value) {
        return typeof value === 'object' && value !== null;
    }
    toStringOrEmpty(value) {
        if (typeof value === 'string') {
            return value;
        }
        if (typeof value === 'number' || typeof value === 'boolean') {
            return String(value);
        }
        return '';
    }
    toNumberOrZero(value) {
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
exports.SkillsApiService = SkillsApiService;
// Export singleton instance
exports.skillsApiService = new SkillsApiService();
//# sourceMappingURL=SkillsApiService.js.map