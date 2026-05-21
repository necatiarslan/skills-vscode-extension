import '@vscode-elements/elements';
import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';

interface SkillsWebviewBootstrap {
  viewType: 'marketplace' | 'detail' | 'unmanaged-detail';
  initialState?: unknown;
}

declare global {
  interface Window {
    __SKILLS_WEBVIEW_BOOTSTRAP__?: SkillsWebviewBootstrap;
    __SKILL_DETAIL_INITIAL_STATE__?: unknown;
    __SKILL_DETAIL_UNMANAGED_INITIAL_STATE__?: unknown;
  }
}

const appTarget = document.getElementById('app');

if (!appTarget) {
  throw new Error('Missing app container element.');
}

const bootstrap: SkillsWebviewBootstrap =
  window.__SKILLS_WEBVIEW_BOOTSTRAP__ ?? { viewType: 'marketplace' };

mount(App, {
  target: appTarget,
  props: { bootstrap }
});
