/**
 * Skills Marketplace Webview Script
 * Handles UI interactions and communication with extension host
 */

const vscode = acquireVsCodeApi();

// State
let searchDebounceTimer;
let installedSkills = [];
let currentResults = [];

// DOM Elements
const searchInput = document.getElementById('searchInput');
const loadingIndicator = document.getElementById('loadingIndicator');
const skillsList = document.getElementById('skillsList');
const errorMessage = document.getElementById('errorMessage');
const emptyState = document.getElementById('emptyState');

/**
 * Initialize the webview
 */
function initialize() {
  // Fetch installed skills
  vscode.postMessage({ type: 'getInstalledSkills' });

  // Set up event listeners
  searchInput.addEventListener('input', (e) => handleSearchInput(e.target.value));

  // Listen for messages from extension
  window.addEventListener('message', (event) => {
    const message = event.data;
    handleExtensionMessage(message);
  });
}

/**
 * Handle search input with debounce
 */
function handleSearchInput(query) {
  clearTimeout(searchDebounceTimer);

  if (!query.trim()) {
    skillsList.innerHTML = '';
    emptyState.style.display = 'flex';
    loadingIndicator.classList.add('hidden');
    errorMessage.classList.add('hidden');
    return;
  }

  loadingIndicator.classList.remove('hidden');
  emptyState.style.display = 'none';
  errorMessage.classList.add('hidden');

  searchDebounceTimer = setTimeout(() => {
    vscode.postMessage({
      type: 'search',
      query: query.trim()
    });
  }, 300); // 300ms debounce
}

/**
 * Handle messages from extension
 */
function handleExtensionMessage(message) {
  switch (message.type) {
    case 'searchResults':
      handleSearchResults(message);
      break;
    case 'installedSkills':
      handleInstalledSkillsUpdate(message);
      break;
    case 'installResult':
      handleInstallResult(message);
      break;
    case 'uninstallResult':
      handleUninstallResult(message);
      break;
    default:
      console.log('Unknown message type:', message.type);
  }
}

/**
 * Handle search results
 */
function handleSearchResults(message) {
  loadingIndicator.classList.add('hidden');

  if (message.error) {
    showError(`Search failed: ${message.error}`);
    skillsList.innerHTML = '';
    emptyState.style.display = 'none';
    return;
  }

  errorMessage.classList.add('hidden');

  if (message.results.length === 0) {
    skillsList.innerHTML = '';
    emptyState.innerHTML = '<p>No skills found. Try a different search.</p>';
    emptyState.style.display = 'flex';
    return;
  }

  emptyState.style.display = 'none';
  renderSkills(message.results);
}

/**
 * Render skills as cards
 */
function renderSkills(skills) {
  currentResults = skills;
  skillsList.innerHTML = skills.map((skill) => {
    const isInstalled = isSkillInstalled(skill.id);

    return `
      <div class="skill-card" data-skill-id="${skill.id}">
        <div class="skill-header">
          <div class="skill-title">${escapeHtml(skill.name)}</div>
          <div class="skill-stars">
            ⭐ ${skill.stars || 0}
          </div>
        </div>
        <div class="skill-author">by ${escapeHtml(skill.author)}</div>
        <div class="skill-description">${escapeHtml(skill.description)}</div>
        <div class="skill-footer">
          <div class="skill-badges">
            ${isInstalled ? '<span class="status-badge">Installed</span>' : ''}
          </div>
          <div class="skill-actions">
            ${isInstalled
              ? `<button class="btn-primary" onclick="requestUninstall('${skill.id}')">Uninstall</button>`
              : `<button class="btn-primary" onclick="requestInstall('${skill.id}', '${escapeHtml(skill.name)}', '${escapeAttr(skill.githubUrl)}')">Install</button>`
            }
            ${skill.githubUrl ? `<a href="${skill.githubUrl}" class="btn-icon" title="Open on GitHub">⧉</a>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Request skill installation
 */
function requestInstall(skillId, skillName, githubUrl) {
  vscode.postMessage({
    type: 'install',
    skillId: skillId,
    skillName: skillName,
    githubUrl: githubUrl
  });
}

/**
 * Request skill uninstallation
 */
function requestUninstall(skillId) {
  vscode.postMessage({
    type: 'uninstall',
    skillId: skillId
  });
}

/**
 * Handle installed skills update
 */
function handleInstalledSkillsUpdate(message) {
  installedSkills = message.installed;

  if (currentResults.length > 0) {
    renderSkills(currentResults);
  }
}

/**
 * Handle install result
 */
function handleInstallResult(message) {
  if (message.success) {
    // Refresh installed skills list
    vscode.postMessage({ type: 'getInstalledSkills' });
    showSuccess(`${message.skillId} installed in ${message.toolDisplayName || message.toolName}`);
  } else {
    showError(`Installation failed: ${message.error}`);
  }

  // Re-render skills if visible
  if (searchInput.value) {
    vscode.postMessage({
      type: 'search',
      query: searchInput.value
    });
  }
}

/**
 * Handle uninstall result
 */
function handleUninstallResult(message) {
  if (message.success) {
    // Refresh installed skills list
    vscode.postMessage({ type: 'getInstalledSkills' });
    showSuccess(`${message.skillId} uninstalled from ${message.toolDisplayName || message.toolName}`);
  } else {
    showError(`Uninstallation failed: ${message.error}`);
  }

  // Re-render skills if visible
  if (searchInput.value) {
    vscode.postMessage({
      type: 'search',
      query: searchInput.value
    });
  }
}

/**
 * Check if a skill is installed on any tool
 */
function isSkillInstalled(skillId) {
  return installedSkills.some((s) => s.skillId === skillId);
}

/**
 * Show error message
 */
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.remove('hidden');
}

/**
 * Show success message
 */
function showSuccess(message) {
  errorMessage.textContent = '✓ ' + message;
  errorMessage.classList.remove('hidden');
  setTimeout(() => {
    errorMessage.classList.add('hidden');
  }, 3000);
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Escape attribute values
 */
function escapeAttr(text) {
  return text.replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// Initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
