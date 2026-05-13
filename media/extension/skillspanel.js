const vscode = acquireVsCodeApi();

const RECOMMENDED_QUERY = 'vscode';

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
let searchResults = [];
let recommendedResults = [];
const knownSkillsById = new Map();

const searchInput = document.getElementById('searchInput');
const errorMessage = document.getElementById('errorMessage');
const emptyState = document.getElementById('emptyState');
const contentSection = document.getElementById('contentSection');

const searchTable = document.getElementById('searchTable');
const installedTable = document.getElementById('installedTable');
const recommendedTable = document.getElementById('recommendedTable');

const searchCount = document.getElementById('searchCount');
const installedCount = document.getElementById('installedCount');
const recommendedCount = document.getElementById('recommendedCount');

function initialize() {
  vscode.postMessage({ type: 'getInstalledSkills' });
  vscode.postMessage({ type: 'search', query: RECOMMENDED_QUERY });

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
      installedSkills = Array.isArray(message.installed) ? message.installed : [];
      renderSections();
      break;
    case 'installResult':
      handleInstallResult(message);
      break;
    case 'uninstallResult':
      handleUninstallResult(message);
      break;
    case 'openSkillDetailsResult':
      setLoading(false);
      if (!message.success) {
        showError(`Failed to open skill details: ${message.error}`);
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
  const skillId = actionEl.getAttribute('data-skill-id');

  if (!action || !skillId) {
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

  const installedRows = installedSkills.map((installed) => {
    const knownSkill = knownSkillsById.get(installed.skillId);
    return {
      id: installed.skillId,
      name: knownSkill?.name || installed.name || installed.skillId,
      author: knownSkill?.author || installed.author || 'Unknown',
      description: knownSkill?.description || 'Installed skill',
      stars: knownSkill?.stars || 0,
      githubUrl: knownSkill?.githubUrl || ''
    };
  });

  const recommendedRows = recommendedResults.filter((skill) => !isSkillInstalled(skill.id)).slice(0, 12);

  searchCount.textContent = String(searchResults.length);
  installedCount.textContent = String(installedRows.length);
  recommendedCount.textContent = String(recommendedRows.length);

  searchTable.innerHTML = renderSkillList(searchResults, { section: 'search' });
  installedTable.innerHTML = renderSkillList(installedRows, { section: 'installed' });
  recommendedTable.innerHTML = renderSkillList(recommendedRows, { section: 'recommended' });

  const hasAnyData = searchResults.length > 0 || installedRows.length > 0 || recommendedRows.length > 0;
  const hasSearchQuery = Boolean(searchQuery.trim());
  emptyState.classList.toggle('hidden', hasAnyData || hasSearchQuery);
}

function renderSkillList(skills, options) {
  if (!Array.isArray(skills) || skills.length === 0) {
    if (options.section === 'search' && searchQuery.trim()) {
      return '<div class="section-empty">No skills found for this query.</div>';
    }

    if (options.section === 'installed') {
      return '<div class="section-empty">No installed skills for this tool.</div>';
    }

    if (options.section === 'recommended') {
      return '<div class="section-empty">No recommended skills available.</div>';
    }

    return '<div class="section-empty">No skills to display.</div>';
  }

  return `
    <div class="skills-list" role="list">
      ${skills.map((skill) => renderSkillItem(skill)).join('')}
    </div>
  `;
}

function renderSkillItem(skill) {
  const installed = isSkillInstalled(skill.id);
  const actionButton = installed
    ? `<vscode-button appearance="secondary" class="skill-action-btn" data-action="uninstall" data-skill-id="${escapeAttr(skill.id)}">Uninstall</vscode-button>`
    : `<vscode-button appearance="primary" class="skill-action-btn" data-action="install" data-skill-id="${escapeAttr(skill.id)}" data-skill-name="${escapeAttr(skill.name)}" data-github-url="${escapeAttr(skill.githubUrl || '')}">Install</vscode-button>`;
  const skillEmoji = getSkillEmoji(skill.id);

  return `
    <article class="skill-item" role="listitem" tabindex="0" data-action="open" data-skill-id="${escapeAttr(skill.id)}">
      <div class="skill-icon-wrap" aria-hidden="true">
        ${skillEmoji}
      </div>
      <div class="skill-main">
        <div class="skill-top-line">
          <h4 class="skill-name">${escapeHtml(skill.name)}</h4>
          ${actionButton}
          <vscode-badge class="skill-stars" variant="counter" title="stars">${formatCompactNumber(skill.stars || 0)}</vscode-badge>
        </div>
        <div class="skill-meta">${escapeHtml(skill.author || 'Unknown')}</div>
        <p class="skill-description">${escapeHtml(skill.description || '')}</p>
      </div>
    </article>
  `;
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
