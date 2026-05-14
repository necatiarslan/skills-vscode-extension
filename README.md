# AI Skills
![AI Skills](media/readme/main.png)

AI Skills is a VS Code extension focused on discovering, inspecting, and managing AI skills from the **[Skills Marketplace](https://skillsmp.com/)**.

## What It Does

- Search skills from [skillsmp.com](https://skillsmp.com/)
- View rich skill details in a dedicated panel
- Browse repository files for each skill
- Preview SKILL.md content when available
- Install and uninstall skills globally or per-workspace for the current host editor
- Track installed skills (managed and unmanaged) per tool in VS Code global storage
- View unmanaged skills discovered in non-standard installation locations

## Current UI Behavior

The sidebar contains four main sections:

- **Search**: Discover skills from the [Skills Marketplace](https://skillsmp.com/)
- **Global**: Installed skills found in global locations for the current host editor
  - *Managed skills* show colorful emojis, metadata, and uninstall options
  - *Unmanaged skills* appear with muted emojis and are discovered from non-standard installation paths
- **Workspace**: Installed skills found in workspace-scoped locations
  - Includes both managed and unmanaged skills for the current workspace
- **Recommended**: Featured skills from the marketplace


## Skill Detail Panel

Clicking a skill opens a full detail view with tabs:

- Skill: shows `SKILL.md` source content when present
- Details: metadata and marketplace/repository information
- Files: browse GitHub directory entries and preview text files

The Files view starts from the skill path when available.

## Installation Modes

Skills can be installed in two ways:

**Global Installation** (user home directory)
- Installs to the host editor's default extension/skills directory
- Available across all VS Code workspaces
- Targets:
  - VS Code: `~/.vscode/extensions`
  - Cursor: `~/.cursor/extensions`
  - Windsurf: `~/.windsurf/extensions`
  - Antigravity: `~/.antigravity/skills`

**Workspace Installation** (project-scoped)
- Installs to `.agents/skills/` in the current workspace root
- Available only within the specific workspace
- Allows team-specific or project-specific skills

## Managed vs Unmanaged Skills

**Managed Skills** are installed through the AI Skills extension marketplace:
- Tracked in VS Code global storage
- Show marketplace metadata (author, version, stars)
- Can be uninstalled directly from the UI

**Unmanaged Skills** are discovered from alternative installation locations:
- Not tracked in the official marketplace
- Displayed with muted styling for visual distinction
- Shown in the Global or Workspace section based on installation scope, with basic metadata
- Useful for locally developed, team-shared, or experimental skills

## Support & Feedback

- **Report Issues or Request Features**: Click the bug icon in the AI Skills panel or visit [GitHub Issues](https://github.com/necatiarslan/skills-vscode-extension/issues)
- **Support the Project**: [Become a Sponsor](https://github.com/sponsors/necatiarslan)

## Future Enhancements

- Full GitHub repository download and extraction for installed skills
- Enhanced unmanaged skill management (move to managed, delete, organize)
- Workspace recommendations based on project content
- Skill tagging and custom organization
- Integration with skill runtime engines