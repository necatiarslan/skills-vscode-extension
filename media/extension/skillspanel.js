const vscode = acquireVsCodeApi();

let RECOMMENDED_QUERY = '';

/**
 * Get a consistent emoji for a skill based on its ID.
 */
function getSkillEmoji(skillId) {
  const emojis = [
    '🚀', '💻', '⚡', '🔧', '🛠️', '⚙️', '🔌', '💾', '📡', '🖥️',
    '💡', '🧠', '🔍', '📊', '📈', '📉', '🎯', '🎨', '🖌️', '✨',
    '📝', '📚', '📋', '📄', '📑', '🗂️', '📂', '🗃️', '⏰', '⏱️',
    '🌟', '⭐', '✨', '🔥', '💧', '🌊', '🌈', '🌳', '🌸', '🌺',
    '🎪', '🎭', '🎬', '🎸', '🎺', '🎲', '🧩', '🎯', '🏆', '🥇',
    '💬', '💭', '📢', '📣', '📞', '📧', '✉️', '💌', '📮', '📬',
    '✅', '❌', '⚠️', '❓', '❗', '🔔', '🔕', '📍', '🎯', '🔐',
    '🎮', '🕹️', '🎲', '🃏', '🎰', '🎪', '🎢', '🎡', '🎠', '🎟️',
    '📅', '🗓️', '⏳', '⌛', '🕐', '🕑', '🕒', '🕓', '🕔', '🕕',
    '🌐', '🌍', '🌎', '🌏', '🚢', '🚁', '✈️', '🚂', '🚗', '🚙'
  ];
  let hash = 0;
  for (let i = 0; i < skillId.length; i++) {
    const char = skillId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return emojis[Math.abs(hash) % emojis.length];
}

let searchDebounceTimer;
let searchQuery = '';
let installedSkills = [];
let installedGroups = {
  installedGlobal: [],
  installedWorkspace: []
};
let searchResults = [];
let recommendedResults = [];
const knownSkillsById = new Map();

const searchInput = document.getElementById('searchInput');
const errorMessage = document.getElementById('errorMessage');
const emptyState = document.getElementById('emptyState');
const contentSection = document.getElementById('contentSection');

const searchTable = document.getElementById('searchTable');
const installedGlobalTable = document.getElementById('installedGlobalTable');
const installedWorkspaceTable = document.getElementById('installedWorkspaceTable');
const recommendedTable = document.getElementById('recommendedTable');
const searchCollapsible = document.getElementById('searchCollapsible');
const installedGlobalCollapsible = document.getElementById('installedGlobalCollapsible');
const installedWorkspaceCollapsible = document.getElementById('installedWorkspaceCollapsible');
const recommendedCollapsible = document.getElementById('recommendedCollapsible');

const searchCount = document.getElementById('searchCount');
const installedGlobalCount = document.getElementById('installedGlobalCount');
const installedWorkspaceCount = document.getElementById('installedWorkspaceCount');
const recommendedCount = document.getElementById('recommendedCount');

function initialize() {
  vscode.postMessage({ type: 'getInstalledSkills' });

  searchInput.addEventListener('input', (event) => {
    handleSearchInput(String(event.target?.value || ''));
  });

  contentSection.addEventListener('click', handleSectionClick);
  window.addEventListener('message', (event) => handleExtensionMessage(event.data));

  renderSections();
}

function handleSearchInput(query) {
  searchQuery = query;
  clearTimeout(searchDebounceTimer);

  if (!query.trim()) {
    searchResults = [];
    setLoading(false);
    hideMessage();
    renderSections();
    return;
  }

  setLoading(true);
  hideMessage();

  searchDebounceTimer = setTimeout(() => {
    vscode.postMessage({ type: 'search', query: query.trim() });
  }, 250);
}

function handleExtensionMessage(message) {
  switch (message.type) {
    case 'searchResults':
      handleSearchResults(message);
      break;
    case 'installedSkills':
      RECOMMENDED_QUERY = String(message.toolName || message.toolDisplayName || '').trim().toLowerCase();
      installedGroups = normalizeInstalledGroups(message.groups);
      installedSkills = [
        ...installedGroups.installedGlobal,
        ...installedGroups.installedWorkspace
      ];
      if (RECOMMENDED_QUERY) {
        vscode.postMessage({ type: 'search', query: RECOMMENDED_QUERY });
      }
      renderSections();
      break;
    case 'installResult':
      handleInstallResult(message);
      break;
    case 'uninstallResult':
      handleUninstallResult(message);
      break;
    case 'openFolderResult':
      if (!message.success) {
        showError(`Failed to open skill folder: ${message.error}`);
      }
      break;
    case 'openSkillDetailsResult':
      setLoading(false);
      if (!message.success) {
        showError(`Failed to open skill details: ${message.error}`);
      }
      break;
    case 'openUnmanagedSkillDetailsResult':
      setLoading(false);
      if (!message.success) {
        showError(`Failed to open unmanaged skill details: ${message.error}`);
      }
      break;
    default:
      break;
  }
}

function handleSearchResults(message) {
  const resultQuery = String(message.query || '').trim();

  if (resultQuery === RECOMMENDED_QUERY) {
    recommendedResults = message.error ? [] : normalizeSkills(message.results);
    updateKnownSkills(recommendedResults);
    if (message.error) {
      showError(`Recommended skills failed: ${message.error}`);
    }
    renderSections();
    return;
  }

  if (resultQuery !== searchQuery.trim()) {
    return;
  }

  setLoading(false);

  if (message.error) {
    searchResults = [];
    showError(`Search failed: ${message.error}`);
    renderSections();
    return;
  }

  searchResults = normalizeSkills(message.results);
  updateKnownSkills(searchResults);
  renderSections();
}

function handleInstallResult(message) {
  if (message.success) {
    showSuccess(`${message.skillId} installed`);
    vscode.postMessage({ type: 'getInstalledSkills' });
  } else {
    showError(`Installation failed: ${message.error}`);
  }
}

function handleUninstallResult(message) {
  if (message.success) {
    showSuccess(`${message.skillId} uninstalled`);
    vscode.postMessage({ type: 'getInstalledSkills' });
  } else {
    showError(`Uninstallation failed: ${message.error}`);
  }
}

function handleSectionClick(event) {
  const actionEl = event.target.closest('[data-action]');
  if (!actionEl) {
    const openRow = event.target.closest('[data-skill-id][data-action="open"]');
    if (openRow) {
      openSkillDetails(openRow.getAttribute('data-skill-id'));
    }
    return;
  }

  const action = actionEl.getAttribute('data-action');
  const skillId = actionEl.getAttribute('data-skill-id') || '';

  if (!action) {
    return;
  }

  if (action === 'open-folder') {
    event.stopPropagation();
    const localPath = actionEl.getAttribute('data-local-path') || '';
    vscode.postMessage({ type: 'openInstalledFolder', skillId, localPath });
    return;
  }

  if (action === 'open-unmanaged') {
    event.stopPropagation();
    vscode.postMessage({
      type: 'openUnmanagedSkillDetails',
      skill: {
        skillId,
        name: actionEl.getAttribute('data-skill-name') || skillId,
        author: actionEl.getAttribute('data-skill-author') || 'Unknown',
        description: actionEl.getAttribute('data-skill-description') || 'Unmanaged skill',
        localPath: actionEl.getAttribute('data-local-path') || '',
        scope: actionEl.getAttribute('data-scope') || 'global',
        kind: actionEl.getAttribute('data-kind') || 'other',
        canOpenDetails: true,
        canUninstall: true
      }
    });
    return;
  }

  if (!skillId) {
    return;
  }

  if (action === 'install') {
    event.stopPropagation();
    const skillName = actionEl.getAttribute('data-skill-name') || skillId;
    const githubUrl = actionEl.getAttribute('data-github-url') || '';
    vscode.postMessage({
      type: 'install',
      skillId,
      skillName,
      githubUrl
    });
    return;
  }

  if (action === 'uninstall') {
    event.stopPropagation();
    vscode.postMessage({ type: 'uninstall', skillId });
    return;
  }

  if (action === 'open') {
    openSkillDetails(skillId);
  }
}

function openSkillDetails(skillId) {
  if (!skillId) {
    return;
  }

  const skill = knownSkillsById.get(skillId);
  setLoading(true);
  hideMessage();

  if (skill && skill.githubUrl) {
    vscode.postMessage({ type: 'openSkillDetails', skill });
    return;
  }

  vscode.postMessage({ type: 'openSkillDetailsById', skillId });
}

function renderSections() {
  searchInput.value = searchQuery;
  const inSearchMode = Boolean(searchQuery.trim());

  // Hide Search section until user starts searching; in search mode only show Search.
  searchCollapsible.classList.toggle('hidden', !inSearchMode);
  installedGlobalCollapsible.classList.toggle('hidden', inSearchMode);
  installedWorkspaceCollapsible.classList.toggle('hidden', inSearchMode);
  recommendedCollapsible.classList.toggle('hidden', inSearchMode);

  const installedGlobalRows = buildSectionRows(installedGroups.installedGlobal);
  const installedWorkspaceRows = buildSectionRows(installedGroups.installedWorkspace);

  const recommendedRows = recommendedResults.filter((skill) => !isSkillInstalled(skill.id)).slice(0, 20);

  searchCount.textContent = String(searchResults.length);
  installedGlobalCount.textContent = String(installedGlobalRows.length);
  installedWorkspaceCount.textContent = String(installedWorkspaceRows.length);
  recommendedCount.textContent = String(recommendedRows.length);

  searchTable.innerHTML = renderSkillList(searchResults, { section: 'search' });
  installedGlobalTable.innerHTML = renderSkillList(installedGlobalRows, { section: 'installedGlobal' });
  installedWorkspaceTable.innerHTML = renderSkillList(installedWorkspaceRows, { section: 'installedWorkspace' });
  recommendedTable.innerHTML = renderSkillList(recommendedRows, { section: 'recommended' });

  const hasAnyData = inSearchMode
    ? searchResults.length > 0
    : installedGlobalRows.length > 0
      || installedWorkspaceRows.length > 0
      || recommendedRows.length > 0;
  emptyState.classList.toggle('hidden', hasAnyData);
}

function renderSkillList(skills, options) {
  if (!Array.isArray(skills) || skills.length === 0) {
    if (options.section === 'search' && searchQuery.trim()) {
      return '<div class="section-empty">No skills found for this query.</div>';
    }

    if (
      options.section === 'installedGlobal'
      || options.section === 'installedWorkspace'
    ) {
      return '<div class="section-empty">No skills in this section.</div>';
    }

    if (options.section === 'recommended') {
      return '<div class="section-empty">No recommended skills available.</div>';
    }

    return '<div class="section-empty">No skills to display.</div>';
  }

  return `
    <div class="skills-list" role="list">
      ${skills.map((skill) => renderSkillItem(skill, options)).join('')}
    </div>
  `;
}

function renderSkillItem(skill, options) {
  const isInstalledSection = options.section === 'installedGlobal' || options.section === 'installedWorkspace';
  const isManagedInstalled = isInstalledSection && skill.kind === 'managed';
  const isOtherInstalled = isInstalledSection && skill.kind === 'other';

  let actionButtons = `<vscode-button appearance="primary" class="skill-action-btn" data-action="install" data-skill-id="${escapeAttr(skill.id)}" data-skill-name="${escapeAttr(skill.name)}" data-github-url="${escapeAttr(skill.githubUrl || '')}">Install</vscode-button>`;
  if (isManagedInstalled) {
    actionButtons = `
      <vscode-button appearance="secondary" class="skill-action-btn" data-action="uninstall" data-skill-id="${escapeAttr(skill.skillId || skill.id)}">Uninstall</vscode-button>
    `;
  } else if (isOtherInstalled) {
    actionButtons = `
      <vscode-button appearance="secondary" class="skill-action-btn" data-action="open-unmanaged" data-skill-id="${escapeAttr(skill.skillId || '')}" data-skill-name="${escapeAttr(skill.name)}" data-skill-author="${escapeAttr(skill.author || 'Unknown')}" data-skill-description="${escapeAttr(skill.description || 'Unmanaged skill')}" data-local-path="${escapeAttr(skill.localPath || '')}" data-scope="${escapeAttr(skill.scope || 'global')}" data-kind="${escapeAttr(skill.kind || 'other')}">Open</vscode-button>
    `;
  }

  const skillEmoji = getSkillEmoji(skill.id || skill.name);
  const cardActionAttr = isOtherInstalled
    ? `data-action="open-unmanaged" data-skill-id="${escapeAttr(skill.skillId || '')}" data-skill-name="${escapeAttr(skill.name)}" data-skill-author="${escapeAttr(skill.author || 'Unknown')}" data-skill-description="${escapeAttr(skill.description || 'Unmanaged skill')}" data-local-path="${escapeAttr(skill.localPath || '')}" data-scope="${escapeAttr(skill.scope || 'global')}" data-kind="${escapeAttr(skill.kind || 'other')}"`
    : `data-action="open" data-skill-id="${escapeAttr(skill.id)}"`;
  const iconWrapClass = isOtherInstalled ? 'skill-icon-wrap skill-icon-wrap--muted' : 'skill-icon-wrap';
  const metaText = `👤 ${escapeHtml(skill.author || 'Unknown')}`;

  // Show install date if present (for installed sections)
  let installDateHtml = '';
  if (isInstalledSection && skill.installDate) {
    installDateHtml = `<div class="skill-meta-date">📅 ${formatDateTime(skill.installDate)}</div>`;
  }

  return `
    <article class="skill-item" role="listitem" tabindex="0" ${cardActionAttr}>
      <div class="${iconWrapClass}" aria-hidden="true">
        ${skillEmoji}
      </div>
      <div class="skill-main">
        <div class="skill-top-line">
          <h4 class="skill-name">${escapeHtml(skill.name)}</h4>
          ${isOtherInstalled ? '' : `<span class="skill-stars" title="stars">⭐ ${formatCompactNumber(skill.stars || 0)}</span>`}
        </div>
        <p class="skill-description">${escapeHtml(skill.description || (isOtherInstalled ? 'Unmanaged skill' : ''))}</p>
        <div class="skill-actions">
          <div class="skill-meta">${metaText}${installDateHtml}</div>
          <div class="skill-action-group">
            ${actionButtons}
          </div>
        </div>
      </div>
    </article>
  `;
}
// Date/time formatting for install date (matches UI.ts)
function formatDateTime(value) {
  if (!value) {
    return 'Unknown';
  }
  let date;
  if (typeof value === 'string') {
    const asNum = Number(value);
    if (!isNaN(asNum)) {
      date = new Date(asNum < 10000000000 ? asNum * 1000 : asNum);
    } else {
      date = new Date(value);
    }
  } else if (typeof value === 'number') {
    date = new Date(value < 10000000000 ? value * 1000 : value);
  } else if (value instanceof Date) {
    date = value;
  } else {
    return 'Unknown';
  }
  if (isNaN(date.getTime())) {
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

function normalizeInstalledGroups(groups) {
  return {
    installedGlobal: Array.isArray(groups?.installedGlobal) ? groups.installedGlobal : [],
    installedWorkspace: Array.isArray(groups?.installedWorkspace) ? groups.installedWorkspace : []
  };
}

function buildSectionRows(sectionSkills) {
  return sectionSkills.map((installed) => {
    const knownSkill = installed.skillId ? knownSkillsById.get(installed.skillId) : null;
    return {
      id: installed.skillId || installed.name || '',
      skillId: installed.skillId || '',
      name: knownSkill?.name || installed.name || installed.skillId || 'Unknown skill',
      author: knownSkill?.author || installed.author || 'Unknown',
      description: knownSkill?.description || installed.description || 'Unmanaged skill',
      stars: knownSkill?.stars || 0,
      githubUrl: knownSkill?.githubUrl || '',
      localPath: String(installed.localPath || ''),
      scope: installed.scope || 'global',
      kind: installed.kind || 'managed'
    };
  });
}

function normalizeSkills(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item) => ({
    id: String(item.id || ''),
    name: String(item.name || ''),
    author: String(item.author || ''),
    description: String(item.description || ''),
    stars: Number(item.stars || 0),
    githubUrl: String(item.githubUrl || ''),
    skillUrl: String(item.skillUrl || ''),
    updatedAt: String(item.updatedAt || '')
  })).filter((skill) => skill.id && skill.name);
}

function updateKnownSkills(skills) {
  for (const skill of skills) {
    knownSkillsById.set(skill.id, skill);
  }
}

function isSkillInstalled(skillId) {
  return installedSkills.some((entry) => entry.skillId === skillId);
}

function setLoading(isLoading) {
  // Loading indicator removed
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.remove('hidden');
}

function showSuccess(message) {
  errorMessage.textContent = message;
  errorMessage.classList.remove('hidden');
  setTimeout(() => {
    errorMessage.classList.add('hidden');
  }, 2200);
}

function hideMessage() {
  errorMessage.classList.add('hidden');
}

function formatCompactNumber(value) {
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value || 0);
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
