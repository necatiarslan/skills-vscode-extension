# DevDock Copilot Instructions

## Project Overview
DevDock is a VS Code extension that provides a personal dock in the sidebar for organizing developer shortcuts. It is built with TypeScript/Node.js on the VS Code Extension API.

Current feature set:
- folders for grouping items
- rich-text notes
- file links
- bash scripts
- bash file shortcuts
- VS Code command shortcuts

The extension no longer contains AWS service integrations. Any guidance that assumes AWS resources, credentials, SDK clients, or service-specific node trees is stale and should not be reintroduced unless explicitly requested.

**Key Architecture**: Extension activation -> session/bootstrap -> unified tree view -> node/event model -> persisted tree state

---

## Critical Architecture Patterns

### 1. Service Layer Pattern
Services are now minimal and generic.

- **ServiceBase** lives in [../src/tree/ServiceBase.ts](../src/tree/ServiceBase.ts) and provides `TreeSave()`.
- **ServiceHub** in [../src/tree/ServiceHub.ts](../src/tree/ServiceHub.ts) wires the active services during activation.
- Active services are:
  - `FileSystemService` for folders, notes, file links, bash scripts, and bash files
  - `VscodeService` for saved VS Code commands

**Example flow**: User clicks Add -> [../src/tree/TreeView.ts](../src/tree/TreeView.ts) shows supported item types -> delegates to `ServiceHub.Current.FileSystemService.Add(...)` or `ServiceHub.Current.VscodeService.Add(...)`.

### 2. Node Tree Hierarchy
All dock items extend [../src/tree/NodeBase.ts](../src/tree/NodeBase.ts), which extends `vscode.TreeItem`.

- Root nodes are stored in `NodeBase.RootNodes`
- Nodes maintain `Parent` and `Children[]`
- Nodes expose event emitters such as `OnNodeAdd`, `OnNodeEdit`, `OnNodeRun`, and `OnNodeRemove`
- Subclasses subscribe to those events in their constructors
- Serializable state is marked with `@Serialize()` and restored through `NodeRegistry`

Common current node types:
- `FolderNode`
- `NoteNode`
- `FileNode`
- `BashScriptNode`
- `BashFileNode`
- `CommandNode`

### 3. Persistence Pattern
The dock tree is persisted to VS Code `globalState`.

- [../src/tree/TreeState.ts](../src/tree/TreeState.ts) handles save/load with a debounce
- [../src/common/serialization/TreeSerializer.ts](../src/common/serialization/TreeSerializer.ts) serializes only `@Serialize()` properties
- [../src/common/serialization/NodeRegistry.ts](../src/common/serialization/NodeRegistry.ts) maps saved type names back to node constructors

**On activation** in [../src/extension.ts](../src/extension.ts):
1. Initialize `Session`
2. Initialize `ServiceHub`
3. Create `TreeView`
4. Load saved tree state
5. Refresh the tree

### 4. Webview Pattern
The main interactive webview currently is the note editor.

- [../src/filesystem/NoteView.ts](../src/filesystem/NoteView.ts) creates and manages a `WebviewPanel`
- Styles are loaded from [../media/notes/style.css](../media/notes/style.css)
- The editor uses Quill via CDN and persists changes by posting messages back to the extension

When adding new webviews:
- keep message passing explicit and minimal
- use `ui.getUri(...)` for local assets
- prefer small focused views over complex multi-purpose panels

---

## State Management

### Session State
[../src/common/Session.ts](../src/common/Session.ts) now stores generic UI state only:
- filter string
- show-only-favorites toggle
- show-hidden toggle
- extension URI and host metadata
- Pro license flag

Do not add AWS profile, region, endpoint, or credential logic back into `Session` unless the product scope changes deliberately.

### Tree Visibility Rules
Visibility is computed in [../src/tree/NodeBase.ts](../src/tree/NodeBase.ts) based on:
- favorite filter
- hidden filter
- workspace scoping
- free-text filter string

Nodes can also be scoped to the current workspace with the existing workspace context actions.

---

## Build, Test, and Development

### Build Commands
```bash
npm install
npm run compile
npm run watch
npm run lint
```

### TypeScript Scope
The build intentionally includes only the active DevDock code:
- `src/common/**`
- `src/filesystem/**`
- `src/tree/**`
- `src/vscode/**`
- `src/extension.ts`

If new features are added, update [../tsconfig.json](../tsconfig.json) intentionally rather than broadening the build by accident.

### Debugging
- Press F5 in VS Code to launch the extension in a debug window
- Logs go through `ui.logToOutput()` into DevDock output channels
- Tree behavior is easiest to inspect by following command registration in [../src/tree/TreeView.ts](../src/tree/TreeView.ts)

---

## Key Conventions

### Node Actions
Node actions are driven by event subscriptions, not deep inheritance overrides.

- Subscribe in the constructor
- Set icon, labels, and serializable properties there
- Call `this.SetContextValue()` after wiring supported actions
- Persist via `this.TreeSave()` after mutating serialized state

### Context Menu Visibility
Context menu actions are controlled by `contextValue` flags assembled in [../src/tree/NodeBase.ts](../src/tree/NodeBase.ts).

Examples:
- `#NodeAdd#`
- `#NodeEdit#`
- `#NodeRun#`
- `#SetTooltip#`
- `#ShowOnlyInThisWorkspace#`

If a new action should appear in the tree UI, update both:
- node `contextValue` generation
- `package.json` menu contributions

### Tree Refresh
- Use `this.RefreshTree()` after node changes
- Use `TreeState.save()` for persisted changes
- Use `TreeView.Current.Refresh()` for top-level UI refresh flows

### File and Note UX
- Notes are edited in the webview, not inline
- File and bash-file nodes should store absolute file paths
- VS Code command nodes should validate command IDs before saving

---

## File Organization Guide

| Directory | Purpose |
|-----------|---------|
| `src/tree/` | Tree UI, providers, node base, service hub, persistence |
| `src/common/` | Shared session, UI helpers, license, serialization, event emitter |
| `src/filesystem/` | Folder, note, file-link, bash-related nodes and services |
| `src/vscode/` | VS Code command service and node |
| `media/notes/` | Note webview styling |
| `media/` | Extension icons |

---

## Common Tasks

**Adding a new dock node type**
- Extend `NodeBase`
- Mark persisted properties with `@Serialize()`
- Subscribe to supported node events in the constructor
- Register the class in `NodeRegistry`
- Add the type to the add flow in [../src/tree/TreeView.ts](../src/tree/TreeView.ts)

**Adding a new item type to the Add menu**
- Update the quick-pick list in [../src/tree/TreeView.ts](../src/tree/TreeView.ts)
- Delegate creation to the appropriate service
- Ensure the node type participates in serialization if it should persist

**Changing what appears in the tree context menu**
- Update `SetContextValue()` in [../src/tree/NodeBase.ts](../src/tree/NodeBase.ts)
- Update `contributes.menus` in [../package.json](../package.json)

**Working on notes**
- Keep persistence in the extension host through `TreeState.save()`
- Keep editor rendering concerns in [../src/filesystem/NoteView.ts](../src/filesystem/NoteView.ts)

**Working on branding**
- Packaged extension icon: [../media/devdock-logo-extension.png](../media/devdock-logo-extension.png)
- Activity bar icon: [../media/devdock-logo-activitybar.svg](../media/devdock-logo-activitybar.svg)

---

## Guardrails

- Do not reintroduce AWS-specific dependencies, docs, commands, or architecture unless explicitly requested
- Keep changes aligned with the current DevDock scope
- Prefer small, focused node/service additions over reviving the old service-heavy structure
- Preserve serialization compatibility for existing dock items whenever practical
