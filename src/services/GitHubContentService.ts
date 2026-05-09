import * as https from 'https';
import { URL } from 'url';
import { logToOutput } from '../common/UI';
import {
  GitHubDirectoryResult,
  GitHubFilePreview,
  GitHubRepoContext,
  GitHubRepoEntry,
  GitHubRepoMetadata
} from './types';

type CacheItem<T> = {
  timestamp: number;
  value: T;
};

type GitHubContentsEntry = {
  name?: unknown;
  path?: unknown;
  type?: unknown;
  size?: unknown;
  download_url?: unknown;
  html_url?: unknown;
  sha?: unknown;
};

type GitHubFilePayload = {
  name?: unknown;
  path?: unknown;
  html_url?: unknown;
  content?: unknown;
  encoding?: unknown;
  size?: unknown;
};

export class GitHubContentService {
  private static readonly API_BASE = 'https://api.github.com';
  private static readonly CACHE_TTL_MS = 2 * 60 * 1000;
  private static readonly MAX_PREVIEW_BYTES = 100_000;

  private readonly metadataCache = new Map<string, CacheItem<GitHubRepoMetadata>>();
  private readonly directoryCache = new Map<string, CacheItem<GitHubDirectoryResult>>();
  private readonly previewCache = new Map<string, CacheItem<GitHubFilePreview>>();

  public parseGitHubUrl(sourceUrl: string): GitHubRepoContext {
    let parsedUrl: URL;

    try {
      parsedUrl = new URL(sourceUrl);
    } catch {
      throw new Error('Invalid GitHub URL');
    }

    if (!parsedUrl.hostname.includes('github.com')) {
      throw new Error('Only github.com URLs are supported');
    }

    const parts = parsedUrl.pathname.split('/').filter((part) => part.length > 0);
    if (parts.length < 2) {
      throw new Error('GitHub URL must include owner and repository');
    }

    const owner = parts[0];
    const repo = this.stripGitSuffix(parts[1]);
    let branch = 'HEAD';
    let skillPath = '';

    if (parts[2] === 'tree' && parts[3]) {
      branch = decodeURIComponent(parts[3]);
      skillPath = this.normalizePath(parts.slice(4).join('/'));
    } else if (parts[2] === 'blob' && parts[3]) {
      branch = decodeURIComponent(parts[3]);
      skillPath = this.normalizePath(parts.slice(4).join('/'));
    }

    return {
      owner,
      repo,
      branch,
      skillPath,
      sourceUrl
    };
  }

  public async getRepoMetadata(context: GitHubRepoContext): Promise<GitHubRepoMetadata> {
    const cacheKey = `${context.owner}/${context.repo}`;
    const cached = this.getCached(this.metadataCache, cacheKey);
    if (cached) {
      return cached;
    }

    const response = await this.makeJsonRequest(`/repos/${context.owner}/${context.repo}`);
    if (!this.isRecord(response)) {
      throw new Error('Unexpected GitHub repository metadata response');
    }

    const metadata: GitHubRepoMetadata = {
      fullName: this.toStringValue(response.full_name) || `${context.owner}/${context.repo}`,
      description: this.toStringValue(response.description),
      defaultBranch: this.toStringValue(response.default_branch) || 'main',
      stargazersCount: this.toNumberValue(response.stargazers_count),
      forksCount: this.toNumberValue(response.forks_count),
      openIssuesCount: this.toNumberValue(response.open_issues_count),
      updatedAt: this.toStringValue(response.updated_at),
      licenseName: this.isRecord(response.license) ? this.toStringValue(response.license.name) : undefined,
      htmlUrl: this.toStringValue(response.html_url) || `https://github.com/${context.owner}/${context.repo}`
    };

    this.metadataCache.set(cacheKey, { timestamp: Date.now(), value: metadata });
    return metadata;
  }

  public async listDirectory(context: GitHubRepoContext, currentPath: string): Promise<GitHubDirectoryResult> {
    const normalizedPath = this.normalizePath(currentPath);
    const branch = context.branch === 'HEAD' ? (await this.getRepoMetadata(context)).defaultBranch : context.branch;
    const resolvedContext = { ...context, branch };
    const cacheKey = `${resolvedContext.owner}/${resolvedContext.repo}:${branch}:${normalizedPath}`;
    const cached = this.getCached(this.directoryCache, cacheKey);
    if (cached) {
      return cached;
    }

    const pathSuffix = normalizedPath ? `/${this.encodePath(normalizedPath)}` : '';
    const response = await this.makeJsonRequest(
      `/repos/${resolvedContext.owner}/${resolvedContext.repo}/contents${pathSuffix}?ref=${encodeURIComponent(branch)}`
    );

    const entries = this.normalizeDirectoryEntries(response)
      .sort((left, right) => {
        if (left.type !== right.type) {
          return left.type === 'dir' ? -1 : 1;
        }

        return left.name.localeCompare(right.name);
      });

    const result: GitHubDirectoryResult = {
      context: resolvedContext,
      currentPath: normalizedPath,
      entries
    };

    this.directoryCache.set(cacheKey, { timestamp: Date.now(), value: result });
    return result;
  }

  public async getFilePreview(context: GitHubRepoContext, filePath: string): Promise<GitHubFilePreview> {
    const normalizedPath = this.normalizePath(filePath);
    const branch = context.branch === 'HEAD' ? (await this.getRepoMetadata(context)).defaultBranch : context.branch;
    const resolvedContext = { ...context, branch };
    const cacheKey = `${resolvedContext.owner}/${resolvedContext.repo}:${branch}:${normalizedPath}`;
    const cached = this.getCached(this.previewCache, cacheKey);
    if (cached) {
      return cached;
    }

    const response = await this.makeJsonRequest(
      `/repos/${resolvedContext.owner}/${resolvedContext.repo}/contents/${this.encodePath(normalizedPath)}?ref=${encodeURIComponent(branch)}`
    );

    if (!this.isRecord(response)) {
      throw new Error('Unexpected GitHub file response');
    }

    const payload = response as GitHubFilePayload;
    const size = this.toNumberValue(payload.size);
    const htmlUrl = this.toStringValue(payload.html_url);
    const name = this.toStringValue(payload.name) || normalizedPath.split('/').pop() || normalizedPath;

    if (size > GitHubContentService.MAX_PREVIEW_BYTES) {
      const preview: GitHubFilePreview = {
        context: resolvedContext,
        path: normalizedPath,
        name,
        htmlUrl,
        languageHint: this.getLanguageHint(normalizedPath),
        content: '',
        truncated: true,
        tooLarge: true,
        isBinary: false
      };

      this.previewCache.set(cacheKey, { timestamp: Date.now(), value: preview });
      return preview;
    }

    const encoding = this.toStringValue(payload.encoding);
    if (encoding !== 'base64') {
      throw new Error('Unsupported GitHub file encoding');
    }

    const rawContent = this.toStringValue(payload.content).replace(/\n/g, '');
    const buffer = Buffer.from(rawContent, 'base64');
    const isBinary = this.looksBinary(buffer);
    const preview: GitHubFilePreview = {
      context: resolvedContext,
      path: normalizedPath,
      name,
      htmlUrl,
      languageHint: this.getLanguageHint(normalizedPath),
      content: isBinary ? '' : buffer.toString('utf8'),
      truncated: false,
      tooLarge: false,
      isBinary
    };

    this.previewCache.set(cacheKey, { timestamp: Date.now(), value: preview });
    return preview;
  }

  private normalizeDirectoryEntries(response: unknown): GitHubRepoEntry[] {
    if (!Array.isArray(response)) {
      throw new Error('Expected a directory listing from GitHub');
    }

    return response
      .map((entry) => this.normalizeDirectoryEntry(entry))
      .filter((entry): entry is GitHubRepoEntry => entry !== null);
  }

  private normalizeDirectoryEntry(entry: unknown): GitHubRepoEntry | null {
    if (!this.isRecord(entry)) {
      return null;
    }

    const payload = entry as GitHubContentsEntry;
    const type = this.toStringValue(payload.type);
    if (type !== 'file' && type !== 'dir') {
      return null;
    }

    const path = this.normalizePath(this.toStringValue(payload.path));
    const name = this.toStringValue(payload.name) || path.split('/').pop() || path;
    const htmlUrl = this.toStringValue(payload.html_url);

    return {
      name,
      path,
      type,
      size: this.toOptionalNumberValue(payload.size),
      downloadUrl: this.toStringValue(payload.download_url) || undefined,
      htmlUrl,
      sha: this.toStringValue(payload.sha) || undefined
    };
  }

  private async makeJsonRequest(endpoint: string): Promise<unknown> {
    const raw = await this.makeRequest(endpoint);
    return JSON.parse(raw) as unknown;
  }

  private makeRequest(endpoint: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const requestUrl = `${GitHubContentService.API_BASE}${endpoint}`;
      const request = https.request(
        requestUrl,
        {
          method: 'GET',
          headers: {
            'User-Agent': 'Skills-VSCode-Extension/1.0',
            'Accept': 'application/vnd.github+json'
          }
        },
        (response) => {
          let data = '';

          response.on('data', (chunk) => {
            data += chunk;
          });

          response.on('end', () => {
            if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
              resolve(data);
              return;
            }

            if (response.statusCode === 403) {
              reject(new Error('GitHub API rate limit reached. Try again later.'));
              return;
            }

            if (response.statusCode === 404) {
              reject(new Error('GitHub repository or path not found.'));
              return;
            }

            reject(new Error(`GitHub API error: ${response.statusCode ?? 'unknown'}`));
          });
        }
      );

      request.on('error', (error) => {
        logToOutput(`[GitHub] Request failed: ${error.message}`);
        reject(error);
      });

      request.end();
    });
  }

  private getCached<T>(cache: Map<string, CacheItem<T>>, key: string): T | null {
    const cached = cache.get(key);
    if (!cached) {
      return null;
    }

    if (Date.now() - cached.timestamp > GitHubContentService.CACHE_TTL_MS) {
      cache.delete(key);
      return null;
    }

    return cached.value;
  }

  private stripGitSuffix(value: string): string {
    return value.endsWith('.git') ? value.slice(0, -4) : value;
  }

  private normalizePath(value: string): string {
    return value.replace(/^\/+/, '').replace(/\/+$/, '');
  }

  private encodePath(value: string): string {
    return value.split('/').map((part) => encodeURIComponent(part)).join('/');
  }

  private looksBinary(buffer: Buffer): boolean {
    const sample = buffer.subarray(0, 512);
    for (const byte of sample) {
      if (byte === 0) {
        return true;
      }
    }

    return false;
  }

  private getLanguageHint(path: string): string {
    const extension = path.includes('.') ? path.split('.').pop()?.toLowerCase() ?? '' : '';

    switch (extension) {
      case 'ts':
      case 'tsx':
        return 'typescript';
      case 'js':
      case 'jsx':
      case 'mjs':
      case 'cjs':
        return 'javascript';
      case 'json':
        return 'json';
      case 'md':
        return 'markdown';
      case 'yml':
      case 'yaml':
        return 'yaml';
      case 'py':
        return 'python';
      case 'sh':
        return 'shell';
      default:
        return 'text';
    }
  }

  private isRecord(value: unknown): value is Record<string, any> {
    return typeof value === 'object' && value !== null;
  }

  private toStringValue(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    return '';
  }

  private toNumberValue(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    return 0;
  }

  private toOptionalNumberValue(value: unknown): number | undefined {
    const result = this.toNumberValue(value);
    return result > 0 ? result : undefined;
  }
}

export const gitHubContentService = new GitHubContentService();