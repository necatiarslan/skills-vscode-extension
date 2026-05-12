const vscode = acquireVsCodeApi();
const initialState = window.__SKILL_DETAIL_INITIAL_STATE__ || {};

let detail = initialState.detail || null;
let isInstalled = !!initialState.isInstalled;
let currentDirectory = detail ? detail.rootDirectory : null;
let currentPreview = null;
let activeTab = 'details';

const loadingIndicator = document.getElementById('loadingIndicator');
const errorMessage = document.getElementById('errorMessage');
const detailContainer = document.getElementById('detailContainer');

function initialize() {
  render();
  detailContainer.addEventListener('change', handleDetailContainerChange);
  window.addEventListener('message', (event) => handleExtensionMessage(event.data));
}

function handleDetailContainerChange(event) {
  const tabs = event.target;
  if (!tabs || tabs.id !== 'detailTabs') {
    return;
  }

  activeTab = Number(tabs.selectedIndex) === 1 ? 'files' : 'details';
}

function handleExtensionMessage(message) {
  switch (message.type) {
    case 'repoDirectory':
      setLoading(false);
      if (message.error || !message.directory) {
        showError(`Failed to load repository files: ${message.error || 'Unknown error'}`);
        return;
      }
      currentDirectory = message.directory;
      currentPreview = null;
      activeTab = 'files';
      render();
      break;
    case 'filePreview':
      setLoading(false);
      if (message.error || !message.preview) {
        showError(`Failed to open file preview: ${message.error || 'Unknown error'}`);
        return;
      }
      currentPreview = message.preview;
      activeTab = 'files';
      render();
      break;
    case 'installResult':
      setLoading(false);
      if (message.success) {
        isInstalled = true;
        showSuccess(`${message.skillId} installed`);
        render();
      } else {
        showError(`Installation failed: ${message.error}`);
      }
      break;
    case 'uninstallResult':
      setLoading(false);
      if (message.success) {
        isInstalled = false;
        showSuccess(`${message.skillId} uninstalled`);
        render();
      } else {
        showError(`Uninstallation failed: ${message.error}`);
      }
      break;
    default:
      break;
  }
}

function render() {
  if (!detail) {
    detailContainer.innerHTML = '<div class="empty-state">Unable to load skill details.</div>';
    return;
  }

  const skill = detail.skill;
  const repoMetadata = detail.repoMetadata;
  const tagList = Array.isArray(skill.tags) ? skill.tags : [];
  const stars = repoMetadata.stargazersCount || skill.stars || 0;

  detailContainer.innerHTML = `
    <section class="detail-page">
      <header class="extension-header">
        <div class="extension-icon">${escapeHtml((skill.name || '?').slice(0, 1).toUpperCase())}</div>
        <div class="extension-summary">
          <h1 class="extension-title">${escapeHtml(skill.name)}</h1>
          <p class="extension-publisher">${escapeHtml(skill.author)}</p>
          <p class="extension-description">${escapeHtml(skill.description || 'No description available.')}</p>
          <div class="extension-meta-inline">
            <vscode-badge variant="counter">${formatCompactNumber(stars)} stars</vscode-badge>
            <span>${escapeHtml(relativeTime(repoMetadata.updatedAt || skill.updatedAt))}</span>
            <span>${escapeHtml(repoMetadata.licenseName || 'No license')}</span>
          </div>
          ${tagList.length > 0 ? `<div class="extension-tags">${tagList.map((tag) => `<span class="tag-pill">${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
        </div>
        <div class="extension-actions">
          ${isInstalled
            ? `<vscode-button class="btn-primary" appearance="secondary" onclick='requestUninstall(${JSON.stringify(skill.id)})'>Disable</vscode-button>`
            : `<vscode-button class="btn-primary" appearance="primary" onclick='requestInstall(${JSON.stringify(skill.id)}, ${JSON.stringify(skill.name)}, ${JSON.stringify(skill.githubUrl)})'>Install</vscode-button>`}
          ${skill.githubUrl ? `<vscode-button class="btn-secondary" appearance="secondary" onclick='openExternal(${JSON.stringify(skill.githubUrl)})'>Repository</vscode-button>` : ''}
        </div>
      </header>

      <vscode-divider role="separator"></vscode-divider>

      <vscode-tabs id="detailTabs" class="detail-tabs-shell" panel selected-index="${activeTab === 'files' ? 1 : 0}">
        <vscode-tab-header slot="header">Details</vscode-tab-header>
        <vscode-tab-panel>
          <main class="detail-main">
            ${renderDetailOverview()}
          </main>
        </vscode-tab-panel>

        <vscode-tab-header slot="header">Files</vscode-tab-header>
        <vscode-tab-panel>
          <main class="detail-main">
            ${renderFilesPanel()}
          </main>
        </vscode-tab-panel>
      </vscode-tabs>
    </section>
  `;
}

function renderDetailOverview() {
  const skill = detail.skill;
  const repoMetadata = detail.repoMetadata;

  return `
    <section class="detail-section">
      <h2>Details</h2>
      ${renderMetaRow('Identifier', skill.id)}
      ${renderMetaRow('Version', '1.0.0')}
      ${renderMetaRow('Last Updated', relativeTime(repoMetadata.updatedAt || skill.updatedAt))}
      ${renderMetaRow('Size', 'N/A')}
    </section>

    <section class="detail-section">
      <h2>Marketplace</h2>
      ${renderMetaRow('Published', relativeTime(skill.updatedAt || repoMetadata.updatedAt))}
      ${renderMetaRow('Stars', formatCompactNumber(repoMetadata.stargazersCount || skill.stars || 0))}
      ${renderMetaRow('Forks', formatCompactNumber(repoMetadata.forksCount))}
      ${renderMetaRow('Open Issues', formatCompactNumber(repoMetadata.openIssuesCount))}
    </section>

    <section class="detail-section">
      <h2>Resources</h2>
      ${renderMetaRow('Repository', skill.githubUrl ? `<a href="${escapeAttr(skill.githubUrl)}">Open repository</a>` : 'Unavailable', true)}
      ${renderMetaRow('Marketplace URL', skill.skillUrl ? `<a href="${escapeAttr(skill.skillUrl)}">Open listing</a>` : 'Unavailable', true)}
      ${renderMetaRow('Skill Path', detail.repoContext.skillPath || 'Repository root')}
      ${renderMetaRow('Branch', detail.repoContext.branch)}
    </section>

    <section class="detail-section detail-section-wide">
      <h2>Repository Overview</h2>
      <p class="section-text">${escapeHtml(repoMetadata.description || 'No repository description available.')}</p>
    </section>
  `;
}

function renderFilesPanel() {
  const entries = currentDirectory ? currentDirectory.entries : [];

  return `
    <section class="files-panel">
      <div class="files-toolbar">
        <div class="files-breadcrumbs">${renderBreadcrumbs(currentDirectory ? currentDirectory.currentPath : '')}</div>
        <vscode-button class="btn-secondary" appearance="secondary" onclick="reloadCurrentDirectory()">Refresh</vscode-button>
      </div>
      <div class="files-layout">
        <div class="files-browser">
          ${entries.length > 0 ? entries.map((entry) => renderRepoEntry(entry)).join('') : '<div class="files-empty">No files found.</div>'}
        </div>
        <div class="preview-panel">
          ${renderPreviewPanel()}
        </div>
      </div>
    </section>
  `;
}

function renderRepoEntry(entry) {
  const iconName = entry.type === 'dir' ? 'folder' : 'file';
  const action = entry.type === 'dir'
    ? `loadRepoPath(${JSON.stringify(entry.path)})`
    : `openRepoFile(${JSON.stringify(entry.path)})`;

  return `
    <a class="repo-entry ${entry.type}" href="#" onclick="event.preventDefault(); ${action}">
      <vscode-icon class="repo-entry-icon" name="${iconName}"></vscode-icon>
      <span class="repo-entry-name">${escapeHtml(entry.name)}</span>
      <span class="repo-entry-meta">${entry.type === 'file' ? formatFileSize(entry.size) : 'Folder'}</span>
    </a>
  `;
}

function renderPreviewPanel() {
  if (!currentPreview) {
    return `
      <div class="preview-empty">
        <h3>Select a file</h3>
        <p>Choose a file from the repository to preview its contents.</p>
      </div>
    `;
  }

  if (currentPreview.tooLarge) {
    return `
      <div class="preview-empty">
        <h3>${escapeHtml(currentPreview.name)}</h3>
        <p>This file is too large to preview inline.</p>
        <vscode-button class="btn-secondary" appearance="secondary" onclick='openExternal(${JSON.stringify(currentPreview.htmlUrl)})'>Open on GitHub</vscode-button>
      </div>
    `;
  }

  if (currentPreview.isBinary) {
    return `
      <div class="preview-empty">
        <h3>${escapeHtml(currentPreview.name)}</h3>
        <p>This file appears to be binary and cannot be previewed inline.</p>
        <vscode-button class="btn-secondary" appearance="secondary" onclick='openExternal(${JSON.stringify(currentPreview.htmlUrl)})'>Open on GitHub</vscode-button>
      </div>
    `;
  }

  return `
    <div class="preview-header">
      <div>
        <h3>${escapeHtml(currentPreview.name)}</h3>
        <p>${escapeHtml(currentPreview.path)}</p>
      </div>
      <vscode-button class="btn-secondary" appearance="secondary" onclick='openExternal(${JSON.stringify(currentPreview.htmlUrl)})'>Open on GitHub</vscode-button>
    </div>
    <pre class="code-preview"><code>${escapeHtml(currentPreview.content)}</code></pre>
  `;
}

function renderBreadcrumbs(path) {
  const segments = path ? path.split('/') : [];
  const crumbs = ['<a class="crumb" href="#" onclick="event.preventDefault(); loadRepoPath(\'\'")>root</a>'];
  let current = '';

  for (const segment of segments) {
    current = current ? `${current}/${segment}` : segment;
    crumbs.push('<span class="crumb-separator">/</span>');
    crumbs.push(`<a class="crumb" href="#" onclick="event.preventDefault(); loadRepoPath(${JSON.stringify(current)})">${escapeHtml(segment)}</a>`);
  }

  return crumbs.join('');
}

function renderMetaRow(label, value, isHtml) {
  return `
    <div class="meta-row">
      <span class="meta-label">${escapeHtml(label)}</span>
      <span class="meta-value">${isHtml ? value : escapeHtml(value || 'Unknown')}</span>
    </div>
  `;
}

function reloadCurrentDirectory() {
  if (!currentDirectory) {
    return;
  }

  loadRepoPath(currentDirectory.currentPath);
}

function loadRepoPath(path) {
  setLoading(true);
  hideMessage();
  vscode.postMessage({ type: 'loadRepoPath', context: detail.repoContext, path });
}

function openRepoFile(path) {
  setLoading(true);
  hideMessage();
  vscode.postMessage({ type: 'openRepoFile', context: detail.repoContext, path });
}

function requestInstall(skillId, skillName, githubUrl) {
  setLoading(true);
  hideMessage();
  vscode.postMessage({ type: 'install', skillId, skillName, githubUrl });
}

function requestUninstall(skillId) {
  setLoading(true);
  hideMessage();
  vscode.postMessage({ type: 'uninstall', skillId });
}

function openExternal(url) {
  if (!url) {
    return;
  }

  window.open(url, '_blank');
}

function setLoading(isLoading) {
  loadingIndicator.classList.toggle('hidden', !isLoading);
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.remove('hidden');
}

function showSuccess(message) {
  errorMessage.textContent = `✓ ${message}`;
  errorMessage.classList.remove('hidden');
  setTimeout(() => {
    errorMessage.classList.add('hidden');
  }, 2500);
}

function hideMessage() {
  errorMessage.classList.add('hidden');
}

function formatCompactNumber(value) {
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value || 0);
}

function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) {
    return 'File';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function relativeTime(value) {
  if (!value) {
    return 'Unknown';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  const diff = Date.now() - date.getTime();
  const intervals = [
    ['year', 365 * 24 * 60 * 60 * 1000],
    ['month', 30 * 24 * 60 * 60 * 1000],
    ['day', 24 * 60 * 60 * 1000],
    ['hour', 60 * 60 * 1000],
    ['minute', 60 * 1000]
  ];

  for (const [label, size] of intervals) {
    const amount = Math.floor(diff / size);
    if (amount >= 1) {
      return `${amount} ${label}${amount === 1 ? '' : 's'} ago`;
    }
  }

  return 'Just now';
}

function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#039;';
      default:
        return char;
    }
  });
}

function escapeAttr(text) {
  return escapeHtml(text);
}

initialize();
