/// <reference types="svelte" />
/// <reference types="vite/client" />

declare global {
  interface Window {
    __SKILLS_WEBVIEW_BOOTSTRAP__?: {
      viewType: 'marketplace' | 'detail' | 'unmanaged-detail';
      initialState?: unknown;
    };
    __SKILL_DETAIL_INITIAL_STATE__?: unknown;
    __SKILL_DETAIL_UNMANAGED_INITIAL_STATE__?: unknown;
  }
}

export {};
