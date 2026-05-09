const vscode = acquireVsCodeApi();

let searchDebounceTimer;
let searchQuery = '';
let installedSkills = [];
let currentResults = [];

const searchInput = document.getElementById('searchInput');
const loadingIndicator = document.getElementById('loadingIndicator');
const skillsList = document.getElementById('skillsList');
const errorMessage = document.getElementById('errorMessage');
const emptyState = document.getElementById('emptyState');

function initialize() {
  vscode.postMessage({ type: 'getInstalledSkills' });
  searchInput.addEventListener('input', (event) => handleSearchInput(event.target.value));
  window.addEventListener('message', (event) => handleExtensionMessage(event.data));
}

function handleSearchInput(query) {
  searchQuery = query;
  clearTimeout(searchDebounceTimer);

  if (!query.trim()) {
    currentResults = [];
    renderListState();
    return;
  }

  setLoading(true);
  hideMessage();
  searchDebounceTimer = setTimeout(() => {
    vscode.postMessage({ type: 'search', query: query.trim() });
  }, 300);
}

function handleExtensionMessage(message) {
  switch (message.type) {
    case 'searchResults':
      handleSearchResults(message);
      break;
    case 'installedSkills':
      installedSkills = message.installed || [];
      renderListState();
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
      console.log('Unknown message type:', message.type);
  }
}

function handleSearchResults(message) {
  setLoading(false);

  if (message.error) {
    currentResults = [];
    showError(`Search failed: ${message.error}`);
    renderListState();
    return;
  }

  currentResults = message.results || [];
  renderListState();
}

function handleInstallResult(message) {
  if (message.success) {
    vscode.postMessage({ type: 'getInstalledSkills' });
    showSuccess(`${message.skillId} installed`);
  } else {
    showError(`Installation failed: ${message.error}`);
  }

  rerunSearchIfNeeded();
}

function handleUninstallResult(message) {
  if (message.success) {
    vscode.postMessage({ type: 'getInstalledSkills' });
    showSuccess(`${message.skillId} uninstalled`);
  } else {
    showError(`Uninstallation failed: ${message.error}`);
  }

  rerunSearchIfNeeded();
}

function rerunSearchIfNeeded() {
  if (searchQuery.trim()) {
    vscode.postMessage({ type: 'search', query: searchQuery.trim() });
  }
}

function renderListState() {
  skillsList.className = 'skills-list';
  searchInput.value = searchQuery;

  if (!searchQuery.trim()) {
    skillsList.innerHTML = '';
    emptyState.innerHTML = '<p>Search for skills to get started</p>';
    emptyState.style.display = 'flex';
    return;
  }

  if (currentResults.length === 0) {
    skillsList.innerHTML = '';
    emptyState.innerHTML = '<p>No skills found. Try a different search.</p>';
    emptyState.style.display = 'flex';
    return;
  }

  emptyState.style.display = 'none';
  skillsList.innerHTML = currentResults.map((skill) => renderSkillCard(skill)).join('');
}

function renderSkillCard(skill) {
  const isInstalled = isSkillInstalled(skill.id);

  return `
    <article class="skill-card" onclick='openSkillDetailsById(${JSON.stringify(skill.id)})'>
      <div class="skill-header">
        <div class="skill-title-wrap">
          <div class="skill-title">${escapeHtml(skill.name)}</div>
          <div class="skill-author">${escapeHtml(skill.author)}</div>
        </div>
        <div class="skill-stars">★ ${formatCompactNumber(skill.stars || 0)}</div>
      </div>
      <div class="skill-description">${escapeHtml(skill.description || 'No description available.')}</div>
      <div class="skill-footer">
        <div class="skill-badges">
          ${isInstalled ? '<span class="status-badge">Installed</span>' : ''}
        </div>
        <div class="skill-actions">
          ${isInstalled
            ? `<button class="btn-primary" type="button" onclick='event.stopPropagation(); requestUninstall(${JSON.stringify(skill.id)})'>Uninstall</button>`
            : `<button class="btn-primary" type="button" onclick='event.stopPropagation(); requestInstall(${JSON.stringify(skill.id)}, ${JSON.stringify(skill.name)}, ${JSON.stringify(skill.githubUrl)})'>Install</button>`}
          ${skill.githubUrl ? `<a class="btn-icon" href="${escapeAttr(skill.githubUrl)}" onclick="event.stopPropagation()" title="Open on GitHub">↗</a>` : ''}
        </div>
      </div>
    </article>
  `;
}

function openSkillDetailsById(skillId) {
  const skill = currentResults.find((entry) => entry.id === skillId);
  if (!skill) {
    showError('Unable to locate the selected skill.');
    return;
  }

  setLoading(true);
  hideMessage();
  vscode.postMessage({ type: 'openSkillDetails', skill });
}

function requestInstall(skillId, skillName, githubUrl) {
  vscode.postMessage({ type: 'install', skillId, skillName, githubUrl });
}

function requestUninstall(skillId) {
  vscode.postMessage({ type: 'uninstall', skillId });
}

function isSkillInstalled(skillId) {
  return installedSkills.some((skill) => skill.skillId === skillId);
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

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}