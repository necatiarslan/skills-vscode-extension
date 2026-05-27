# 🚀 Hackathon Todo — Skills Hub Extension

> Port the existing AI Agent Skills VS Code extension to connect to a **local Skills Hub** via its own API instead of the public `skillsmp.com` marketplace.

---

## 👥 Team Assignment Suggestion

| Role | Focus Areas |
|------|-------------|
| **Person 1 — Backend / API** | API client, data models, install/uninstall flows, storage |
| **Person 2 — Frontend / UX** | Webview panels, UI components, settings, polish |

---

## Phase 1 — Foundation & API Layer ⚙️

> **IMPORTANT**
> This phase must be completed first — everything else depends on it.

### Person 1

- [ ] **Get Skills Hub API docs / spec** — collect all endpoint URLs, auth method, request/response shapes
- [ ] **Create `SkillsHubApiService.ts`** — new API client replacing `src/services/SkillsApiService.ts`
  - [ ] Switch from HTTPS (`skillsmp.com`) to local HTTP/HTTPS (e.g. `http://localhost:<port>/api/...`)
  - [ ] Update auth mechanism (replace the hardcoded Bearer API key)
  - [ ] Implement skill search endpoint
  - [ ] Implement skill detail endpoint
  - [ ] Implement recommended/featured skills endpoint (if available)
  - [ ] Keep caching layer (adapt `CachedSearchResult`, `CachedSkillDetail`)
- [ ] **Update data models** in `src/services/types/index.ts`
  - [ ] Update `Skill` interface to match Skills Hub API response shape
  - [ ] Update `SkillsApiResponse` to match new API response wrapper
  - [ ] Add any new types the Skills Hub API introduces
- [ ] **Update `normalizeSkill()`** to map Skills Hub fields → internal `Skill` model

### Person 2

- [ ] **Fork/clone the repo** into the company org
- [ ] **Rebrand `package.json`**:
  - [ ] Change `name`, `displayName`, `description`, `publisher`
  - [ ] Update `repository` URL
  - [ ] Update `icon` to company branding (create new icon assets)
- [ ] **Add extension settings** for Skills Hub connection in `package.json`:
  - [ ] `skillsHub.baseUrl` — URL of the local Skills Hub (default `http://localhost:PORT`)
  - [ ] `skillsHub.apiKey` or `skillsHub.authToken` — optional auth config
  - [ ] `skillsHub.autoConnect` — auto-connect on activation (boolean)
- [ ] **Create `SettingsService.ts`** — centralized settings reader using `vscode.workspace.getConfiguration()`

---

## Phase 2 — Install / Uninstall Flow 📦

### Person 1

- [ ] **Update `ToolInstallService.ts`** — `src/services/ToolInstallService.ts`
  - [ ] Determine: does Skills Hub provide its own download endpoint, or still use GitHub?
  - [ ] If Skills Hub has a download API → replace `downloadSkill()` to fetch from hub
  - [ ] If still GitHub → keep `GitHubContentService` but pull URL from Skills Hub metadata
  - [ ] Update `writeInstallMetadata()` to include hub-specific metadata (hub skill ID, version, etc.)
- [ ] **Update `SkillsStorageService.ts`** — `src/services/SkillsStorageService.ts`
  - [ ] Adapt `InstalledSkill` records to reference Skills Hub IDs instead of marketplace IDs
  - [ ] Add hub version tracking for update detection
- [ ] **Update check-for-updates flow** to query Skills Hub API for latest versions

### Person 2

- [ ] **Update install UI** in webview panels to reflect new source (Hub vs. Marketplace)
- [ ] **Update error messages** and loading states for local API connectivity
- [ ] **Add connection status indicator** in the sidebar (connected / disconnected / error)

---

## Phase 3 — Webview / UI Adaptation 🎨

### Person 2

- [ ] **Update `SkillsPanel.ts`** — `src/webview/SkillsPanel.ts`
  - [ ] Replace marketplace search calls with Skills Hub API calls
  - [ ] Update recommended skills section to pull from hub
  - [ ] Add connection status banner (hub reachable / unreachable)
  - [ ] Update branding: titles, labels, links
- [ ] **Update `SkillDetailPanel.ts`** — `src/webview/SkillDetailPanel.ts`
  - [ ] Adapt skill detail view to new data model
  - [ ] Update "Files" tab to work with hub-provided file listings (if applicable)
  - [ ] Update install buttons / actions
- [ ] **Update `SkillDetailUnManagedPanel.ts`** — `src/webview/SkillDetailUnManagedPanel.ts`
  - [ ] Same adaptations as detail panel for unmanaged skills
- [ ] **Update company branding** across all panels (logos, colors, footer links)

### Person 1

- [ ] **Update `GitHubContentService.ts`** — `src/services/GitHubContentService.ts`
  - [ ] Determine if still needed (depends on where skills are hosted)
  - [ ] If hub serves files directly → create `SkillsHubContentService.ts` as replacement
  - [ ] If hub still references GitHub → keep but make GitHub token configurable
- [ ] **Wire up `SettingsService`** in `src/extension.ts` activation

---

## Phase 4 — Extension Entry Point & Commands 🔌

### Person 1

- [ ] **Update `extension.ts`** — `src/extension.ts`
  - [ ] Read hub URL from settings on activation
  - [ ] Initialize `SkillsHubApiService` with configured URL
  - [ ] Add hub health check on activation (test connectivity)
  - [ ] Update daily update check to query Skills Hub
- [ ] **Update commands** in `package.json` and `extension.ts`:
  - [ ] Keep `Skills.Refresh` — wire to hub
  - [ ] Update `Skills.CheckForUpdates` — query hub for updates
  - [ ] Replace `Skills.Donate` / `Skills.BugAndNewFeatureRequest` with company-specific links (or remove)
  - [ ] Add `Skills.Configure` command — open settings for hub URL

### Person 2

- [ ] **Update `Session.ts`** — `src/common/Session.ts` if it carries marketplace-specific session state
- [ ] **Update `SkillLocationConfig.ts`** — `src/common/SkillLocationConfig.ts`
  - [ ] Review if agent locations need changes for company environment
  - [ ] Add/remove tool targets as needed for your company's supported agents

---

## Phase 5 — Testing & Polish ✅

### Both

- [ ] **Test local connectivity** — start Skills Hub locally, verify extension connects
- [ ] **Test search flow** — search skills from hub, verify results render correctly
- [ ] **Test install flow** — install a skill from hub, verify files land in correct location
- [ ] **Test uninstall flow** — uninstall a skill, verify cleanup
- [ ] **Test update detection** — modify a skill on hub, verify extension detects update
- [ ] **Test error handling** — hub down, bad auth, network issues → graceful errors
- [ ] **Test with multiple agents** — verify install paths for different host editors
- [ ] **Build VSIX** — `npm run compile` and package for distribution
- [ ] **Prepare demo** for hackathon presentation

---

## Phase 6 — Hackathon Demo Prep 🎬

### Both

- [ ] **Prepare a local Skills Hub** with sample skills loaded
- [ ] **Record a short demo video** or prepare live demo flow:
  1. Open VS Code → show extension in sidebar
  2. Search for a skill → show results from local hub
  3. View skill details → show metadata from hub
  4. Install skill → show files appear in correct location
  5. Show installed skills section → managed vs unmanaged
  6. Uninstall → clean removal
- [ ] **Write a brief README** for the new extension
- [ ] **Prepare 2-3 slides** covering: problem → solution → architecture → demo

---

## Key Architecture Decisions to Make Early 🤔

> **WARNING**
> Discuss these with your teammate before coding:

| # | Question | Impact |
|---|----------|--------|
| 1 | What protocol does the Skills Hub API use? (REST / gRPC / GraphQL) | Determines API client implementation |
| 2 | How does the hub serve skill files? (Direct download / Git URL / Archive) | Determines if `GitHubContentService` stays or gets replaced |
| 3 | What auth does the hub require? (API key / OAuth / None) | Determines settings & auth flow |
| 4 | Does the hub have its own versioning scheme? | Determines update-check logic |
| 5 | Should the extension work **offline** with cached hub data? | Determines caching strategy |
| 6 | Is the hub URL fixed or user-configurable? | Determines settings complexity |

---

## Quick Reference — Files to Modify

| File | Change Needed |
|------|---------------|
| `package.json` | Branding, settings contribution, commands |
| `src/extension.ts` | Hub init, health check, updated commands |
| `src/services/SkillsApiService.ts` | Replace with `SkillsHubApiService.ts` |
| `src/services/types/index.ts` | Update `Skill`, add hub types |
| `src/services/ToolInstallService.ts` | Download from hub, metadata updates |
| `src/services/SkillsStorageService.ts` | Hub ID tracking, version tracking |
| `src/services/GitHubContentService.ts` | Replace or adapt for hub |
| `src/webview/SkillsPanel.ts` | Search, recommended, branding |
| `src/webview/SkillDetailPanel.ts` | Detail view, files tab, install actions |
| `src/webview/SkillDetailUnManagedPanel.ts` | Unmanaged detail adaptations |
| `src/common/SkillLocationConfig.ts` | Agent locations for company env |
| `src/common/Session.ts` | Hub session state |
| **[NEW]** `src/services/SettingsService.ts` | Hub URL, auth, config reader |
| **[NEW]** `src/services/SkillsHubApiService.ts` | New API client for local hub |
