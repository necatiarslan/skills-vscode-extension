const vscode = acquireVsCodeApi();
const initialState = window.__SKILL_DETAIL_INITIAL_STATE__ || {};

let detail = initialState.detail || null;
let isInstalled = !!initialState.isInstalled;
let installedLocalPath = initialState.installedLocalPath || '';
let currentDirectory = detail ? (detail.initialDirectory || detail.rootDirectory) : null;
let currentPreview = detail ? (detail.initialPreview || null) : null;
let localDirectory = detail ? (detail.localInitialDirectory || detail.localRootDirectory || null) : null;
let localPreview = detail ? (detail.localInitialPreview || null) : null;
let activeTab = detail && detail.skillMarkdown ? 'skill' : 'details';

let markdownIt = null;

const loadingIndicator = document.getElementById('loadingIndicator');
const errorMessage = document.getElementById('errorMessage');
const detailContainer = document.getElementById('detailContainer');

function initialize() {
  // Import and initialize markdown-it
  import('https://esm.sh/markdown-it@14.1.0').then((module) => {
    const MarkdownIt = module.default;
    markdownIt = new MarkdownIt({
      html: false,
      linkify: true,
      typographer: true,
      breaks: true
    });
    
    // Add security: disable dangerous HTML and script tags
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
    case 'load-path':
      loadRepoPath(value);
      break;
    case 'open-file':
      openRepoFile(value);
      break;
    case 'load-local-path':
      loadLocalPath(actionElement.getAttribute('data-skill-id') || '', value);
      break;
    case 'open-local-file':
      openLocalFile(actionElement.getAttribute('data-skill-id') || '', value);
      break;
    case 'install':
      requestInstall(
        actionElement.getAttribute('data-skill-id') || '',
        actionElement.getAttribute('data-skill-name') || '',
        actionElement.getAttribute('data-github-url') || ''
      );
      break;
    case 'install-workspace':
      requestInstallWorkspace(
        actionElement.getAttribute('data-skill-id') || '',
        actionElement.getAttribute('data-skill-name') || '',
        actionElement.getAttribute('data-github-url') || ''
      );
      break;
    case 'uninstall':
      requestUninstall(actionElement.getAttribute('data-skill-id') || '');
      break;
    case 'refresh-dir':
      reloadCurrentDirectory();
      break;
    case 'refresh-local-dir':
      reloadCurrentLocalDirectory(actionElement.getAttribute('data-skill-id') || '');
      break;
    case 'open-external':
      openExternal(value);
      break;
    case 'open-installed-folder':
      openInstalledFolder(actionElement.getAttribute('data-skill-id') || '', value);
      break;
    case 'update':
      requestUpdate(
        actionElement.getAttribute('data-skill-id') || '',
        actionElement.getAttribute('data-skill-name') || '',
        actionElement.getAttribute('data-github-url') || ''
      );
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
  activeTab = tabOrder[selectedIndex] || tabOrder[0] || 'details';
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
      activeTab = 'repository';
      render();
      break;
    case 'filePreview':
      setLoading(false);
      if (message.error || !message.preview) {
        showError(`Failed to open file preview: ${message.error || 'Unknown error'}`);
        return;
      }
      currentPreview = message.preview;
      activeTab = 'repository';
      render();
      break;
    case 'localDirectory':
      setLoading(false);
      if (message.error || !message.directory) {
        showError(`Failed to load local files: ${message.error || 'Unknown error'}`);
        return;
      }
      localDirectory = message.directory;
      localPreview = null;
      activeTab = 'local';
      render();
      break;
    case 'localFilePreview':
      setLoading(false);
      if (message.error || !message.preview) {
        showError(`Failed to open local file preview: ${message.error || 'Unknown error'}`);
        return;
      }
      localPreview = message.preview;
      activeTab = 'local';
      render();
      break;
    case 'installResult':
      setLoading(false);
      if (message.success) {
        isInstalled = true;
        installedLocalPath = message.localPath || installedLocalPath;
        if (message.localSkillMarkdown) {
          detail.skillMarkdown = message.localSkillMarkdown;
        }
        if (message.localRootDirectory) {
          localDirectory = message.localRootDirectory;
          localPreview = null;
        }
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
        installedLocalPath = '';
        localDirectory = null;
        localPreview = null;
        showSuccess(`${message.skillId} uninstalled`);
        render();
      } else {
        showError(`Uninstallation failed: ${message.error}`);
      }
      break;
    case 'updateResult':
      setLoading(false);
      if (message.success) {
        isInstalled = true;
        installedLocalPath = message.localPath || installedLocalPath;
        if (message.localSkillMarkdown) {
          detail.skillMarkdown = message.localSkillMarkdown;
        }
        if (message.localRootDirectory) {
          localDirectory = message.localRootDirectory;
          localPreview = null;
        }
        // Reset repository browser state
        currentDirectory = null;
        currentPreview = null;
        // Switch to local files tab to show updated files
        activeTab = 'local';
        showSuccess(`${message.skillId} updated`);
        render();
      } else {
        showError(`Update failed: ${message.error}`);
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
  const skillEmoji = detail.skillEmoji || '✨';
  const repositoryRoot = skill.githubUrl ? skill.githubUrl.split('/').slice(0, 5).join('/') : '';
  const sourceLinkMarkup = skill.githubUrl
    ? `<span class="source-link">Source : <a href="#" data-action="open-external" data-value="${escapeAttr(skill.githubUrl)}">${escapeHtml(repositoryRoot)}</a></span>`
    : '';
  const tabOrder = getTabOrder();
  const selectedTabIndex = getSelectedTabIndex(tabOrder);

  detailContainer.innerHTML = `
    <section class="detail-page">
      <header class="extension-header">
        <div class="extension-icon">${skillEmoji}</div>
        <div class="extension-summary">
          <h1 class="extension-title">${escapeHtml(skill.name)}</h1>
          <p class="extension-publisher">${escapeHtml(skill.author)} &nbsp; | &nbsp; ⭐ ${formatCompactNumber(stars)} </p>
          <p class="extension-description">${escapeHtml(skill.description || 'No description available.')}</p>
          <div class="extension-meta-inline"></div>
          ${tagList.length > 0 ? `<div class="extension-tags">${tagList.map((tag) => `<span class="tag-pill">${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
        </div>
        <div class="extension-actions">
          ${isInstalled
            ? `
              <vscode-button class="btn-primary" data-action="uninstall" data-skill-id="${escapeAttr(skill.id)}">Uninstall</vscode-button>
              <vscode-button class="btn-secondary" data-action="update" data-skill-id="${escapeAttr(skill.id)}" data-skill-name="${escapeAttr(skill.name)}" data-github-url="${escapeAttr(skill.githubUrl)}" ${installedLocalPath ? '' : 'disabled'}>Update</vscode-button>
              ${sourceLinkMarkup}
            `
            : `
              <vscode-button class="btn-primary" data-action="install" data-skill-id="${escapeAttr(skill.id)}" data-skill-name="${escapeAttr(skill.name)}" data-github-url="${escapeAttr(skill.githubUrl)}">Install Global</vscode-button>
              <div class="workspace-install-row">
                <vscode-button class="btn-secondary" data-action="install-workspace" data-skill-id="${escapeAttr(skill.id)}" data-skill-name="${escapeAttr(skill.name)}" data-github-url="${escapeAttr(skill.githubUrl)}">Install Workspace</vscode-button>
              </div>
              ${sourceLinkMarkup}
            `}
        </div>
      </header>

      <vscode-divider role="separator"></vscode-divider>

      <vscode-tabs id="detailTabs" class="detail-tabs-shell" panel selected-index="${selectedTabIndex}">
        ${detail.skillMarkdown ? `
        <vscode-tab-header slot="header">Skill</vscode-tab-header>
        <vscode-tab-panel>
          <main class="detail-main detail-main-skill">
            ${renderSkillMarkdown()}
          </main>
        </vscode-tab-panel>
        ` : ''}

        <vscode-tab-header slot="header">Details</vscode-tab-header>
        <vscode-tab-panel>
          <main class="detail-main">
            ${renderDetailOverview()}
          </main>
        </vscode-tab-panel>

        ${isInstalled ? `
        <vscode-tab-header slot="header">FILES</vscode-tab-header>
        <vscode-tab-panel>
          <main class="detail-main">
            ${renderLocalPanel()}
          </main>
        </vscode-tab-panel>
        ` : ''}

        <vscode-tab-header slot="header">Repository</vscode-tab-header>
        <vscode-tab-panel>
          <main class="detail-main">
            ${renderFilesPanel()}
          </main>
        </vscode-tab-panel>
      </vscode-tabs>
    </section>
  `;
}

function getTabOrder() {
  const tabOrder = [];

  if (detail && detail.skillMarkdown) {
    tabOrder.push('skill');
  }

  tabOrder.push('details');

  if (isInstalled) {
    tabOrder.push('local');
  }

  tabOrder.push('repository');

  return tabOrder;
}

function getSelectedTabIndex(tabOrder) {
  const selectedIndex = tabOrder.indexOf(activeTab);
  return selectedIndex >= 0 ? selectedIndex : 0;
}

function renderSkillMarkdown() {
  if (!detail.skillMarkdown) {
    return '<div class="markdown-container">No SKILL.md found.</div>';
  }

  if (!markdownIt) {
    return '<div class="markdown-container"><p>Markdown renderer is loading...</p></div>';
  }

  try {
    const renderedHtml = markdownIt.render(detail.skillMarkdown);
    return `<div class="markdown-container">${renderedHtml}</div>`;
  } catch (error) {
    console.error('Error rendering markdown:', error);
    return `<div class="markdown-container"><p>Error rendering markdown content.</p></div>`;
  }
}

function renderDetailOverview() {
  const skill = detail.skill;
  const repoMetadata = detail.repoMetadata;
  const repositoryRoot = skill.githubUrl ? skill.githubUrl.split('/').slice(0, 5).join('/') : null;
  const repositoryLink = repositoryRoot
    ? `<a href="#" data-action="open-external" data-value="${escapeAttr(skill.githubUrl)}">${escapeHtml(repositoryRoot)}</a>`
    : 'Unavailable';
  const marketplaceLink = skill.skillUrl
    ? `<a href="#" data-action="open-external" data-value="${escapeAttr(skill.skillUrl)}">${escapeHtml(skill.skillUrl)}</a>`
    : 'Unavailable';

  return `
    <section class="detail-section">
      <h2>Details</h2>
      ${renderMetaRow('Identifier', skill.id)}
      ${renderMetaRow('Version', '1.0.0')}
      ${renderMetaRow('Last Updated', relativeTime(repoMetadata.updatedAt || skill.updatedAt))}
    </section>

    ${isInstalled ? `
    <section class="detail-section">
      <h2>Installation</h2>
      ${renderMetaRow('Tool', initialState.currentToolDisplayName || 'Current Tool')}
      ${renderMetaRow('Local Path', installedLocalPath || 'Unknown')}
      ${renderMetaRow('Install Date', initialState.installDate || 'Unknown')}
    </section>
    ` : ''}

    <section class="detail-section">
      <h2>Github</h2>
      ${renderMetaRow('Repository', repositoryLink, true)}
      ${renderMetaRow('Skill Path', detail.repoContext.skillPath || 'Repository root')}
      ${renderMetaRow('Branch', detail.repoContext.branch)}
    </section>

    <section class="detail-section">
      <h2>Marketplace</h2>
      ${renderMetaRow('Published', formatDateTime(skill.updatedAt || repoMetadata.updatedAt))}
      ${renderMetaRow('Stars', formatCompactNumber(repoMetadata.stargazersCount || skill.stars || 0))}
      ${renderMetaRow('Forks', formatCompactNumber(repoMetadata.forksCount))}
      ${renderMetaRow('Open Issues', formatCompactNumber(repoMetadata.openIssuesCount))}
      ${renderMetaRow('Listing URL', marketplaceLink, true)}
    </section>
  `;
}

function renderFilesPanel() {
  const entries = currentDirectory ? currentDirectory.entries : [];

  return `
    <section class="files-panel">
      <div class="files-toolbar">
        <div class="files-breadcrumbs">${renderBreadcrumbs(currentDirectory ? currentDirectory.currentPath : '')}</div>
        <div class="files-toolbar-actions">
          ${detail.skill.githubUrl ? `<vscode-button class="btn-secondary"  data-action="open-external" data-value="${escapeAttr(detail.skill.githubUrl)}">Open</vscode-button>` : ''}
          <vscode-button class="btn-secondary"  data-action="refresh-dir">Refresh</vscode-button>
        </div>
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

function renderLocalPanel() {
  if (!isInstalled || !installedLocalPath) {
    return '<section class="files-panel"><div class="files-empty">This skill is not installed locally.</div></section>';
  }

  const entries = localDirectory ? localDirectory.entries : [];

  return `
    <section class="files-panel">
      <div class="files-toolbar">
        <div class="files-breadcrumbs">${renderLocalBreadcrumbs(localDirectory ? localDirectory.currentPath : '', detail.skill.id)}</div>
        <div class="files-toolbar-actions">
          <vscode-button class="btn-secondary"  data-action="open-installed-folder" data-skill-id="${escapeAttr(detail.skill.id)}" data-value="${escapeAttr(installedLocalPath)}">Open</vscode-button>
          <vscode-button class="btn-secondary"  data-action="refresh-local-dir" data-skill-id="${escapeAttr(detail.skill.id)}">Refresh</vscode-button>
        </div>
      </div>
      <div class="files-layout">
        <div class="files-browser">
          ${entries.length > 0 ? entries.map((entry) => renderLocalEntry(entry, detail.skill.id)).join('') : '<div class="files-empty">No files found.</div>'}
        </div>
        <div class="preview-panel">
          ${renderLocalPreviewPanel()}
        </div>
      </div>
    </section>
  `;
}

function renderInstalledPanel() {
  const skill = detail.skill;
  const installDate = initialState.installDate || 'Unknown';

  return `
    <section class="detail-section detail-section-wide">
      ${renderMetaRow('Tool', initialState.currentToolDisplayName || 'Current Tool')}
      ${renderMetaRow('Local Path', installedLocalPath || 'Unknown')}
      ${renderMetaRow('Install Date', installDate)}
    </section>
  `;
}

function renderRepoEntry(entry) {
  const action = entry.type === 'dir' ? 'load-path' : 'open-file';
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

function renderLocalEntry(entry, skillId) {
  const action = entry.type === 'dir' ? 'load-local-path' : 'open-local-file';
  const iconSvg = entry.type === 'dir'
    ? '<svg aria-hidden="true" focusable="false" class="repo-entry-icon" viewBox="0 0 16 16" width="16" height="16" fill="currentColor" display="inline-block" overflow="visible" style="vertical-align:text-bottom"><path d="M1.75 1a.75.75 0 0 0-.75.75v12.5c0 .414.336.75.75.75h12.5a.75.75 0 0 0 .75-.75V4.5a.75.75 0 0 0-.75-.75h-6l-.75-.75H1.75Z"/></svg>'
    : '<svg aria-hidden="true" focusable="false" class="repo-entry-icon" viewBox="0 0 16 16" width="16" height="16" fill="currentColor" display="inline-block" overflow="visible" style="vertical-align:text-bottom"><path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 9 4.25V1.5Zm6.75.062V4.25c0 .138.112.25.25.25h2.688l-.011-.013-2.914-2.914-.013-.011Z"/></svg>';

  return `
    <a class="repo-entry ${entry.type}" href="#" data-action="${action}" data-skill-id="${escapeAttr(skillId)}" data-value="${escapeAttr(entry.path)}">
      ${iconSvg}
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
        <vscode-button class="btn-secondary"  data-action="open-external" data-value="${escapeAttr(currentPreview.htmlUrl)}">Open on GitHub</vscode-button>
      </div>
    `;
  }

  if (currentPreview.isBinary) {
    return `
      <div class="preview-empty">
        <h3>${escapeHtml(currentPreview.name)}</h3>
        <p>This file appears to be binary and cannot be previewed inline.</p>
        <vscode-button class="btn-secondary"  data-action="open-external" data-value="${escapeAttr(currentPreview.htmlUrl)}">Open on GitHub</vscode-button>
      </div>
    `;
  }

  return `
    <div class="preview-header">
      <div>
        <h3>${escapeHtml(currentPreview.name)}</h3>
        <p>${escapeHtml(currentPreview.path)}</p>
      </div>
      <vscode-button class="btn-secondary"  data-action="open-external" data-value="${escapeAttr(currentPreview.htmlUrl)}">Open on GitHub</vscode-button>
    </div>
    <pre class="code-preview"><code>${escapeHtml(currentPreview.content)}</code></pre>
  `;
}

function renderLocalPreviewPanel() {
  if (!localPreview) {
    return `
      <div class="preview-empty">
        <h3>Select a file</h3>
        <p>Choose a local file to preview its contents.</p>
      </div>
    `;
  }

  if (localPreview.tooLarge) {
    return `
      <div class="preview-empty">
        <h3>${escapeHtml(localPreview.name)}</h3>
        <p>This file is too large to preview inline.</p>
      </div>
    `;
  }

  if (localPreview.isBinary) {
    return `
      <div class="preview-empty">
        <h3>${escapeHtml(localPreview.name)}</h3>
        <p>This file appears to be binary and cannot be previewed inline.</p>
      </div>
    `;
  }

  return `
    <div class="preview-header">
      <div>
        <h3>${escapeHtml(localPreview.name)}</h3>
        <p>${escapeHtml(localPreview.path)}</p>
      </div>
    </div>
    <pre class="code-preview"><code>${escapeHtml(localPreview.content)}</code></pre>
  `;
}

function renderBreadcrumbs(path) {
  const segments = path ? path.split('/') : [];
  const crumbs = ['<a class="crumb" href="#" data-action="load-path" data-value="">root</a>'];
  let current = '';

  for (const segment of segments) {
    current = current ? `${current}/${segment}` : segment;
    crumbs.push('<span class="crumb-separator">/</span>');
    crumbs.push(`<a class="crumb" href="#" data-action="load-path" data-value="${escapeAttr(current)}">${escapeHtml(segment)}</a>`);
  }

  return crumbs.join('');
}

function renderLocalBreadcrumbs(path, skillId) {
  const segments = path ? path.split('/') : [];
  const crumbs = [`<a class="crumb" href="#" data-action="load-local-path" data-skill-id="${escapeAttr(skillId)}" data-value="">root</a>`];
  let current = '';

  for (const segment of segments) {
    current = current ? `${current}/${segment}` : segment;
    crumbs.push('<span class="crumb-separator">/</span>');
    crumbs.push(`<a class="crumb" href="#" data-action="load-local-path" data-skill-id="${escapeAttr(skillId)}" data-value="${escapeAttr(current)}">${escapeHtml(segment)}</a>`);
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

function reloadCurrentLocalDirectory(skillId) {
  if (!localDirectory) {
    loadLocalPath(skillId, '');
    return;
  }

  loadLocalPath(skillId, localDirectory.currentPath);
}

function loadRepoPath(path) {
  setLoading(true);
  hideMessage();
  vscode.postMessage({ type: 'loadRepoPath', context: detail.repoContext, path });
}

function loadLocalPath(skillId, localPath) {
  if (!skillId) {
    return;
  }

  setLoading(true);
  hideMessage();
  vscode.postMessage({ type: 'loadLocalPath', skillId, path: localPath });
}

function openRepoFile(path) {
  setLoading(true);
  hideMessage();
  vscode.postMessage({ type: 'openRepoFile', context: detail.repoContext, path });
}

function openLocalFile(skillId, localPath) {
  if (!skillId) {
    return;
  }

  setLoading(true);
  hideMessage();
  vscode.postMessage({ type: 'openLocalFile', skillId, path: localPath });
}

function requestInstall(skillId, skillName, githubUrl) {
  setLoading(true);
  hideMessage();
  vscode.postMessage({ type: 'install', skillId, skillName, githubUrl });
}

function requestInstallWorkspace(skillId, skillName, githubUrl) {
  setLoading(true);
  hideMessage();
  vscode.postMessage({ type: 'installWorkspace', skillId, skillName, githubUrl });
}

function requestUninstall(skillId) {
  setLoading(true);
  hideMessage();
  vscode.postMessage({ type: 'uninstall', skillId });
}

function requestUpdate(skillId, skillName, githubUrl) {
  setLoading(true);
  hideMessage();
  vscode.postMessage({ type: 'update', skillId, skillName, githubUrl });
}

function openExternal(url) {
  if (!url) {
    return;
  }

  vscode.postMessage({ type: 'openExternal', url });
}

function openInstalledFolder(skillId, localPath) {
  vscode.postMessage({ type: 'openInstalledFolder', skillId, localPath });
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

function formatDateTime(value) {
  if (!value) {
    return 'Unknown';
  }

  // Handle epoch timestamps in seconds (10 digits) or milliseconds (13 digits)
  let timestamp = Number(value);
  if (Number.isNaN(timestamp)) {
    return String(value);
  }

  // If it's a 10-digit number, assume it's seconds; convert to milliseconds
  if (timestamp < 10000000000) {
    timestamp *= 1000;
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  // Format as local date/time: e.g., "May 13, 2026, 2:45 PM"
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
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
