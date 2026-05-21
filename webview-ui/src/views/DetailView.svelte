<script lang="ts">
  import './detail.css';
  import { onMount } from 'svelte';

  export let mode: 'detail' | 'unmanaged-detail';
  export let initialState: unknown;

  onMount(async () => {
    if (mode === 'detail') {
      window.__SKILL_DETAIL_INITIAL_STATE__ = initialState;
      await import('../lib/skilldetailpanelLegacy.js');
      return;
    }

    window.__SKILL_DETAIL_UNMANAGED_INITIAL_STATE__ = initialState;
    await import('../lib/skillDetailUnManagedPanelLegacy.js');
  });
</script>

<div class="detail-root">
  <div id="loadingIndicator" class="loading hidden"><span class="spinner"></span> Loading...</div>
  <div id="errorMessage" class="error-message hidden"></div>
  <div id="detailContainer"></div>
  {#if mode === 'detail'}
    <div id="monacoEditor" style="display: none; width: 100%; height: 600px;"></div>
  {/if}
</div>
