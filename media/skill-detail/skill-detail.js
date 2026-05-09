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
  window.addEventListener('message', (event) => handleExtensionMessage(event.data));
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
      console.log('Unknown message type:', message.type);
  }
}

function render() {
  if (!detail) {
    detailContainer.innerHTML = '<div class="empty-state">Unable to load skill details.</div>';
    return;
  }

  const skill = detail.skill;
  const repoMetadata = detail.repoMetadata;
  const tags = Array.isArray(skill.tags) ? skill.tags : [];

  detailContainer.innerHTML = `
    <section class="detail-shell">
      <header class="detail-hero">
        <div class="detail-hero-main">
          <div class="detail-badge">Skill</div>
          <h1 class="detail-title-large">${escapeHtml(skill.name)}</h1>
          <div class="detail-subtitle">
            <span>${escapeHtml(skill.author)}</span>
            <span>★ ${formatCompactNumber(repoMetadata.stargazersCount || skill.stars || 0)}</span>
            <span>${escapeHtml(relativeTime(repoMetadata.updatedAt || skill.updatedAt))}</span>
          </div>
          <p class="detail-description-large">${escapeHtml(skill.description || 'No description available.')}</p>
          <div class="detail-actions">
            ${isInstalled
              ? `<button class="btn-primary" type="button" onclick='requestUninstall(${JSON.stringify(skill.id)})'>Uninstall</button>`
              : `<button class="btn-primary" type="button" onclick='requestInstall(${JSON.stringify(skill.id)}, ${JSON.stringify(skill.name)}, ${JSON.stringify(skill.githubUrl)})'>Install</button>`}
            ${skill.githubUrl ? `<a class="btn-secondary" href="${escapeAttr(skill.githubUrl)}">Open on GitHub</a>` : ''}
          </div>
          ${tags.length > 0 ? `<div class="detail-tags">${tags.map((tag) => `<span class="tag-pill">${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
        </div>
        <aside class="detail-meta-card">
          ${renderMetaRow('Repository', repoMetadata.fullName)}
          ${renderMetaRow('Branch', detail.repoContext.branch)}
          ${renderMetaRow('Updated', relativeTime(repoMetadata.updatedAt || skill.updatedAt))}
          ${renderMetaRow('Forks', formatCompactNumber(repoMetadata.forksCount))}
          ${renderMetaRow('Issues', formatCompactNumber(repoMetadata.openIssuesCount))}
          ${renderMetaRow('License', repoMetadata.licenseName || 'Unknown')}
        </aside>
      </header>

      <div class="detail-content-grid">
        <main class="detail-main-card">
          <nav class="detail-tabs">
            <button class="detail-tab ${activeTab === 'details' ? 'active' : ''}" type="button" onclick="setDetailTab('details')">Details</button>
            <button class="detail-tab ${activeTab === 'files' ? 'active' : ''}" type="button" onclick="setDetailTab('files')">Files</button>
          </nav>
          <div class="detail-tab-panel">
            ${activeTab === 'details' ? renderDetailOverview() : renderFilesPanel()}
          </div>
        </main>
        <aside class="detail-side-card">
          <h2 class="side-title">Marketplace</h2>
          ${renderMetaRow('Skill ID', skill.id)}
          ${renderMetaRow('Published by', skill.author)}
          ${renderMetaRow('Marketplace URL', skill.skillUrl ? `<a href="${escapeAttr(skill.skillUrl)}">Open listing</a>` : 'Unavailable', true)}
          ${renderMetaRow('Source URL', skill.githubUrl ? `<a href="${escapeAttr(skill.githubUrl)}">Open repository</a>` : 'Unavailable', true)}
        </aside>
      </div>
    </section>
  `;
}

function renderDetailOverview() {
  const skill = detail.skill;
  const repoMetadata = detail.repoMetadata;

  return `
    <section class="overview-section">
      <h2>About This Skill</h2>
      <p>${escapeHtml(skill.description || 'No description available.')}</p>
    </section>
    <div class="overview-grid">
      <section class="overview-card">
        <h3>Repository</h3>
        <p>${escapeHtml(repoMetadata.description || 'No repository description available.')}</p>
      </section>
      <section class="overview-card">
        <h3>Skill Path</h3>
        <p>${escapeHtml(detail.repoContext.skillPath || 'Repository root')}</p>
      </section>
    </div>
  `;
}

function renderFilesPanel() {
  const entries = currentDirectory ? currentDirectory.entries : [];

  return `
    <div class="files-layout">
      <section class="files-browser-card">
        <div class="files-toolbar">
          <div class="files-breadcrumbs">${renderBreadcrumbs(currentDirectory ? currentDirectory.currentPath : '')}</div>
          <button class="btn-secondary" type="button" onclick="reloadCurrentDirectory()">Refresh</button>
        </div>
        <div class="files-list-panel">
          ${entries.length > 0 ? entries.map((entry) => renderRepoEntry(entry)).join('') : '<div class="files-empty">No files found.</div>'}
        </div>
      </section>
      <section class="preview-card">
        ${renderPreviewPanel()}
      </section>
    </div>
  `;
}

function renderRepoEntry(entry) {
  const icon = entry.type === 'dir' ? '▸' : '•';
  const action = entry.type === 'dir'
    ? `loadRepoPath(${JSON.stringify(entry.path)})`
    : `openRepoFile(${JSON.stringify(entry.path)})`;

  return `
    <button class="repo-entry ${entry.type}" type="button" onclick='${action}'>
      <span class="repo-entry-icon">${icon}</span>
      <span class="repo-entry-name">${escapeHtml(entry.name)}</span>
      <span class="repo-entry-meta">${entry.type === 'file' ? formatFileSize(entry.size) : 'Folder'}</span>
    </button>
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
        <a class="btn-secondary" href="${escapeAttr(currentPreview.htmlUrl)}">Open on GitHub</a>
      </div>
    `;
  }

  if (currentPreview.isBinary) {
    return `
      <div class="preview-empty">
        <h3>${escapeHtml(currentPreview.name)}</h3>
        <p>This file appears to be binary and cannot be previewed inline.</p>
        <a class="btn-secondary" href="${escapeAttr(currentPreview.htmlUrl)}">Open on GitHub</a>
      </div>
    `;
  }

  return `
    <div class="preview-header">
      <div>
        <h3>${escapeHtml(currentPreview.name)}</h3>
        <p>${escapeHtml(currentPreview.path)}</p>
      </div>
      <a class="btn-secondary" href="${escapeAttr(currentPreview.htmlUrl)}">Open on GitHub</a>
    </div>
    <pre class="code-preview"><code>${escapeHtml(currentPreview.content)}</code></pre>
  `;
}

function renderBreadcrumbs(path) {
  const segments = path ? path.split('/') : [];
  const crumbs = ['<button class="crumb" type="button" onclick="loadRepoPath(\'\')">root</button>'];
  let current = '';

  for (const segment of segments) {
    current = current ? `${current}/${segment}` : segment;
    crumbs.push('<span class="crumb-separator">/</span>');
    crumbs.push(`<button class="crumb" type="button" onclick='loadRepoPath(${JSON.stringify(current)})'>${escapeHtml(segment)}</button>`);
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

function setDetailTab(tabName) {
  activeTab = tabName;
  render();
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
  }, 3000);
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