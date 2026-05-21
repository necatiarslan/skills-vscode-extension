<script lang="ts">
  import DetailView from './views/DetailView.svelte';
  import MarketplaceView from './views/MarketplaceView.svelte';

  interface SkillsWebviewBootstrap {
    viewType: 'marketplace' | 'detail' | 'unmanaged-detail';
    initialState?: unknown;
  }

  export let bootstrap: SkillsWebviewBootstrap;
</script>

{#if bootstrap.viewType === 'marketplace'}
  <MarketplaceView />
{:else}
  <DetailView mode={bootstrap.viewType} initialState={bootstrap.initialState} />
{/if}
