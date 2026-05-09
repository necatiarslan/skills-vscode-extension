# Skills
![Skills](media/readme/main.png)

Skills is a lightweight VS Code extension for building a personal dock inside the sidebar.

It keeps frequently used items close at hand:

- **Folders** — group related items together
- **Notes** — rich-text editor for quick notes and instructions
- **File Links** — open any file directly from the dock
- **Bash Scripts** — run inline shell snippets with one click
- **Bash File Shortcuts** — run external shell scripts from the dock
- **VS Code Command Shortcuts** — trigger any VS Code command by ID
- **Web Links** — open URLs in the default browser; supports alias and copy-to-clipboard

---

## Getting Started

1. Open the **Skills** panel in the Activity Bar.
2. Click the **+** button to add an item.
3. Choose the item type from the quick-pick list.

---

## Item Types

### Folder
Group items under a label. Folders can be nested.

### Note
Write free-form rich-text notes using the built-in Quill editor. Notes are saved automatically.

### File Link
Save a path to any local file. Click **Open** to open it in VS Code.

### Bash Script
Paste a shell snippet inline. Click **Run** to execute it in the integrated terminal.

### Bash File Shortcut
Point to an existing `.sh` file on disk. Click **Run** to execute it.

### VS Code Command
Save a VS Code command ID (e.g. `workbench.action.reloadWindow`). Click **Run** to invoke it.

### Web Link
Save a URL with a human-readable alias.

| Action | Result |
|--------|--------|
| **View** (eye icon) | Opens the URL in the default browser |
| **Edit** (pencil icon) | Update the URL or alias |
| **Copy** (copy icon) | Copies the URL to the clipboard |
| **Remove** (trash icon) | Removes the link from the dock |

---

## AI Skills Marketplace

Discover and install reusable AI skills directly from the **Skills Marketplace**. 

### Accessing the Marketplace
- Click the **Extensions** icon in the Skills toolbar (next to Refresh)
- Or run the command: `Skills: Open Skills Marketplace`

### Searching for Skills
- Use the search box to find skills by name or keyword
- Results are fetched from [skillsmp.com](https://skillsmp.com) in real-time
- Results are cached for 5 minutes to improve performance
- Click any skill card to open a full details view inspired by the VS Code extension page

### Installing Skills
- Click the **Install** button on a skill card
- Skills are installed automatically for the current host editor running the extension
- Installed skills are tracked and can be uninstalled at any time

### Skill Details and GitHub Files
- Open a selected skill's details page directly from the search results
- Browse the skill repository from GitHub with folder navigation starting at the repository root
- Preview supported text files inline before opening them on GitHub
- Use the built-in **Files** tab to inspect repository contents without leaving VS Code

### Managing Installed Skills
- Installed skills are marked with a checkmark on their cards
- Click the **GitHub** action to visit the skill's repository
- Click **Uninstall** to remove a skill from the current host editor

---

## Common Actions

All item types support:

- **Alias** — give any item a custom display name
- **Favorite** — mark items to show in Favorites-only mode
- **Hide / Unhide** — keep items without removing them
- **Workspace scope** — restrict an item to the current workspace
- **Tooltip** — set a custom hover tooltip
- **Move Up / Move Down / Move to Folder** — reorder and reorganize items

---

## Toolbar

| Button | Action |
|--------|--------|
| `+` | Add a new item |
| Filter | Filter visible items by text |
| Bookmark | Toggle Favorites-only view |
| Eye | Toggle display of hidden items |
| Refresh | Reload the tree |

---

## Persistence

The dock state is saved to VS Code global storage and restored automatically on every launch. Items survive window reloads and VS Code restarts.

---

## Contributing

Bug reports and feature requests are welcome — use the **Bug and New Feature Request** option in the Skills toolbar menu.
