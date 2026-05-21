<script lang="ts">
  import './marketplace.css';
  import { onMount } from 'svelte';

  onMount(async () => {
    await import('../lib/skillsPanelLegacy.js');
  });
</script>

<div class="marketplace-container">
  <div class="search-section">
    <vscode-textfield id="searchInput" class="search-input" placeholder="Search AI Agent Skills..." aria-label="Search AI Agent Skills" autocomplete="off">
      <vscode-icon slot="content-before" name="search" title="search"></vscode-icon>
    </vscode-textfield>
  </div>

  <div class="content-section" id="contentSection">
    <div id="errorMessage" class="error-message hidden"></div>

    <vscode-collapsible id="searchCollapsible" heading="Search" class="collapsible" open>
      <vscode-badge id="searchCount" variant="counter" slot="decorations">0</vscode-badge>
      <div id="searchTable" class="section-table"></div>
    </vscode-collapsible>

    <vscode-collapsible id="installedGlobalCollapsible" heading="Global" class="collapsible">
      <vscode-badge id="installedGlobalCount" variant="counter" slot="decorations">0</vscode-badge>
      <div id="installedGlobalTable" class="section-table"></div>
    </vscode-collapsible>

    <vscode-collapsible id="installedWorkspaceCollapsible" heading="Workspace" class="collapsible">
      <vscode-badge id="installedWorkspaceCount" variant="counter" slot="decorations">0</vscode-badge>
      <div id="installedWorkspaceTable" class="section-table"></div>
    </vscode-collapsible>

    <vscode-collapsible id="recommendedCollapsible" heading="Recommended" class="collapsible">
      <vscode-badge id="recommendedCount" variant="counter" slot="decorations">0</vscode-badge>
      <div id="recommendedTable" class="section-table"></div>
    </vscode-collapsible>

    <div id="emptyState" class="empty-state">Search for skills to populate results.</div>
  </div>
</div>
