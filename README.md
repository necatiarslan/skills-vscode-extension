# Skills
![Skills](media/readme/main.png)

Skills is a VS Code extension focused on discovering, inspecting, and managing AI skills from the Skills Marketplace.

## What It Does

- Search skills from `skillsmp.com`
- View rich skill details in a dedicated panel
- Browse repository files for each skill
- Preview SKILL.md content when available
- Install and uninstall skills for the current host editor
- Track installed skills per tool in VS Code global storage

## Current UI Behavior

The sidebar contains three sections:

- Search
- Installed
- Recommended


## Skill Detail Panel

Clicking a skill opens a full detail view with tabs:

- Skill: shows `SKILL.md` source content when present
- Details: metadata and marketplace/repository information
- Files: browse GitHub directory entries and preview text files

The Files view starts from the skill path when available.

## Install Targets

The extension resolves the current host and installs per-tool:

- VS Code: `~/.vscode/extensions`
- Cursor: `~/.cursor/extensions`
- Windsurf: `~/.windsurf/extensions`
- Antigravity: `~/.antigravity/skills`

## Important Note About Installation

Current installation is MVP behavior:

- A local skill folder is created in the target tool directory
- A `skill.json` metadata file is written
- Full GitHub repository archive download/extraction is not implemented yet

## Future Enhancements
- test instlliation and uninstallation flows
- implement full repository download and extraction for installed skills
- list installed skills in the Installed section with uninstall buttons
- recommend by workspace content