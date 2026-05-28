const vscode = acquireVsCodeApi();
const initialState = window.__SKILL_DETAIL_UNMANAGED_INITIAL_STATE__ || {};

let detail = initialState.detail || null;
let folderExists = initialState.folderExists !== false;
let installedLocalPath = initialState.installedLocalPath || '';
let currentDirectory = detail ? (detail.localInitialDirectory || detail.localRootDirectory || null) : null;
let currentPreview = detail ? (detail.localInitialPreview || null) : null;
let activeTab = 'skill';

let markdownIt = null;

const loadingIndicator = document.getElementById('loadingIndicator');
const errorMessage = document.getElementById('errorMessage');
const detailContainer = document.getElementById('detailContainer');

function initialize() {
  import('https://esm.sh/markdown-it@14.1.0').then((module) => {
    const MarkdownIt = module.default;
    markdownIt = new MarkdownIt({
      html: false,
      linkify: true,
      typographer: true,
      breaks: true
    });

    markdownIt.disable(['html', 'image']);

    render();
    detailContainer.addEventListener('change', handleDetailContainerChange);
    detailContainer.addEventListener('click', handleDetailContainerClick);
    window.addEventListener('message', (event) => handleExtensionMessage(event.data));
  }).catch((error) => {
    console.error('Failed to load markdown-it:', error);
    render();
    detailContainer.addEventListener('change', handleDetailContainerChange);
    detailContainer.addEventListener('click', handleDetailContainerClick);
    window.addEventListener('message', (event) => handleExtensionMessage(event.data));
  });
}

function handleDetailContainerClick(event) {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const actionElement = target.closest('[data-action]');
  if (!actionElement) {
    return;
  }

  event.preventDefault();
  const action = actionElement.getAttribute('data-action');
  const value = actionElement.getAttribute('data-value') || '';

  switch (action) {
    case 'load-local-path':
      loadLocalPath(value);
      break;
    case 'open-local-file':
      openLocalFile(value);
      break;
    case 'refresh-local-dir':
      reloadCurrentLocalDirectory();
      break;
    case 'open-installed-folder':
      openInstalledFolder();
      break;
    case 'uninstall':
      requestUninstall();
      break;
    default:
      break;
  }
}

function handleDetailContainerChange(event) {
  const tabs = event.target;
  if (!tabs || tabs.id !== 'detailTabs') {
    return;
  }

  const selectedIndex = Number(tabs.selectedIndex);
  const tabOrder = getTabOrder();
  activeTab = tabOrder[selectedIndex] || tabOrder[0] || 'skill';
}

function handleExtensionMessage(message) {
  switch (message.type) {
    case 'localDirectory':
      setLoading(false);
      if (message.error || !message.directory) {
        showError(`Failed to load local files: ${message.error || 'Unknown error'}`);
        return;
      }
      currentDirectory = message.directory;
      currentPreview = null;
      activeTab = 'local';
      render();
      break;
    case 'localFilePreview':
      setLoading(false);
      if (message.error || !message.preview) {
        showError(`Failed to open local file preview: ${message.error || 'Unknown error'}`);
        return;
      }
      currentPreview = message.preview;
      activeTab = 'local';
      render();
      break;
    case 'uninstallResult':
      setLoading(false);
      if (message.success) {
        folderExists = false;
        installedLocalPath = '';
        currentDirectory = null;
        currentPreview = null;
        showSuccess(`${message.skillId} uninstalled`);
        render();
      } else {
        showError(`Uninstallation failed: ${message.error}`);
      }
      break;
    case 'openFolderResult':
      if (!message.success) {
        showError(`Failed to open skill folder: ${message.error}`);
      }
      break;
    default:
      break;
  }
}

function render() {
  if (!detail) {
    detailContainer.innerHTML = '<div class="empty-state">Unable to load unmanaged skill details.</div>';
    return;
  }

  const skill = detail.skill;
  const skillEmoji = detail.skillEmoji || '✨';
  const tabOrder = getTabOrder();
  const selectedTabIndex = getSelectedTabIndex(tabOrder);

  detailContainer.innerHTML = `
    <section class="detail-page">
      <header class="extension-header">
        <div class="extension-icon">${skillEmoji}</div>
        <div class="extension-summary">
          <h1 class="extension-title">${escapeHtml(skill.name)}</h1>
          <p class="extension-publisher"></p>
          <p class="extension-description">Unmanaged Skill</p>
          <div class="extension-meta-inline"></div>
        </div>
      </header>

      <div class="extension-actions">
        <vscode-button class="btn-primary" data-action="uninstall" ${folderExists && installedLocalPath ? '' : 'disabled'}>Uninstall</vscode-button>
      </div>

      <vscode-divider role="separator"></vscode-divider>

      <vscode-tabs id="detailTabs" class="detail-tabs-shell" panel selected-index="${selectedTabIndex}">
        <vscode-tab-header slot="header">Skill</vscode-tab-header>
        <vscode-tab-panel>
          <main class="detail-main detail-main-skill">
            ${renderSkillSection()}
          </main>
        </vscode-tab-panel>

        <vscode-tab-header slot="header">Details</vscode-tab-header>
        <vscode-tab-panel>
          <main class="detail-main detail-main-skill">
            ${renderDetailsSection()}
          </main>
        </vscode-tab-panel>

        <vscode-tab-header slot="header">FILES</vscode-tab-header>
        <vscode-tab-panel>
          <main class="detail-main">
            ${renderLocalPanel()}
          </main>
        </vscode-tab-panel>
      </vscode-tabs>
    </section>
  `;
}

function getTabOrder() {
  return ['skill', 'details', 'local'];
}

function getSelectedTabIndex(tabOrder) {
  const selectedIndex = tabOrder.indexOf(activeTab);
  return selectedIndex >= 0 ? selectedIndex : 0;
}

function renderSkillSection() {
  return `
    <section class="detail-section detail-section-wide">
      ${renderSkillMarkdown()}
    </section>
  `;
}

function renderDetailsSection() {
  if (!detail) {
    return '';
  }
  const installDate = initialState.installDate || 'Unknown';
  return `
    <section class="detail-section detail-section-wide">
      ${renderMetaRow('Name', detail.skill.name)}
      ${renderMetaRow('Scope', detail.skill.scope || 'global')}
      ${renderMetaRow('Local Path', installedLocalPath || detail.skill.localPath || 'Unknown')}
      ${renderMetaRow('Install Date', installDate)}
    </section>
  `;
}
function formatDateTime(value) {
  if (!value) {
    return 'Unknown';
  }
  let timestamp = Number(value);
  if (Number.isNaN(timestamp)) {
    // Try parsing as ISO string
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value);
    }
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }
  if (timestamp < 10000000000) {
    timestamp *= 1000;
  }
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function renderSkillMarkdown() {
  if (!detail.skillMarkdown) {
    return '<div class="markdown-container"><p>No SKILL.md found for this unmanaged skill.</p></div>';
  }

  if (!markdownIt) {
    return '<div class="markdown-container"><p>Markdown renderer is loading...</p></div>';
  }

  try {
    const renderedHtml = markdownIt.render(detail.skillMarkdown);
    return `<div class="markdown-container">${renderedHtml}</div>`;
  } catch (error) {
    console.error('Error rendering markdown:', error);
    return '<div class="markdown-container"><p>Error rendering markdown content.</p></div>';
  }
}

function renderLocalPanel() {
  if (!folderExists || !installedLocalPath) {
    return '<section class="files-panel"><div class="files-empty">This unmanaged skill folder is no longer available.</div></section>';
  }

  const entries = currentDirectory ? currentDirectory.entries : [];

  return `
    <section class="files-panel">
      <div class="files-toolbar">
        <div class="files-breadcrumbs">${renderLocalBreadcrumbs(currentDirectory ? currentDirectory.currentPath : '')}</div>
        <div class="files-toolbar-actions">
          <vscode-button class="btn-secondary" data-action="open-installed-folder" ${folderExists && installedLocalPath ? '' : 'disabled'}>Open</vscode-button>
          <vscode-button class="btn-secondary" data-action="refresh-local-dir">Refresh</vscode-button>
        </div>
      </div>
      <div class="files-layout">
        <div class="files-browser">
          ${entries.length > 0 ? entries.map((entry) => renderLocalEntry(entry)).join('') : '<div class="files-empty">No files found.</div>'}
        </div>
        <div class="preview-panel">
          ${renderLocalPreviewPanel()}
        </div>
      </div>
    </section>
  `;
}

function renderLocalEntry(entry) {
  const action = entry.type === 'dir' ? 'load-local-path' : 'open-local-file';
  const iconSvg = entry.type === 'dir'
    ? '<svg aria-hidden="true" focusable="false" class="repo-entry-icon" viewBox="0 0 16 16" width="16" height="16" fill="currentColor" display="inline-block" overflow="visible" style="vertical-align:text-bottom"><path d="M1.75 1a.75.75 0 0 0-.75.75v12.5c0 .414.336.75.75.75h12.5a.75.75 0 0 0 .75-.75V4.5a.75.75 0 0 0-.75-.75h-6l-.75-.75H1.75Z"/></svg>'
    : '<svg aria-hidden="true" focusable="false" class="repo-entry-icon" viewBox="0 0 16 16" width="16" height="16" fill="currentColor" display="inline-block" overflow="visible" style="vertical-align:text-bottom"><path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 9 4.25V1.5Zm6.75.062V4.25c0 .138.112.25.25.25h2.688l-.011-.013-2.914-2.914-.013-.011Z"/></svg>';

  return `
    <a class="repo-entry ${entry.type}" href="#" data-action="${action}" data-value="${escapeAttr(entry.path)}">
      ${iconSvg}
      <span class="repo-entry-name">${escapeHtml(entry.name)}</span>
      <span class="repo-entry-meta">${entry.type === 'file' ? formatFileSize(entry.size) : 'Folder'}</span>
    </a>
  `;
}

function renderLocalPreviewPanel() {
  if (!currentPreview) {
    return `
      <div class="preview-empty">
        <h3>Select a file</h3>
        <p>Choose a local file to preview its contents.</p>
      </div>
    `;
  }

  if (currentPreview.tooLarge) {
    return `
      <div class="preview-empty">
        <h3>${escapeHtml(currentPreview.name)}</h3>
        <p>This file is too large to preview inline.</p>
      </div>
    `;
  }

  if (currentPreview.isBinary) {
    return `
      <div class="preview-empty">
        <h3>${escapeHtml(currentPreview.name)}</h3>
        <p>This file appears to be binary and cannot be previewed inline.</p>
      </div>
    `;
  }

  return `
    <div class="preview-header">
      <div>
        <h3>${escapeHtml(currentPreview.name)}</h3>
        <p>${escapeHtml(currentPreview.path)}</p>
      </div>
    </div>
    <pre class="code-preview"><code>${escapeHtml(currentPreview.content)}</code></pre>
  `;
}

function renderLocalBreadcrumbs(relativePath) {
  const segments = relativePath ? relativePath.split('/') : [];
  const crumbs = ['<a class="crumb" href="#" data-action="load-local-path" data-value="">root</a>'];
  let current = '';

  for (const segment of segments) {
    current = current ? `${current}/${segment}` : segment;
    crumbs.push('<span class="crumb-separator">/</span>');
    crumbs.push(`<a class="crumb" href="#" data-action="load-local-path" data-value="${escapeAttr(current)}">${escapeHtml(segment)}</a>`);
  }

  return crumbs.join('');
}

function renderMetaRow(label, value) {
  return `
    <div class="meta-row">
      <span class="meta-label">${escapeHtml(label)}</span>
      <span class="meta-value">${escapeHtml(value || '')}</span>
    </div>
  `;
}

function reloadCurrentLocalDirectory() {
  if (!currentDirectory) {
    loadLocalPath('');
    return;
  }

  loadLocalPath(currentDirectory.currentPath);
}

function loadLocalPath(localPath) {
  if (!folderExists || !installedLocalPath) {
    return;
  }

  setLoading(true);
  hideMessage();
  vscode.postMessage({ type: 'loadLocalPath', path: localPath });
}

function openLocalFile(localPath) {
  if (!folderExists || !installedLocalPath) {
    return;
  }

  setLoading(true);
  hideMessage();
  vscode.postMessage({ type: 'openLocalFile', path: localPath });
}

function openInstalledFolder() {
  vscode.postMessage({ type: 'openInstalledFolder' });
}

function requestUninstall() {
  setLoading(true);
  hideMessage();
  vscode.postMessage({ type: 'uninstall' });
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

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}