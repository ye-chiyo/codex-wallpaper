import { createHash } from "node:crypto";

function createRuntimeStyles(rootId, controlsId) {
  return `
      #${rootId}, #${rootId} * { box-sizing: border-box; }
      #${rootId}, #${controlsId} { position: fixed; inset: 0; pointer-events: none; color: var(--app-color-text-foreground, rgb(245 245 250)); font: 13px/1.4 system-ui, sans-serif; }
      #${controlsId} { z-index: 2147483647; }
      #${rootId} [data-codex-wallpaper-layer] { position: fixed; inset: 0; z-index: 0; pointer-events: none; }
      #${rootId} .media { position: absolute; inset: 0; overflow: hidden; }
      #${rootId} .media.staged { opacity: 0; }
      #${rootId} .media.builtin { background: radial-gradient(circle at 18% 20%, #57d7ff 0, transparent 36%), radial-gradient(circle at 82% 78%, #ff9ac6 0, transparent 38%), linear-gradient(135deg, #1b2ab5, #5d32b8 48%, #d44c87); }
      #${rootId} .scene-host { position: absolute; inset: 0; opacity: 0; }
      #${rootId} .scene-host.ready { opacity: 1; }
      #${rootId} .media img, #${rootId} .media video, #${rootId} .media canvas { width: 100%; height: 100%; object-fit: cover; display: block; transform: translateZ(0); }
      #${rootId} .media iframe { display: block; width: 100%; height: 100%; border: 0; }
      #${rootId} .dim { position: absolute; inset: 0; }
      /* Keep the corner when the toolbar fits beside the composer. */
      body [data-composer-surface-variant] { anchor-name: --codex-wallpaper-composer; }
      #${controlsId} .toolbar {
        position: fixed; right: 14px; bottom: 14px; z-index: 2147483647; display: flex; padding: 3px; border: 1px solid var(--codex-wallpaper-line-strong); border-radius: 12px; background: var(--codex-wallpaper-panel); box-shadow: var(--codex-wallpaper-shadow); pointer-events: auto;
        position-anchor: --codex-wallpaper-composer;
        left: calc(anchor(right) + 8px);
        width: max-content; justify-self: end;
        position-try-fallbacks: --codex-wallpaper-above-composer;
        anchor-name: --codex-wallpaper-toolbar;
      }
      @position-try --codex-wallpaper-above-composer {
        left: auto;
        bottom: max(14px, calc(anchor(top, 6px) + 8px));
      }
      #${controlsId} .toolbar button, #${controlsId} .panel button { border: 1px solid var(--codex-wallpaper-line-strong); border-radius: var(--codex-wallpaper-radius-sm); background: var(--codex-wallpaper-raised); color: var(--app-color-text-foreground, white); padding: 7px 10px; cursor: pointer; transition: background-color .12s ease-out, border-color .12s ease-out; }
      #${controlsId} .toolbar button { border-color: transparent; border-radius: 8px; background: transparent; }
      #${controlsId} .toolbar button:hover, #${controlsId} .panel button:hover { background: color-mix(in srgb, var(--app-color-text-foreground, rgb(245 245 250)) 8%, var(--codex-wallpaper-raised)); }
      #${controlsId} .toolbar button:active, #${controlsId} .panel button:active { background: color-mix(in srgb, var(--app-color-text-foreground, rgb(245 245 250)) 14%, var(--codex-wallpaper-raised)); }
      #${controlsId} .toolbar button[aria-pressed='true'], #${controlsId} .panel button[aria-pressed='true'] { border-color: var(--codex-wallpaper-line-strong); background: color-mix(in srgb, var(--app-color-accent-blue, rgb(51 156 255)) 18%, var(--codex-wallpaper-raised)); }
      #${controlsId} .toolbar button:focus-visible, #${controlsId} .panel button:focus-visible { outline: 2px solid var(--color-text-accent, rgb(51 156 255)); outline-offset: 2px; }
      #${controlsId} .toolbar button:disabled, #${controlsId} .panel button:disabled { opacity: .48; cursor: not-allowed; }
      #${controlsId} .panel {
        position: fixed; z-index: 2147483647; width: min(390px, calc(100vw - 28px)); overflow: auto; padding: 14px; border: 1px solid var(--codex-wallpaper-line-strong); border-radius: var(--codex-wallpaper-radius); background: var(--codex-wallpaper-panel); backdrop-filter: var(--codex-wallpaper-interface-blur); box-shadow: var(--codex-wallpaper-shadow); pointer-events: auto; display: none;
        overscroll-behavior: contain;
        scrollbar-gutter: stable;
        position-anchor: --codex-wallpaper-toolbar;
        position-area: top span-left;
        inset: 14px 0 3px 14px;
        place-self: end;
        max-height: min(74vh, 720px, calc(100% - 17px));
      }
      #${controlsId} .panel.open { display: block; }
      html:has([data-composer-surface-variant]) #${controlsId} .panel {
        position-anchor: --codex-wallpaper-composer;
        position-area: top span-right;
        inset: 14px 0 8px 14px;
      }
      #${controlsId} .panel header { display: flex; align-items: center; justify-content: space-between; }
      #${controlsId} .panel-region { margin-top: 10px; border: 1px solid var(--codex-wallpaper-line); border-radius: var(--codex-wallpaper-radius-sm); background: color-mix(in srgb, var(--app-color-background-surface, rgb(24 24 28)) 24%, transparent); }
      #${controlsId} .panel-region > h3, #${controlsId} .panel-region > summary { margin: 0; padding: 10px 11px; color: color-mix(in srgb, var(--app-color-text-foreground, white) 80%, transparent); font-size: 12px; font-weight: 650; letter-spacing: .06em; text-transform: uppercase; }
      #${controlsId} .panel-region > summary { cursor: pointer; list-style-position: inside; }
      #${controlsId} .panel-region > summary::marker { color: color-mix(in srgb, var(--app-color-text-foreground, white) 56%, transparent); }
      #${controlsId} .panel-region-body { display: grid; gap: 8px; padding: 0 10px 10px; }
      #${controlsId} .import-row { display: flex; align-items: center; justify-content: space-between; margin-top: 12px; padding: 9px 10px; border: 1px dashed var(--codex-wallpaper-line-strong); border-radius: var(--codex-wallpaper-radius-sm); cursor: pointer; }
      #${controlsId} .panel-region-body .import-row { margin-top: 0; }
      #${controlsId} .import-row input { width: 135px; font-size: 11px; }
      #${controlsId} .runtime-status, #${controlsId} .playlist-summary { margin: 9px 0; color: color-mix(in srgb, var(--app-color-text-foreground, white) 82%, transparent); }
      #${controlsId} .library-filters { display: grid; grid-template-columns: minmax(0, 1fr) 110px; gap: 7px; }
      #${controlsId} .library-filter { display: grid; gap: 4px; min-width: 0; color: color-mix(in srgb, var(--app-color-text-foreground, white) 70%, transparent); font-size: 11px; }
      #${controlsId} .library-filter:last-child { grid-column: 1 / -1; grid-template-columns: auto 1fr; align-items: center; }
      #${controlsId} .library-filter input[type='search'], #${controlsId} .library-filter select { min-width: 0; width: 100%; border: 1px solid var(--codex-wallpaper-line-strong); border-radius: var(--codex-wallpaper-radius-sm); background: var(--codex-wallpaper-raised); color: var(--app-color-text-foreground, white); padding: 7px 8px; font: inherit; }
      #${controlsId} .library-filter input[type='search']:focus-visible, #${controlsId} .library-filter select:focus-visible, #${controlsId} .library-filter input[type='checkbox']:focus-visible { outline: 2px solid var(--color-text-accent, rgb(51 156 255)); outline-offset: 2px; }
      #${controlsId} .library-result { min-height: 1.4em; margin: 0; color: color-mix(in srgb, var(--app-color-text-foreground, white) 68%, transparent); font-size: 11px; }
      #${controlsId} .wallpaper-list { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      #${controlsId} .card { position: relative; min-width: 0; padding: 7px; border: 1px solid var(--codex-wallpaper-line); border-radius: 10px; background: color-mix(in srgb, var(--app-color-background-surface-under, rgb(12 12 16)) 44%, transparent); }
      #${controlsId} .card[hidden] { display: none; }
      #${controlsId} .card[data-selected='true'] { border-color: var(--codex-wallpaper-line-strong); background: color-mix(in srgb, var(--app-color-accent-blue, rgb(51 156 255)) 12%, var(--codex-wallpaper-raised)); }
      #${controlsId} .card-current { position: absolute; top: 11px; right: 11px; padding: 2px 5px; border-radius: 999px; background: color-mix(in srgb, var(--app-color-background-surface-under, rgb(12 12 16)) 82%, transparent); color: var(--app-color-text-foreground, white); font-size: 9px; font-weight: 650; }
      #${controlsId} .card-current[hidden] { display: none; }
      #${controlsId} .thumb { aspect-ratio: 16 / 9; display: grid; place-items: center; overflow: hidden; border-radius: 6px; background: color-mix(in srgb, var(--app-color-text-foreground, white) 8%, transparent); font-size: 10px; }
      #${controlsId} .thumb img, #${controlsId} .thumb video { width: 100%; height: 100%; object-fit: cover; }
      #${controlsId} .card strong { display: block; margin-top: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      #${controlsId} .card small { display: block; margin-top: 2px; color: color-mix(in srgb, var(--app-color-text-foreground, white) 72%, transparent); }
      #${controlsId} .card-actions { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
      #${controlsId} .card-actions button { padding: 4px 6px; font-size: 10px; }
      #${controlsId} .settings-grid, #${controlsId} .control-grid { display: grid; gap: 7px; }
      #${controlsId} .range { display: grid; grid-template-columns: 64px 48px 1fr; align-items: center; gap: 7px; }
      #${controlsId} .range output { color: color-mix(in srgb, var(--app-color-text-foreground, white) 78%, transparent); font-variant-numeric: tabular-nums; }
      #${controlsId} .profile-control { display: grid; grid-template-columns: 80px minmax(0, 1fr); align-items: center; gap: 7px; }
      #${controlsId} .profile-control select { min-width: 0; border: 1px solid var(--codex-wallpaper-line-strong); border-radius: var(--codex-wallpaper-radius-sm); background: var(--codex-wallpaper-raised); color: var(--app-color-text-foreground, white); padding: 6px 7px; font: inherit; }
      #${controlsId} .setting-toggle { display: flex; align-items: center; gap: 7px; min-height: 28px; }
      #${controlsId} .playback-capability { margin: 0; color: color-mix(in srgb, var(--app-color-text-foreground, white) 64%, transparent); font-size: 11px; }
      #${controlsId} .profile-control select:focus-visible, #${controlsId} .setting-toggle input:focus-visible { outline: 2px solid var(--color-text-accent, rgb(51 156 255)); outline-offset: 2px; }
      #${controlsId} .surface-override { display: grid; gap: 4px; padding: 6px 0; border-bottom: 1px solid var(--codex-wallpaper-line); }
      #${controlsId} .surface-override:last-child { border-bottom: 0; }
      #${controlsId} .surface-override-controls { display: grid; grid-template-columns: minmax(0, 1fr) 42px auto; align-items: center; gap: 7px; }
      #${controlsId} .surface-override-controls output { color: color-mix(in srgb, var(--app-color-text-foreground, white) 78%, transparent); font-variant-numeric: tabular-nums; }
      #${controlsId} .surface-override-controls button { padding: 5px 7px; font-size: 10px; }
      #${controlsId} .preset-editor, #${controlsId} .settings-transfer, #${controlsId} .preset-row, #${controlsId} .reset-groups { display: grid; gap: 6px; }
      #${controlsId} .preset-editor { grid-template-columns: minmax(0, 1fr) auto; }
      #${controlsId} .preset-editor input, #${controlsId} .preset-row input { min-width: 0; border: 1px solid var(--codex-wallpaper-line-strong); border-radius: var(--codex-wallpaper-radius-sm); background: var(--codex-wallpaper-raised); color: var(--app-color-text-foreground, white); padding: 7px 8px; font: inherit; }
      #${controlsId} .preset-list { display: grid; gap: 6px; }
      #${controlsId} .preset-row { grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; padding: 6px; border: 1px solid var(--codex-wallpaper-line); border-radius: var(--codex-wallpaper-radius-sm); }
      #${controlsId} .preset-row[data-active='true'] { border-color: var(--codex-wallpaper-line-strong); background: color-mix(in srgb, var(--app-color-accent-blue, rgb(51 156 255)) 10%, transparent); }
      #${controlsId} .settings-transfer { grid-template-columns: 1fr 1fr; align-items: center; }
      #${controlsId} .settings-import { display: grid; gap: 4px; font-size: 11px; }
      #${controlsId} .settings-status { min-height: 1.4em; margin: 0; color: color-mix(in srgb, var(--app-color-text-foreground, white) 72%, transparent); font-size: 11px; }
      #${controlsId} .reset-groups { grid-template-columns: 1fr 1fr; }
      #${controlsId} .reset-groups button { font-size: 11px; }
      #${controlsId} .reset { width: 100%; color: var(--color-text-danger, rgb(224 46 42)) !important; }
      @media (max-width: 520px) {
        #${controlsId} .panel { width: min(340px, calc(100vw - 16px)); max-height: min(82vh, calc(100% - 10px)); }
        #${controlsId} .library-filters { grid-template-columns: 1fr; }
        #${controlsId} .library-filter:last-child { grid-column: auto; }
        #${controlsId} .wallpaper-list { grid-template-columns: 1fr; }
      }
      :root {
        --codex-wallpaper-surface-opacity: 72%;
        --codex-wallpaper-chat-opacity: 18%;
        --codex-wallpaper-sidebar-opacity: 72%;
        --codex-wallpaper-top-opacity: 0%;
        --codex-wallpaper-right-opacity: 72%;
        --codex-wallpaper-settings-opacity: 94%;
        --codex-wallpaper-settings-canvas-opacity: 64%;
        --codex-wallpaper-settings-card-opacity: 42%;
        --codex-wallpaper-interface-blur: none;
        --codex-wallpaper-frame: color-mix(in srgb, var(--app-color-background-surface, rgb(24 24 28)) var(--codex-wallpaper-surface-opacity), transparent);
        --codex-wallpaper-canvas: color-mix(in srgb, var(--app-color-background-surface, rgb(24 24 28)) var(--codex-wallpaper-chat-opacity), transparent);
        --codex-wallpaper-raised: color-mix(in srgb, var(--app-color-background-surface-under, rgb(12 12 16)) 90%, transparent);
        --codex-wallpaper-panel: color-mix(in srgb, var(--app-color-background-surface-under, rgb(12 12 16)) var(--codex-wallpaper-settings-opacity), transparent);
        --codex-wallpaper-settings-canvas: color-mix(in srgb, var(--app-color-background-surface-under, rgb(12 12 16)) var(--codex-wallpaper-settings-canvas-opacity), transparent);
        --codex-wallpaper-settings-card: color-mix(in srgb, var(--app-color-background-surface, rgb(24 24 28)) var(--codex-wallpaper-settings-card-opacity), transparent);
        --codex-wallpaper-settings-control: color-mix(in srgb, var(--app-color-text-foreground, rgb(245 245 250)) 6%, transparent);
        --codex-wallpaper-line: color-mix(in srgb, var(--app-color-text-foreground, rgb(245 245 250)) 10%, transparent);
        --codex-wallpaper-line-strong: color-mix(in srgb, var(--app-color-text-foreground, rgb(245 245 250)) 16%, transparent);
        --codex-wallpaper-radius: 14px;
        --codex-wallpaper-radius-sm: 9px;
        --codex-wallpaper-shadow: 0 12px 34px rgb(0 0 0 / .22);
      }
      html[data-theme='light'] {
        --codex-wallpaper-settings-canvas: color-mix(in srgb, var(--app-color-background-surface-under, rgb(232 232 237)) var(--codex-wallpaper-settings-canvas-opacity), transparent);
        --codex-wallpaper-settings-card: color-mix(in srgb, var(--app-color-background-surface, rgb(247 247 249)) var(--codex-wallpaper-settings-card-opacity), transparent);
      }
      body :where([data-app-shell-main-surface], [data-app-shell-page-sidebar], [data-app-shell-titlebar], [data-app-shell-pane-content-viewport], [data-app-shell-trailing-sidebar]) { background-color: var(--codex-wallpaper-frame) !important; backdrop-filter: var(--codex-wallpaper-interface-blur);
        &:not([data-app-shell-titlebar]) { position: relative; z-index: 1; }
      }
      body [data-app-shell-main-surface] { background-color: var(--codex-wallpaper-canvas) !important; border-radius: 0 var(--codex-wallpaper-radius) 0 0 !important; --color-text-tertiary: var(--color-text-secondary); }
      body [data-app-shell-page-sidebar], body [data-app-shell-titlebar] { background-color: color-mix(in srgb, var(--app-color-background-surface, rgb(24 24 28)) var(--codex-wallpaper-sidebar-opacity), transparent) !important; }
      body [data-app-shell-pane-content-viewport], body [data-app-shell-trailing-sidebar] { background-color: color-mix(in srgb, var(--app-color-background-surface, rgb(24 24 28)) var(--codex-wallpaper-right-opacity), transparent) !important; box-shadow: inset 1px 0 0 var(--codex-wallpaper-line); }
      body [data-app-shell-tabs] [data-app-shell-compact-page-gutter='false'] { background-color: transparent !important; }
      body :where([data-app-navigation-rail], [data-slate-sidebar-content]) {
        background-color: transparent !important;
        box-shadow: inset -1px 0 0 var(--codex-wallpaper-line);
        --color-text-tertiary: var(--color-text-secondary);
      }
      body :is([data-app-shell-titlebar], [data-app-shell-frame] > :has(> [role='menubar'])) {
        background-color: transparent !important;
        box-shadow: inset 0 -1px 0 var(--codex-wallpaper-line);
        --color-text-tertiary: var(--color-text-secondary);
      }
      html[data-codex-wallpaper-top-surface] body :is([data-app-shell-titlebar], [data-app-shell-frame] > :has(> [role='menubar'])) { background-color: color-mix(in srgb, var(--app-color-background-surface, rgb(24 24 28)) var(--codex-wallpaper-top-opacity), transparent) !important; }
      body [data-app-shell-trailing-sidebar] [role='tablist'] { background-color: transparent !important; box-shadow: inset 0 -1px 0 var(--codex-wallpaper-line); }
      body [data-app-shell-trailing-sidebar] file-tree-container { --trees-bg-override: transparent !important; background-color: transparent !important; }
      body [data-app-shell-page-surface] { background-color: transparent !important; backdrop-filter: none; }
      body [data-browser-sidebar-webview] { background-color: var(--app-color-background-surface-under, rgb(12, 12, 16)) !important; opacity: 1 !important; }
      body [data-browser-sidebar-webview] > webview { background-color: var(--app-color-background-surface-under, rgb(12, 12, 16)) !important; }
      body [data-app-shell-frame] { background-color: var(--codex-wallpaper-frame) !important; }
      body [data-app-shell-feature-navigation='true']:has([data-settings-nav-scroll-container]) {
        & main[data-app-shell-main-surface] :where([class~='electron:bg-surface']) { background-color: var(--codex-wallpaper-settings-canvas) !important; }
        & main[data-app-shell-main-surface] :where([class~='rounded-2xl'][class~='border-default']) {
          background-color: var(--codex-wallpaper-settings-card) !important;
          border-color: var(--codex-wallpaper-line-strong) !important;
          border-radius: var(--codex-wallpaper-radius) !important;
          --color-border: var(--codex-wallpaper-line);
        }
        & :where([class~='bg-background-secondary-soft-alpha']) {
          background-color: var(--codex-wallpaper-settings-control) !important;
          box-shadow: inset 0 0 0 1px var(--codex-wallpaper-line);
        }
        & :where([class~='bg-background-secondary-soft-alpha']):focus-within {
          box-shadow: inset 0 0 0 1px var(--codex-wallpaper-line-strong), 0 0 0 2px color-mix(in srgb, var(--color-text-accent, rgb(51 156 255)) 20%, transparent);
        }
        & nav button[data-settings-panel-slug] {
          border-radius: var(--codex-wallpaper-radius-sm) !important;
        }
        & nav button[data-settings-panel-slug][aria-current='page'] {
          background-color: color-mix(in srgb, var(--app-color-text-foreground, rgb(245 245 250)) 8%, transparent) !important;
          box-shadow: inset 0 0 0 1px var(--codex-wallpaper-line);
        }
        & main[data-app-shell-main-surface] :where([class~='bg-background-neutral-soft-alpha'], [class~='bg-text/5']) {
          background-color: var(--codex-wallpaper-settings-control) !important;
          border-color: var(--codex-wallpaper-line-strong) !important;
          border-radius: var(--codex-wallpaper-radius-sm) !important;
        }
        & main[data-app-shell-main-surface] :where([class~='bg-background-neutral-soft-alpha'], [class~='bg-text/5']):is(:hover, [data-state='open']) {
          background-color: color-mix(in srgb, var(--app-color-text-foreground, rgb(245 245 250)) 9%, var(--codex-wallpaper-settings-control)) !important;
        }
        & main[data-app-shell-main-surface] :where([class~='bg-segmented-selected']) {
          background-color: var(--codex-wallpaper-settings-control) !important;
        }
        & :where(button, [role='combobox']):focus-visible {
          outline: 2px solid var(--color-text-accent, rgb(51 156 255));
          outline-offset: 2px;
        }
        & main[data-app-shell-main-surface] [role='switch'] > [data-state] {
          box-shadow: inset 0 0 0 1px var(--codex-wallpaper-line-strong);
        }
      }
      body [data-app-shell-main-surface] :where([data-testid='webmcp-tool-scroll'], [data-summary-panel-variant], pre) { background-color: var(--codex-wallpaper-raised) !important; }
      body :is([data-app-shell-page-sidebar]:not([data-app-shell-frame]), [data-app-shell-trailing-sidebar], [data-app-shell-pane-content-viewport]) :where([class~='bg-surface'], [data-testid='diff-preview-scroll'], pre:not(.composer-diff-simple-line pre)) { background-color: var(--codex-wallpaper-raised) !important; }
      body [data-app-shell-main-surface] :where([data-testid='webmcp-tool-scroll'], [data-summary-panel-variant]) { border-radius: var(--codex-wallpaper-radius) !important; box-shadow: inset 0 0 0 1px var(--codex-wallpaper-line-strong), 0 12px 34px rgb(0 0 0 / .18) !important; }
      body [data-pip-obstacle='thread-footer-leading'] { background-color: var(--codex-wallpaper-raised) !important; }
      body [data-composer-surface-variant] { background-color: var(--codex-wallpaper-raised) !important; border-radius: var(--codex-wallpaper-radius) !important; box-shadow: inset 0 0 0 1px var(--codex-wallpaper-line-strong), 0 12px 32px rgb(0 0 0 / .16) !important; }
      body [data-composer-surface-variant]:hover { background-color: color-mix(in srgb, var(--app-color-text-foreground, rgb(245 245 250)) 4%, var(--codex-wallpaper-raised)) !important; }
      body [data-composer-surface-variant]:focus-within { box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--app-color-text-foreground, rgb(245 245 250)) 32%, transparent), 0 12px 32px rgb(0 0 0 / .16) !important; }
      body [data-app-shell-main-content-top-fade] > [aria-hidden='true'] { background-image: linear-gradient(var(--codex-wallpaper-canvas), transparent) !important; }
      body [data-thread-scroll-footer] [class~='bg-surface']:not([data-composer-surface-variant], [data-composer-surface-variant] *, [data-pip-obstacle='thread-footer-leading'], [data-pip-obstacle='thread-footer-leading'] *) { background-color: transparent !important; }
      body [data-app-action-timeline-scroll] > :has(> [data-thread-scroll-footer])::before,
      body [data-app-action-timeline-scroll] > :has(> [data-thread-scroll-footer])::after { background: none !important; }
      body [data-app-shell-trailing-sidebar] [data-thread-find-target='review'] { background-color: transparent !important; }
      body [data-app-shell-trailing-sidebar] :is([data-thread-find-target='review'], [data-testid='diff-preview-scroll']) {
        --diffs-bg-addition: color-mix(in srgb, var(--color-codex-diff-added, transparent) 24%, transparent) !important;
        --diffs-bg-deletion: color-mix(in srgb, var(--color-codex-diff-deleted, transparent) 24%, transparent) !important;
      }
      body [data-app-shell-trailing-sidebar] [data-testid='diff-preview-scroll'] .composer-diff-simple-line { background-color: color-mix(in srgb, var(--app-color-background-surface-under, rgb(12 12 16)) 78%, transparent) !important; border-radius: var(--codex-wallpaper-radius-sm); }
      body :where([role='dialog'], [role='menu']) { background-color: var(--codex-wallpaper-panel) !important; }
      body [data-radix-popper-content-wrapper] { background-color: transparent !important; }
      body :where([role='menu'], [data-radix-popper-content-wrapper]) :is([role^='menuitem'], [data-radix-collection-item]) { border-radius: var(--codex-wallpaper-radius-sm); }
      body :where([role='menu'], [data-radix-popper-content-wrapper]) :is([role^='menuitem'], [data-radix-collection-item]):is(:hover, :focus-visible) { background-color: color-mix(in srgb, var(--app-color-text-foreground, white) 9%, transparent) !important; }
      body :where([role='menu'], [data-radix-popper-content-wrapper]) :is([aria-checked='true'], [aria-selected='true'], [data-state='checked']) { background-color: color-mix(in srgb, var(--app-color-accent-blue, rgb(51 156 255)) 18%, transparent) !important; }
      body :where([role='menu'], [data-radix-popper-content-wrapper]) :is([aria-disabled='true'], :disabled) { opacity: .48; cursor: not-allowed; }
    `;
}

export function candidateIdentity() {
  const hash = (value) =>
    createHash("sha256")
      .update(String(value).replace(/\r\n/g, "\n"))
      .digest("hex");
  return {
    runtimeHash: hash(createCodexWallpaperRuntime.toString()),
    styleHash: hash(
      createRuntimeStyles("codex-wallpaper-p1", "codex-wallpaper-p1-controls")
    ),
  };
}

export function runtimeSource(payload) {
  const css = createRuntimeStyles(
    "codex-wallpaper-p1",
    "codex-wallpaper-p1-controls"
  );
  return `(${createCodexWallpaperRuntime.toString()})(${JSON.stringify(
    payload
  )}, ${JSON.stringify(css)}, ${JSON.stringify(candidateIdentity())})`;
}

export function createCodexWallpaperRuntime(payload, runtimeCss, identity) {
  const rootId = "codex-wallpaper-p1";
  const controlsId = "codex-wallpaper-p1-controls";
  const styleId = "codex-wallpaper-p1-style";
  const configKey = "codex-wallpaper-p1-config";
  const dbName = "codex-wallpaper-media";
  const dbStore = "media";
  const performanceProfiles = {
    performance: { fps: 15, pauseWhenHidden: true },
    balanced: { fps: 30, pauseWhenHidden: true },
  };
  const interfaceStyleProperties = [
    "--codex-wallpaper-surface-opacity",
    "--codex-wallpaper-chat-opacity",
    "--codex-wallpaper-sidebar-opacity",
    "--codex-wallpaper-top-opacity",
    "--codex-wallpaper-right-opacity",
    "--codex-wallpaper-settings-opacity",
    "--codex-wallpaper-settings-canvas-opacity",
    "--codex-wallpaper-settings-card-opacity",
    "--codex-wallpaper-interface-blur",
    "--codex-wallpaper-line",
    "--codex-wallpaper-line-strong",
  ];

  const defaults = {
    enabled: true,
    active: { kind: "builtin", id: "aurora" },
    favorites: [],
    playlist: [],
    presets: [],
    activePresetId: null,
    settings: {
      dim: 18,
      blur: 0,
      opacity: 100,
      fitMode: "cover",
      surfaceOpacity: 72,
      interfaceBlur: 0,
      interfaceBorders: true,
      surfaceOverrides: {
        chat: null,
        sidebar: null,
        right: null,
        settings: null,
      },
      fps: 30,
      volume: 0,
      muted: true,
      rotationMinutes: 0,
      performanceProfile: "balanced",
      pauseWhenHidden: true,
    },
  };

  const settingDefinitions = {
    dim: { group: "appearance", type: "number", min: 0, max: 70 },
    blur: { group: "appearance", type: "number", min: 0, max: 24 },
    opacity: { group: "appearance", type: "number", min: 20, max: 100 },
    fitMode: {
      group: "appearance",
      type: "enum",
      values: ["cover", "contain"],
    },
    surfaceOpacity: {
      group: "appearance",
      type: "number",
      min: 20,
      max: 100,
    },
    interfaceBlur: { group: "appearance", type: "number", min: 0, max: 24 },
    interfaceBorders: { group: "appearance", type: "boolean" },
    surfaceOverrides: { group: "appearance", type: "surfaceOverrides" },
    fps: { group: "playback", type: "number", min: 1, max: 30 },
    volume: { group: "playback", type: "number", min: 0, max: 100 },
    muted: { group: "playback", type: "boolean" },
    rotationMinutes: {
      group: "playback",
      type: "number",
      min: 0,
      max: 120,
    },
    performanceProfile: {
      group: "playback",
      type: "enum",
      values: ["performance", "balanced", "custom"],
    },
    pauseWhenHidden: { group: "playback", type: "boolean" },
  };
  const settingKeys = new Set(Object.keys(settingDefinitions));
  const surfaceScopes = new Set(["chat", "sidebar", "right", "settings"]);

  function normalizePerformanceProfile(settings) {
    const profile = performanceProfiles[settings.performanceProfile];
    if (
      profile &&
      (Number(settings.fps) !== profile.fps ||
        Boolean(settings.pauseWhenHidden) !== profile.pauseWhenHidden)
    )
      settings.performanceProfile = "custom";
    return settings;
  }

  function cloneSettings(source = defaults.settings) {
    const next = structuredClone(defaults.settings);
    for (const key of settingKeys) {
      if (Object.hasOwn(source || {}, key))
        next[key] = structuredClone(source[key]);
    }
    next.surfaceOverrides = {};
    for (const scope of surfaceScopes) {
      next.surfaceOverrides[scope] = Object.hasOwn(
        source?.surfaceOverrides || {},
        scope
      )
        ? structuredClone(source.surfaceOverrides[scope])
        : defaults.settings.surfaceOverrides[scope];
    }
    return normalizePerformanceProfile(next);
  }

  function validateSettingsInput(input) {
    if (!input || typeof input !== "object" || Array.isArray(input))
      return { error: "设置结构无效" };
    const unknown = Object.keys(input).find((key) => !settingKeys.has(key));
    if (unknown) return { error: `未知设置字段：${unknown}` };
    const next = cloneSettings(input);
    for (const [key, definition] of Object.entries(settingDefinitions)) {
      const value = input[key];
      if (value === undefined) continue;
      if (definition.type === "number") {
        if (
          typeof value !== "number" ||
          !Number.isFinite(value) ||
          value < definition.min ||
          value > definition.max
        )
          return { error: `${key} 超出有效范围` };
      } else if (definition.type === "boolean") {
        if (typeof value !== "boolean") return { error: `${key} 类型无效` };
      } else if (definition.type === "enum") {
        if (!definition.values.includes(value))
          return { error: `${key} 值无效` };
      } else if (definition.type === "surfaceOverrides") {
        if (!value || typeof value !== "object" || Array.isArray(value))
          return { error: "surfaceOverrides 结构无效" };
        for (const [scope, override] of Object.entries(value)) {
          if (!surfaceScopes.has(scope))
            return { error: `surfaceOverrides 包含未知分区：${scope}` };
          if (
            override !== null &&
            (typeof override !== "number" ||
              !Number.isFinite(override) ||
              override < 0 ||
              override > 100)
          )
            return { error: `surfaceOverrides.${scope} 超出有效范围` };
        }
      }
    }
    return { value: next };
  }

  function readConfig() {
    try {
      const value = JSON.parse(localStorage.getItem(configKey) || "null");
      const settings = cloneSettings(value?.settings);
      if (typeof value?.settings?.muted !== "boolean")
        settings.muted = !(Number(settings.volume) > 0);
      if (
        value?.settings &&
        typeof value.settings.performanceProfile !== "string"
      )
        settings.performanceProfile =
          Number(settings.fps) === performanceProfiles.balanced.fps &&
          Boolean(settings.pauseWhenHidden) ===
            performanceProfiles.balanced.pauseWhenHidden
            ? "balanced"
            : "custom";
      return {
        ...defaults,
        ...(value && typeof value === "object" ? value : {}),
        active:
          value?.active && typeof value.active === "object"
            ? value.active
            : defaults.active,
        favorites: Array.isArray(value?.favorites) ? value.favorites : [],
        playlist: Array.isArray(value?.playlist) ? value.playlist : [],
        presets: Array.isArray(value?.presets)
          ? value.presets.filter(
              (preset) =>
                preset &&
                typeof preset === "object" &&
                typeof preset.id === "string" &&
                typeof preset.name === "string" &&
                preset.settings &&
                typeof preset.settings === "object"
            )
          : [],
        activePresetId:
          typeof value?.activePresetId === "string"
            ? value.activePresetId
            : null,
        settings,
      };
    } catch {
      return structuredClone(defaults);
    }
  }

  let config = readConfig();
  let sourcePayload = payload || { library: [] };
  let hostReady = false;
  let root = null;
  let panel = null;
  let layer = null;
  let media = null;
  let dim = null;
  let status = null;
  let playback = null;
  let currentObjectUrl = null;
  let rotationTimer = null;
  let activeGeneration = 0;
  let pendingRender = null;
  let sceneFitSupported = null;
  let imported = [];
  let database = null;
  const runtimeAssets = new Map();
  const pendingAssetRequests = new Set();
  const pendingPreviewRequests = new Set();
  const failedPreviewIds = new Set();
  const importedPreviewUrls = new Map();
  const assetTransfers = new Map();
  const channel = new BroadcastChannel("codex-wallpaper-p1");
  const previewObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      previewObserver.unobserve(entry.target);
      requestPreview(entry.target.dataset.previewId);
    }
  });
  let measuredFps = 0;
  let frameCount = 0;
  let frameWindowStartedAt = performance.now();
  let configSaveTimer = null;
  const pendingConfigFields = new Set();
  const libraryFilters = {
    query: "",
    type: "all",
    favoritesOnly: false,
  };
  let loadingEntryKey = null;
  const failedEntryKeys = new Set();

  function saveConfig() {
    if (configSaveTimer) clearTimeout(configSaveTimer);
    configSaveTimer = null;
    pendingConfigFields.clear();
    localStorage.setItem(configKey, JSON.stringify(config));
  }

  function scheduleConfigSave(field) {
    pendingConfigFields.add(field);
    if (configSaveTimer) clearTimeout(configSaveTimer);
    configSaveTimer = setTimeout(saveConfig, 100);
  }

  function flushConfigSave() {
    if (configSaveTimer) saveConfig();
  }

  function valuesEqual(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  function configChanges(previous, next) {
    return {
      enabled: previous.enabled !== next.enabled,
      identity: !valuesEqual(previous.active, next.active),
      favorites: !valuesEqual(previous.favorites, next.favorites),
      playlist: !valuesEqual(previous.playlist, next.playlist),
      presets:
        !valuesEqual(previous.presets, next.presets) ||
        previous.activePresetId !== next.activePresetId,
      appearance: Object.entries(settingDefinitions)
        .filter(([, definition]) => definition.group === "appearance")
        .some(
          ([key]) => !valuesEqual(previous.settings[key], next.settings[key])
        ),
      volume:
        previous.settings.volume !== next.settings.volume ||
        previous.settings.muted !== next.settings.muted,
      fps: previous.settings.fps !== next.settings.fps,
      profile:
        previous.settings.performanceProfile !==
        next.settings.performanceProfile,
      pauseWhenHidden:
        previous.settings.pauseWhenHidden !== next.settings.pauseWhenHidden,
      rotation:
        previous.settings.rotationMinutes !== next.settings.rotationMinutes,
    };
  }

  function openDatabase() {
    if (database) return Promise.resolve(database);
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(dbStore))
          db.createObjectStore(dbStore, { keyPath: "id" });
      };
      request.onsuccess = () => {
        database = request.result;
        resolve(database);
      };
      request.onerror = () => reject(request.error);
    });
  }

  function requestResult(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function loadImported() {
    const db = await openDatabase();
    const values = await requestResult(
      db.transaction(dbStore, "readonly").objectStore(dbStore).getAll()
    );
    imported = values
      .filter((item) => item?.blob)
      .sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
  }

  function mediaType(blob) {
    if (blob.type.startsWith("image/")) return "image";
    if (blob.type.startsWith("video/")) return "video";
    return null;
  }

  function libraryEntries() {
    return [
      ...imported.map((item) => ({
        kind: "imported",
        id: item.id,
        title: item.title,
        type: mediaType(item.blob),
        playable: true,
        fallback: false,
        previewDataUrl: importedPreviewUrls.get(item.id) || null,
        assetDataUrl: null,
        thumbnailKind: mediaType(item.blob),
        reason: null,
      })),
      ...(sourcePayload.library || []).map((item) => ({
        ...item,
        kind: "workshop",
      })),
    ];
  }

  function requestPreview(id) {
    const importedItem = imported.find((candidate) => candidate.id === id);
    const entry = sourcePayload.library?.find(
      (candidate) => candidate.id === id
    );
    if (
      !id ||
      entry?.previewDataUrl ||
      pendingPreviewRequests.has(id) ||
      failedPreviewIds.has(id) ||
      (!importedItem &&
        typeof globalThis.__codexWallpaperHostRequest !== "function")
    )
      return;
    pendingPreviewRequests.add(id);
    if (importedItem) {
      try {
        const url = URL.createObjectURL(importedItem.blob);
        importedPreviewUrls.set(id, url);
        receivePreview({
          id,
          previewDataUrl: url,
          fallback: true,
          thumbnailKind: mediaType(importedItem.blob),
        });
      } catch {
        receivePreviewError(id);
      }
      return;
    }
    globalThis.__codexWallpaperHostRequest(
      JSON.stringify({ type: "load-preview", id })
    );
  }

  function findEntry(active) {
    const entry = libraryEntries().find(
      (entry) => entry.kind === active.kind && entry.id === active.id
    );
    if (!entry) return null;
    return {
      ...entry,
      ...(runtimeAssets.get(`${entry.kind}:${entry.id}`) || {}),
    };
  }

  function entryKey(entry) {
    return `${entry.kind}:${entry.id}`;
  }

  function setStatus(message) {
    if (status) status.textContent = message;
  }

  function releasePlayback(target) {
    if (!target) return;
    target.cancelled = true;
    if (target.raf) cancelAnimationFrame(target.raf);
    target.video?.pause();
    target.video?.remove();
    target.scene?.destroy();
  }

  function releaseObjectUrl(url, keepUrl = null) {
    if (!url || url === keepUrl) return;
    for (const [key, asset] of runtimeAssets) {
      if (asset.assetUrl === url) runtimeAssets.delete(key);
    }
    URL.revokeObjectURL(url);
  }

  function clearImportedPreviews() {
    for (const url of importedPreviewUrls.values()) URL.revokeObjectURL(url);
    importedPreviewUrls.clear();
  }

  function cancelPendingRender() {
    const pending = pendingRender;
    pendingRender = null;
    pending?.cancel();
  }

  function revokePlayback() {
    cancelPendingRender();
    measuredFps = 0;
    frameCount = 0;
    frameWindowStartedAt = performance.now();
    releasePlayback(playback);
    releaseObjectUrl(currentObjectUrl);
    playback = null;
    currentObjectUrl = null;
  }

  function commitMedia(next, nextPlayback = null, objectUrl = null) {
    const previousMedia = media;
    const previousPlayback = playback;
    const previousObjectUrl = currentObjectUrl;
    if (next.parentNode !== layer) layer.insertBefore(next, dim);
    next.classList.remove("staged");
    media = next;
    playback = nextPlayback;
    currentObjectUrl = objectUrl;
    previousMedia?.remove();
    releasePlayback(previousPlayback);
    releaseObjectUrl(previousObjectUrl, objectUrl);
    applyVisualSettings();
  }

  function stageMedia() {
    const next = document.createElement("div");
    next.className = "media staged";
    layer.insertBefore(next, dim);
    return next;
  }

  function trackPending(cancel, resume = null) {
    const pending = { cancel, resume };
    pendingRender = pending;
    return pending;
  }

  function finishPending(pending) {
    if (pendingRender === pending) pendingRender = null;
  }

  function stopRotation() {
    if (rotationTimer) clearInterval(rotationTimer);
    rotationTimer = null;
  }

  function activeMediaType() {
    if (config.active.kind === "builtin") return "builtin";
    return findEntry(config.active)?.type || "missing";
  }

  function effectiveVolume() {
    return config.settings.muted
      ? 0
      : Math.max(0, Math.min(1, Number(config.settings.volume) / 100));
  }

  function performanceSummary() {
    const scene = `Scene 上限 ${config.settings.fps} FPS · ${
      config.settings.pauseWhenHidden ? "不可见时暂停" : "不可见时不暂停"
    }`;
    const type = activeMediaType();
    if (type === "scene") return `参数：${scene}`;
    if (type === "video") return `当前视频按源播放；已保存 ${scene}`;
    if (type === "image") return `当前图片不使用帧率；已保存 ${scene}`;
    if (type === "web") return `当前 Web 无法控帧；已保存 ${scene}`;
    return `当前渐变没有帧率；已保存 ${scene}`;
  }

  function performanceTradeoff() {
    if (config.settings.performanceProfile === "performance")
      return "取舍：降低 Scene 绘制上限以减少渲染活动，画面连续性可能低于 30 FPS。";
    if (config.settings.performanceProfile === "balanced")
      return "取舍：保留现有 30 FPS 上限，优先画面连续性。";
    return "取舍：使用手动参数组合，不再自动套用命名档位。";
  }

  function playbackCapabilityText() {
    const type = activeMediaType();
    if (type === "image") return "图片稳定显示后不持续绘制；帧率不适用。";
    if (type === "video")
      return "视频按源文件解码并直接合成；性能档限制 Scene 上限，不伪造视频绘制帧率。";
    if (type === "scene")
      return "Scene 使用现有渲染器的 15/30 FPS 上限；不提供未验证的画质档。";
    if (type === "web")
      return "Web iframe 内部帧率和暂停无法由父页面可靠控制。";
    return "内置渐变没有媒体解码或帧率。";
  }

  function hasSurfaceOverride(scope) {
    const value = config.settings.surfaceOverrides?.[scope];
    return (
      value !== null && value !== undefined && Number.isFinite(Number(value))
    );
  }

  function surfaceOpacityValue(scope) {
    const globalOpacity = Math.max(
      20,
      Math.min(100, Number(config.settings.surfaceOpacity) || 72)
    );
    const overrides = config.settings.surfaceOverrides || {};
    if (hasSurfaceOverride(scope))
      return Math.max(0, Math.min(100, Number(overrides[scope])));
    const factor = { chat: 0.25, sidebar: 1, right: 0, settings: 1.3 }[scope];
    return Math.min(100, Math.round(globalOpacity * (factor ?? 1)));
  }

  function applyInterfaceAppearance() {
    const style = document.documentElement.style;
    const globalOpacity = Math.max(
      20,
      Math.min(100, Number(config.settings.surfaceOpacity) || 72)
    );
    style.setProperty("--codex-wallpaper-surface-opacity", `${globalOpacity}%`);
    style.setProperty(
      "--codex-wallpaper-chat-opacity",
      `${surfaceOpacityValue("chat")}%`
    );
    style.setProperty(
      "--codex-wallpaper-sidebar-opacity",
      `${surfaceOpacityValue("sidebar")}%`
    );
    style.setProperty(
      "--codex-wallpaper-top-opacity",
      `${hasSurfaceOverride("sidebar") ? surfaceOpacityValue("sidebar") : 0}%`
    );
    document.documentElement.toggleAttribute(
      "data-codex-wallpaper-top-surface",
      hasSurfaceOverride("sidebar")
    );
    style.setProperty(
      "--codex-wallpaper-right-opacity",
      `${surfaceOpacityValue("right")}%`
    );
    const settingsOpacity = surfaceOpacityValue("settings");
    style.setProperty(
      "--codex-wallpaper-settings-opacity",
      `${settingsOpacity}%`
    );
    style.setProperty(
      "--codex-wallpaper-settings-canvas-opacity",
      `${Math.round(settingsOpacity * 0.68)}%`
    );
    style.setProperty(
      "--codex-wallpaper-settings-card-opacity",
      `${Math.round(settingsOpacity * 0.45)}%`
    );
    const blur = Math.max(
      0,
      Math.min(24, Number(config.settings.interfaceBlur) || 0)
    );
    style.setProperty(
      "--codex-wallpaper-interface-blur",
      blur > 0 ? `blur(${blur}px)` : "none"
    );
    if (config.settings.interfaceBorders) {
      style.removeProperty("--codex-wallpaper-line");
      style.removeProperty("--codex-wallpaper-line-strong");
    } else {
      style.setProperty("--codex-wallpaper-line", "transparent");
      style.setProperty("--codex-wallpaper-line-strong", "transparent");
    }
  }

  function clearInterfaceAppearance() {
    for (const property of interfaceStyleProperties)
      document.documentElement.style.removeProperty(property);
    document.documentElement.removeAttribute(
      "data-codex-wallpaper-top-surface"
    );
  }

  function applyVisualSettings() {
    applyInterfaceAppearance();
    if (!layer || !media || !dim) return;
    layer.style.opacity = String(config.settings.opacity / 100);
    media.style.filter = config.settings.blur
      ? `blur(${config.settings.blur}px)`
      : "";
    dim.style.background = `rgb(4 6 15 / ${config.settings.dim / 100})`;
    const fit = config.settings.fitMode === "contain" ? "contain" : "cover";
    media.dataset.fit = fit;
    for (const element of media.querySelectorAll("img, video, canvas"))
      element.style.objectFit = fit;
    playback?.setFit?.(fit);
  }

  function applyPlaybackSettings(change) {
    const volume = effectiveVolume();
    if (change.volume && playback?.video) {
      playback.video.muted = volume === 0;
      playback.video.volume = volume;
    }
    if (change.volume) playback?.setVolume?.(volume);
    if (change.fps) playback?.setFps?.(Number(config.settings.fps));
  }

  function applyHiddenPolicy() {
    if (!playback) return;
    if (
      config.settings.pauseWhenHidden &&
      document.visibilityState === "hidden"
    ) {
      playback.video?.pause();
      playback.pause?.();
      if (playback.raf) cancelAnimationFrame(playback.raf);
      return;
    }
    playback.video?.play().catch(() => {});
    playback.resume?.();
    playback.start?.();
  }

  function applyCurrentSettings() {
    applyVisualSettings();
    applyPlaybackSettings({ volume: true, fps: true });
    applyHiddenPolicy();
    syncSettingControls();
    scheduleRotation();
  }

  function markSettingsChanged(performance = false) {
    config.activePresetId = null;
    if (performance) {
      config.settings.performanceProfile = "custom";
      pendingConfigFields.add("performanceProfile");
    }
    syncPresetUi();
  }

  function syncSettingControls() {
    if (!panel) return;
    for (const input of panel.querySelectorAll(".range input")) {
      const key = input.dataset.setting;
      if (!key) continue;
      input.value = String(config.settings[key]);
      const output = input.closest(".range")?.querySelector("output");
      if (output)
        output.textContent = `${input.value}${output.dataset.unit || ""}`;
    }
    for (const input of panel.querySelectorAll("[data-setting-toggle]")) {
      const key = input.dataset.settingToggle;
      input.checked = Boolean(config.settings[key]);
    }
    for (const select of panel.querySelectorAll("[data-setting-select]")) {
      const key = select.dataset.settingSelect;
      select.value = config.settings[key];
    }
    for (const override of panel.querySelectorAll("[data-surface-override]")) {
      const scope = override.dataset.surfaceOverride;
      const enabled = hasSurfaceOverride(scope);
      override.checked = enabled;
      const input = panel.querySelector(
        `[data-surface-override-value="${scope}"]`
      );
      const restore = panel.querySelector(`[data-restore-surface="${scope}"]`);
      if (input) {
        input.disabled = !enabled;
        input.value = String(surfaceOpacityValue(scope));
        const output = input
          .closest(".surface-override-controls")
          ?.querySelector("output");
        if (output) output.textContent = `${input.value}%`;
      }
      if (restore) restore.disabled = !enabled;
    }
    const profile = panel.querySelector("[data-playback-profile]");
    if (profile) profile.value = config.settings.performanceProfile;
    const summary = panel.querySelector("[data-performance-summary]");
    if (summary) summary.textContent = performanceSummary();
    const tradeoff = panel.querySelector("[data-performance-tradeoff]");
    if (tradeoff) tradeoff.textContent = performanceTradeoff();
    const capability = panel.querySelector("[data-playback-capability]");
    if (capability) capability.textContent = playbackCapabilityText();
  }

  function entryStatusText(entry) {
    const key = entryKey(entry);
    if (loadingEntryKey === key) return `${entry.type} · 加载中`;
    if (failedEntryKeys.has(key)) return `${entry.type} · 加载失败`;
    const state = entryState(entry);
    if (state === "scene-native") return "scene · 原生渲染";
    if (state.endsWith("-on-demand")) return `${entry.type} · 按需加载`;
    if (state === "web-offline") return "web · 离线沙箱";
    if (entry.type === "scene" || entry.type === "web")
      return `${entry.type} · 预览降级`;
    if (entry.playable)
      return entry.type === "video"
        ? "video · 原生播放"
        : `${entry.type} · 原生显示`;
    return `${entry.type} · 不可播放`;
  }

  function updateCardState(card) {
    const key = {
      kind: card.dataset.entryKind,
      id: card.dataset.entryId,
    };
    const selected =
      config.active.kind === key.kind && config.active.id === key.id;
    const favorite = isFavorite(key);
    const queued = inPlaylist(key);
    card.dataset.selected = String(selected);
    const use = card.querySelector("[data-entry-action='use']");
    const favoriteButton = card.querySelector("[data-entry-action='favorite']");
    const queueButton = card.querySelector("[data-entry-action='queue']");
    const current = card.querySelector(".card-current");
    const status = card.querySelector("[data-card-status]");
    if (use) use.setAttribute("aria-pressed", String(selected));
    if (current) current.hidden = !selected;
    if (favoriteButton) {
      favoriteButton.textContent = favorite ? "★" : "☆";
      favoriteButton.setAttribute("aria-pressed", String(favorite));
    }
    if (queueButton) {
      queueButton.textContent = queued ? "移除轮播" : "加入轮播";
      queueButton.setAttribute("aria-pressed", String(queued));
    }
    if (status) {
      const entry = libraryEntries().find(
        (candidate) => candidate.kind === key.kind && candidate.id === key.id
      );
      if (entry) status.textContent = entryStatusText(entry);
    }
  }

  function syncCardStates() {
    if (!panel) return;
    for (const item of panel.querySelectorAll(".card")) updateCardState(item);
  }

  function applyLibraryFilters() {
    if (!panel) return;
    const query = libraryFilters.query.trim().toLocaleLowerCase();
    let visible = 0;
    const cards = [...panel.querySelectorAll(".card")];
    for (const item of cards) {
      const matchesQuery = !query
        ? true
        : item.dataset.entryTitle.toLocaleLowerCase().includes(query);
      const matchesType =
        libraryFilters.type === "all" ||
        item.dataset.entryType === libraryFilters.type;
      const matchesFavorite =
        !libraryFilters.favoritesOnly ||
        item
          .querySelector("[data-entry-action='favorite']")
          ?.getAttribute("aria-pressed") === "true";
      item.hidden = !(matchesQuery && matchesType && matchesFavorite);
      const visual = item.querySelector(".thumb");
      if (item.hidden) {
        previewObserver.unobserve(visual);
      } else {
        visible += 1;
        if (
          visual.dataset.previewId &&
          !pendingPreviewRequests.has(visual.dataset.previewId) &&
          !failedPreviewIds.has(visual.dataset.previewId)
        )
          previewObserver.observe(visual);
      }
    }
    const result = panel.querySelector("[data-library-result]");
    if (result) result.textContent = `显示 ${visible} / ${cards.length} 项`;
    requestAnimationFrame(requestVisiblePreviews);
  }

  function requestVisiblePreviews() {
    if (!panel?.classList.contains("open")) return;
    const panelRect = panel.getBoundingClientRect();
    for (const item of panel.querySelectorAll(".card:not([hidden])")) {
      const visual = item.querySelector(".thumb[data-preview-id]");
      if (!visual) continue;
      const visualRect = visual.getBoundingClientRect();
      if (
        visualRect.bottom >= panelRect.top &&
        visualRect.top <= panelRect.bottom
      )
        requestPreview(visual.dataset.previewId);
    }
  }

  function renderRuntimeStatus() {
    const active = findEntry(config.active);
    if (!active) {
      setStatus("已跳过缺失的壁纸");
      return;
    }
    const key = entryKey(active);
    if (loadingEntryKey === key) {
      setStatus(`正在加载：${active.title}`);
      return;
    }
    if (failedEntryKeys.has(key)) {
      setStatus(`${active.title} · 加载失败`);
      return;
    }
    setStatus(`${active.title} · ${entryStatusText(active)}`);
  }

  function syncPlaylistSummary() {
    const summary = panel?.querySelector(".playlist-summary");
    if (!summary) return;
    const queued = playlistEntries();
    summary.textContent = queued.length
      ? `轮播：${queued.map((entry) => entry.title).join(" · ")}`
      : "轮播列表为空";
  }

  function syncConfigUi(change) {
    if (change.appearance) applyVisualSettings();
    applyPlaybackSettings(change);
    if (change.favorites || change.playlist) {
      syncCardStates();
      if (change.favorites) applyLibraryFilters();
    }
    if (change.playlist) syncPlaylistSummary();
    syncSettingControls();
    if (change.presets) renderPresetList();
    if (change.pauseWhenHidden) applyHiddenPolicy();
    if (change.rotation || change.playlist) scheduleRotation();
  }

  async function applyConfigChange(change) {
    if (!config.enabled) {
      if (root) await disable(false);
      return state();
    }
    if (!root) {
      mount();
      await loadImported();
      await applyActive();
      return state();
    }
    if (change.enabled || change.identity) {
      await applyActive();
      return state();
    }
    syncConfigUi(change);
    return state();
  }

  function hasCurrentFrame() {
    return Boolean(
      media &&
      (media.classList.contains("builtin") ||
        media.querySelector("img, video, canvas, iframe, .scene-host.ready"))
    );
  }

  function recoverFailedMedia(message, previewUrl = null) {
    if (hasCurrentFrame()) {
      setStatus(`${message}，已保留当前画面`);
      return;
    }
    if (previewUrl) {
      showImage(previewUrl, `${message}，已使用预览`);
      return;
    }
    showGradient(`${message}，已使用静态背景`);
  }

  async function configureHost() {
    hostReady = true;
    pendingAssetRequests.clear();
    pendingPreviewRequests.clear();
    if (root) await applyActive();
    return state();
  }

  function showGradient(message) {
    const next = document.createElement("div");
    next.className = "media builtin";
    commitMedia(next);
    if (message) setStatus(message);
  }

  function showImage(url, message, objectUrl = null) {
    const generation = activeGeneration;
    const next = stageMedia();
    const image = document.createElement("img");
    image.alt = "";
    next.append(image);
    let cancelled = false;
    let settled = false;
    const pending = trackPending(() => {
      if (cancelled) return;
      cancelled = true;
      image.onerror = null;
      next.remove();
      releaseObjectUrl(objectUrl, currentObjectUrl);
    });
    const fail = () => {
      if (settled) return;
      settled = true;
      finishPending(pending);
      if (cancelled || generation !== activeGeneration) {
        pending.cancel();
        return;
      }
      next.remove();
      releaseObjectUrl(objectUrl, currentObjectUrl);
      recoverFailedMedia("素材加载失败");
    };
    const commit = () => {
      if (settled) return;
      settled = true;
      finishPending(pending);
      if (cancelled || generation !== activeGeneration) {
        pending.cancel();
        return;
      }
      commitMedia(next, null, objectUrl);
      if (message) setStatus(message);
    };
    image.onerror = fail;
    image.src = url;
    image.decode().then(commit).catch(fail);
  }

  function showVideo(url, message, objectUrl = null, previewUrl = null) {
    const generation = activeGeneration;
    const next = stageMedia();
    const video = document.createElement("video");
    video.src = url;
    video.loop = true;
    video.playsInline = true;
    video.preload = "auto";
    const volume = effectiveVolume();
    video.muted = volume === 0;
    video.volume = volume;
    next.append(video);
    let cancelled = false;
    let settled = false;
    let frameRequest = 0;
    let resume = null;
    const current = {
      cancelled: false,
      video,
    };
    const pending = trackPending(
      () => {
        if (cancelled) return;
        cancelled = true;
        video.onerror = null;
        video.onloadedmetadata = null;
        if (frameRequest) video.cancelVideoFrameCallback?.(frameRequest);
        releasePlayback(current);
        next.remove();
        releaseObjectUrl(objectUrl, currentObjectUrl);
      },
      () => resume?.()
    );
    const fail = () => {
      if (settled) return;
      settled = true;
      finishPending(pending);
      if (cancelled || generation !== activeGeneration) {
        pending.cancel();
        return;
      }
      pending.cancel();
      recoverFailedMedia("视频加载失败", previewUrl);
    };
    const drawFirstFrame = () => {
      if (settled) return;
      if (cancelled || generation !== activeGeneration) {
        pending.cancel();
        return;
      }
      if (!video.videoWidth || !video.videoHeight || video.readyState < 2)
        return;
      settled = true;
      finishPending(pending);
      current.cancelled = false;
      commitMedia(next, current, objectUrl);
      if (
        config.settings.pauseWhenHidden &&
        document.visibilityState === "hidden"
      )
        video.pause();
      if (message) setStatus(message);
    };
    const waitForPresentedFrame = () => {
      if (frameRequest) return;
      if (typeof video.requestVideoFrameCallback === "function") {
        frameRequest = video.requestVideoFrameCallback(() => {
          frameRequest = 0;
          drawFirstFrame();
        });
      } else {
        video.addEventListener("loadeddata", drawFirstFrame, { once: true });
      }
    };
    const drawLoadedFrame = () => {
      if (
        config.settings.pauseWhenHidden &&
        document.visibilityState === "hidden"
      )
        drawFirstFrame();
      else requestAnimationFrame(drawFirstFrame);
    };
    resume = () => {
      if (settled || cancelled || generation !== activeGeneration) return;
      if (video.readyState >= 2) drawLoadedFrame();
      video
        .play()
        .then(waitForPresentedFrame)
        .catch(() => {});
    };
    video.onloadedmetadata = () => {
      if (cancelled || generation !== activeGeneration) {
        pending.cancel();
        return;
      }
      waitForPresentedFrame();
    };
    video.onerror = () => {
      fail();
    };
    video
      .play()
      .then(() => {
        if (cancelled || generation !== activeGeneration) {
          pending.cancel();
          return;
        }
        if (
          config.settings.pauseWhenHidden &&
          document.visibilityState === "hidden"
        ) {
          video.pause();
          if (video.readyState >= 2) drawLoadedFrame();
          else {
            video.addEventListener("loadeddata", drawLoadedFrame, {
              once: true,
            });
            video.addEventListener("seeked", drawLoadedFrame, {
              once: true,
            });
            try {
              video.currentTime = 0.001;
            } catch {}
          }
        }
      })
      .catch(() => {
        if (video.readyState >= 2) drawLoadedFrame();
        else {
          video.addEventListener("loadeddata", drawLoadedFrame, {
            once: true,
          });
          video.addEventListener("seeked", drawLoadedFrame, { once: true });
          try {
            video.currentTime = 0.001;
          } catch {}
        }
      });
    if (message) setStatus(message);
  }

  function bytesFromBase64(encoded) {
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1)
      bytes[index] = binary.charCodeAt(index);
    return bytes;
  }

  function bytesFromDataUrl(url) {
    return bytesFromBase64(String(url).split(",", 2)[1] || "");
  }

  async function sceneBytes(assetUrl) {
    if (assetUrl.startsWith("data:")) return bytesFromDataUrl(assetUrl);
    const response = await fetch(assetUrl);
    if (!response.ok) throw new Error(`Scene asset ${response.status}`);
    return new Uint8Array(await response.arrayBuffer());
  }

  function showScene(entry, assetUrl, previewUrl) {
    const generation = activeGeneration;
    const engine = globalThis.WebWallGL;
    if (!engine?.createScene || !engine?.bytesSource) {
      if (previewUrl)
        showImage(previewUrl, `${entry.title} · Scene 渲染器不可用，预览降级`);
      else recoverFailedMedia(`${entry.title} · Scene 渲染器不可用`);
      return;
    }
    const next = stageMedia();
    const host = document.createElement("div");
    host.className = "scene-host";
    next.append(host);
    const instance = engine.createScene(host, {
      fps: Math.max(1, Math.min(30, Number(config.settings.fps) || 30)),
      volume: effectiveVolume(),
      fit: config.settings.fitMode === "contain" ? "contain" : "cover",
    });
    sceneFitSupported = typeof instance.setFit === "function";
    let cancelled = false;
    let settled = false;
    const current = {
      cancelled: false,
      scene: instance,
      supportsFit: typeof instance.setFit === "function",
      pause: () => instance.pause(),
      resume: () => instance.resume(),
      setFps: (fps) => instance.setFps?.(fps),
      setVolume: (volume) => instance.setVolume?.(volume),
      setFit: (fit) => instance.setFit?.(fit),
    };
    const pending = trackPending(() => {
      if (cancelled) return;
      cancelled = true;
      releasePlayback(current);
      next.remove();
    });
    const fail = () => {
      if (settled) return;
      settled = true;
      finishPending(pending);
      pending.cancel();
      if (generation === activeGeneration)
        recoverFailedMedia(`${entry.title} · Scene 加载失败`, previewUrl);
    };
    sceneBytes(assetUrl)
      .then((bytes) => {
        if (cancelled || generation !== activeGeneration) throw null;
        return instance.load(
          engine.bytesSource(
            bytes,
            { type: "scene", file: "scene.pkg" },
            entry.id
          )
        );
      })
      .then(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve))
          )
      )
      .then(() => {
        if (settled) return;
        if (cancelled || generation !== activeGeneration) {
          pending.cancel();
          return;
        }
        settled = true;
        finishPending(pending);
        host.classList.add("ready");
        commitMedia(next, current);
        if (
          config.settings.pauseWhenHidden &&
          document.visibilityState === "hidden"
        )
          instance.pause();
        setStatus(`${entry.title} · Scene`);
      })
      .catch(fail);
  }

  function showWeb(entry) {
    const generation = activeGeneration;
    const next = stageMedia();
    const frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "allow-scripts");
    frame.setAttribute("referrerpolicy", "no-referrer");
    let cancelled = false;
    let settled = false;
    const pending = trackPending(() => {
      if (cancelled) return;
      cancelled = true;
      frame.onload = null;
      next.remove();
    });
    frame.onload = () => {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (settled) return;
          if (cancelled || generation !== activeGeneration) {
            pending.cancel();
            return;
          }
          settled = true;
          finishPending(pending);
          commitMedia(next);
          setStatus(`${entry.title} · Web 离线沙箱`);
        })
      );
    };
    next.append(frame);
    frame.srcdoc = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; script-src 'none'">${entry.webHtml}`;
  }

  async function applyActive() {
    if (!root) return;
    const generation = ++activeGeneration;
    cancelPendingRender();
    stopRotation();
    const active = config.active || defaults.active;
    if (active.kind === "builtin") {
      showGradient("内置渐变");
    } else {
      const entry = findEntry(active);
      if (!entry) {
        setStatus("已跳过缺失的壁纸，已保留当前画面");
      } else if (entry.kind === "imported") {
        const db = await openDatabase();
        if (generation !== activeGeneration) return state();
        const item = await requestResult(
          db.transaction(dbStore, "readonly").objectStore(dbStore).get(entry.id)
        );
        if (generation !== activeGeneration) return state();
        if (!item?.blob) {
          setStatus("已跳过缺失的素材，已保留当前画面");
        } else {
          const url = URL.createObjectURL(item.blob);
          const kind = mediaType(item.blob);
          if (kind === "video") {
            showVideo(url, `${entry.title} · 视频`, url);
          } else {
            showImage(url, `${entry.title} · 图片`, url);
          }
        }
      } else {
        const assetUrl = entry.assetUrl || entry.assetDataUrl;
        const previewUrl = entry.previewDataUrl;
        if (entry.type === "web" && !entry.webHtml) {
          if (previewUrl)
            showImage(previewUrl, `${entry.title} · Web 预览降级`);
          else recoverFailedMedia(`${entry.title} · Web 离线文件不可用`);
          scheduleRotation();
          renderPanel();
          return;
        }
        if (!assetUrl && !entry.webHtml) {
          if (!pendingAssetRequests.has(entry.id)) {
            pendingAssetRequests.add(entry.id);
            if (typeof globalThis.__codexWallpaperHostRequest === "function") {
              setStatus(`${entry.title} · 正在载入`);
              globalThis.__codexWallpaperHostRequest(
                JSON.stringify({ type: "load-asset", id: entry.id })
              );
            }
          }
          scheduleRotation();
          renderPanel();
          return;
        }
        const url = assetUrl || previewUrl;
        if (!url && !entry.webHtml) {
          setStatus(`${entry.title} · 无可用画面，已保留当前画面`);
        } else if (entry.type === "scene" && assetUrl) {
          showScene(entry, assetUrl, previewUrl);
        } else if (entry.type === "web" && entry.webHtml) {
          showWeb(entry);
        } else if (assetUrl && entry.type === "video") {
          showVideo(
            url,
            `${entry.title} · 视频`,
            url.startsWith("blob:") ? url : null,
            previewUrl
          );
        } else {
          showImage(
            url,
            assetUrl
              ? `${entry.title} · ${entry.type}`
              : `${entry.title} · 预览降级`,
            url?.startsWith("blob:") ? url : null
          );
        }
      }
    }
    scheduleRotation();
    renderPanel();
  }

  function playlistEntries() {
    const all = libraryEntries();
    return config.playlist
      .map((key) =>
        all.find((entry) => entry.kind === key.kind && entry.id === key.id)
      )
      .filter(
        (entry) =>
          entry &&
          (entry.kind === "imported" ||
            entry.assetDataUrl ||
            entry.previewDataUrl ||
            entry.webHtml)
      );
  }

  function scheduleRotation() {
    stopRotation();
    const minutes = Number(config.settings.rotationMinutes);
    const entries = playlistEntries();
    if (!config.enabled || minutes <= 0 || entries.length < 2) return;
    rotationTimer = setInterval(
      () => {
        const current = entries.findIndex(
          (entry) =>
            entry.kind === config.active.kind && entry.id === config.active.id
        );
        const next = entries[(current + 1 + entries.length) % entries.length];
        config.active = { kind: next.kind, id: next.id };
        saveConfig();
        applyActive();
      },
      minutes * 60 * 1000
    );
  }

  function isFavorite(entry) {
    return config.favorites.some(
      (item) => item.kind === entry.kind && item.id === entry.id
    );
  }

  function inPlaylist(entry) {
    return config.playlist.some(
      (item) => item.kind === entry.kind && item.id === entry.id
    );
  }

  function toggleKey(listName, entry) {
    const list = config[listName];
    const index = list.findIndex(
      (item) => item.kind === entry.kind && item.id === entry.id
    );
    if (index >= 0) list.splice(index, 1);
    else list.push({ kind: entry.kind, id: entry.id });
    saveConfig();
    const item = panel?.querySelector(
      `.card[data-entry-kind="${entry.kind}"][data-entry-id="${entry.id}"]`
    );
    if (item) updateCardState(item);
    if (listName === "favorites") applyLibraryFilters();
    if (listName === "playlist") {
      syncPlaylistSummary();
      scheduleRotation();
    }
  }

  function entryState(entry) {
    if (
      entry.kind === "workshop" &&
      entry.type !== "web" &&
      !entry.webHtml &&
      !entry.assetDataUrl &&
      !runtimeAssets.has(entryKey(entry)) &&
      (!entry.playable || entry.reason === "asset-not-loaded")
    )
      return `${entry.type}-on-demand`;
    if (entry.type === "scene")
      return entry.playable
        ? "scene-native"
        : entry.reason || "scene-preview-fallback";
    if (entry.type === "web")
      return entry.webHtml
        ? "web-offline"
        : entry.reason || "web-preview-fallback";
    return entry.playable
      ? entry.type
      : entry.reason || "asset-too-large-or-missing";
  }

  function renderThumb(entry, visual) {
    visual.replaceChildren();
    visual.removeAttribute("data-preview-id");
    const visualUrl = entry.previewDataUrl || entry.assetDataUrl;
    if (visualUrl) {
      const useVideo =
        entry.thumbnailKind === "video" ||
        (entry.type === "video" && !entry.previewDataUrl);
      const thumbnail = document.createElement(useVideo ? "video" : "img");
      thumbnail.src = visualUrl;
      if (useVideo) {
        thumbnail.muted = true;
        thumbnail.playsInline = true;
        thumbnail.preload = "metadata";
        thumbnail.onloadedmetadata = () => {
          try {
            thumbnail.currentTime = 0.001;
          } catch {}
        };
        thumbnail.onloadeddata = () => thumbnail.pause();
      } else {
        thumbnail.alt = "";
      }
      thumbnail.onerror = () => {
        failedPreviewIds.add(entry.id);
        thumbnail.remove();
        visual.textContent = entry.type.toUpperCase();
        visual.dataset.previewId = entry.id;
        previewObserver.observe(visual);
      };
      visual.append(thumbnail);
      return;
    }
    visual.textContent = entry.type.toUpperCase();
    visual.dataset.previewId = entry.id;
    previewObserver.observe(visual);
  }

  function card(entry) {
    const item = document.createElement("article");
    item.className = "card";
    item.dataset.entryKind = entry.kind;
    item.dataset.entryId = entry.id;
    item.dataset.entryTitle = entry.title;
    item.dataset.entryType = entry.type;
    const selected =
      config.active.kind === entry.kind && config.active.id === entry.id;
    item.dataset.selected = String(selected);
    const visual = document.createElement("div");
    visual.className = "thumb";
    renderThumb(entry, visual);
    const current = document.createElement("span");
    current.className = "card-current";
    current.textContent = "当前";
    current.hidden = !selected;
    const title = document.createElement("strong");
    title.textContent = entry.title;
    const meta = document.createElement("small");
    meta.dataset.cardStatus = "";
    meta.textContent = entryStatusText(entry);
    const actions = document.createElement("div");
    actions.className = "card-actions";
    const use = document.createElement("button");
    use.textContent = "使用";
    use.dataset.entryAction = "use";
    use.setAttribute("aria-pressed", String(selected));
    use.onclick = () => {
      loadingEntryKey = entryKey(entry);
      failedEntryKeys.delete(entryKey(entry));
      config.active = { kind: entry.kind, id: entry.id };
      saveConfig();
      requestPreview(entry.id);
      syncCardStates();
      renderRuntimeStatus();
      applyActive().finally(() => {
        if (
          loadingEntryKey === entryKey(entry) &&
          (!pendingAssetRequests.has(entry.id) ||
            typeof globalThis.__codexWallpaperHostRequest !== "function")
        )
          loadingEntryKey = null;
        syncCardStates();
        renderRuntimeStatus();
      });
    };
    const favorite = document.createElement("button");
    favorite.textContent = isFavorite(entry) ? "★" : "☆";
    favorite.dataset.entryAction = "favorite";
    favorite.title = "收藏";
    favorite.setAttribute("aria-pressed", String(isFavorite(entry)));
    favorite.onclick = () => toggleKey("favorites", entry);
    const queue = document.createElement("button");
    queue.textContent = inPlaylist(entry) ? "移除轮播" : "加入轮播";
    queue.dataset.entryAction = "queue";
    queue.setAttribute("aria-pressed", String(inPlaylist(entry)));
    queue.onclick = () => toggleKey("playlist", entry);
    actions.append(use, favorite, queue);
    item.append(current, visual, title, meta, actions);
    return item;
  }

  function range(label, key, min, max, step, unit = "") {
    const row = document.createElement("label");
    row.className = "range";
    const heading = document.createElement("span");
    const value = document.createElement("output");
    value.dataset.unit = unit;
    const input = document.createElement("input");
    input.type = "range";
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(config.settings[key]);
    input.dataset.setting = key;
    const renderLabel = () => {
      value.textContent = `${input.value}${unit}`;
    };
    input.oninput = () => {
      config.settings[key] = Number(input.value);
      markSettingsChanged(key === "fps");
      if (key === "volume" && Number(input.value) > 0)
        config.settings.muted = false;
      if (key === "fps") config.settings.performanceProfile = "custom";
      renderLabel();
      applyVisualSettings();
      applyPlaybackSettings({
        volume: key === "volume",
        fps: key === "fps",
      });
      if (key === "rotationMinutes") scheduleRotation();
      scheduleConfigSave(key);
      if (key === "fps" || key === "volume") {
        if (key === "fps") scheduleConfigSave("performanceProfile");
        if (key === "volume") scheduleConfigSave("muted");
        syncSettingControls();
      }
    };
    input.onchange = flushConfigSave;
    input.onblur = flushConfigSave;
    heading.textContent = label;
    row.append(heading, value, input);
    renderLabel();
    return row;
  }

  function settingToggle(label, key, { disabled = false, hint = "" } = {}) {
    const row = document.createElement("label");
    row.className = "setting-toggle";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = Boolean(config.settings[key]);
    input.disabled = disabled;
    if (hint) input.title = hint;
    input.dataset.setting = key;
    input.dataset.settingToggle = key;
    const text = document.createElement("span");
    text.textContent = hint ? `${label}（${hint}）` : label;
    input.onchange = () => {
      config.settings[key] = input.checked;
      markSettingsChanged(key === "pauseWhenHidden");
      if (key === "pauseWhenHidden")
        config.settings.performanceProfile = "custom";
      applyPlaybackSettings({ volume: key === "muted" });
      if (key === "pauseWhenHidden") applyHiddenPolicy();
      if (key === "interfaceBorders") applyVisualSettings();
      saveConfig();
      syncSettingControls();
    };
    row.append(input, text);
    return row;
  }

  function settingSelect(
    label,
    key,
    options,
    { disabled = false, hint = "" } = {}
  ) {
    const row = document.createElement("label");
    row.className = "profile-control";
    const text = document.createElement("span");
    text.textContent = hint ? `${label}（${hint}）` : label;
    const select = document.createElement("select");
    select.dataset.setting = key;
    select.dataset.settingSelect = key;
    select.disabled = disabled;
    for (const [value, labelText] of options) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = labelText;
      select.append(option);
    }
    select.value = config.settings[key];
    select.onchange = () => {
      config.settings[key] = select.value;
      markSettingsChanged();
      applyVisualSettings();
      saveConfig();
    };
    row.append(text, select);
    return row;
  }

  function playbackProfileControl() {
    const row = document.createElement("label");
    row.className = "profile-control";
    const label = document.createElement("span");
    label.textContent = "性能档位";
    const select = document.createElement("select");
    select.dataset.playbackProfile = "";
    for (const [value, text] of [
      ["performance", "性能优先"],
      ["balanced", "均衡"],
      ["custom", "自定义"],
    ]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = text;
      select.append(option);
    }
    select.value = config.settings.performanceProfile;
    select.onchange = () => {
      config.activePresetId = null;
      if (select.value === "custom") {
        config.settings.performanceProfile = "custom";
        saveConfig();
      } else if (performanceProfiles[select.value]) {
        config.settings.performanceProfile = select.value;
        config.settings.fps = performanceProfiles[select.value].fps;
        config.settings.pauseWhenHidden =
          performanceProfiles[select.value].pauseWhenHidden;
        applyPlaybackSettings({ fps: true });
        applyHiddenPolicy();
        saveConfig();
      }
      syncSettingControls();
      syncPresetUi();
    };
    row.append(label, select);
    return row;
  }

  function surfaceOverrideControl(label, scope) {
    const row = document.createElement("div");
    row.className = "surface-override";
    const top = document.createElement("label");
    top.className = "setting-toggle";
    const override = document.createElement("input");
    override.type = "checkbox";
    override.dataset.surfaceOverride = scope;
    override.checked = hasSurfaceOverride(scope);
    const text = document.createElement("span");
    text.textContent = label;
    top.append(override, text);

    const controls = document.createElement("div");
    controls.className = "surface-override-controls";
    const input = document.createElement("input");
    input.type = "range";
    input.min = "0";
    input.max = "100";
    input.step = "1";
    input.dataset.surfaceOverrideValue = scope;
    input.disabled = !override.checked;
    input.value = String(surfaceOpacityValue(scope));
    const output = document.createElement("output");
    output.textContent = `${input.value}%`;
    const restore = document.createElement("button");
    restore.type = "button";
    restore.dataset.restoreSurface = scope;
    restore.textContent = "恢复继承";
    restore.disabled = !override.checked;

    const sync = () => {
      const enabled = override.checked;
      input.disabled = !enabled;
      restore.disabled = !enabled;
      input.value = String(surfaceOpacityValue(scope));
      output.textContent = `${input.value}%`;
    };
    override.onchange = () => {
      markSettingsChanged();
      config.settings.surfaceOverrides[scope] = override.checked
        ? surfaceOpacityValue(scope)
        : null;
      applyInterfaceAppearance();
      saveConfig();
      sync();
    };
    input.oninput = () => {
      markSettingsChanged();
      config.settings.surfaceOverrides[scope] = Number(input.value);
      output.textContent = `${input.value}%`;
      applyInterfaceAppearance();
      scheduleConfigSave(`surfaceOverrides.${scope}`);
    };
    input.onchange = flushConfigSave;
    input.onblur = flushConfigSave;
    restore.onclick = () => {
      markSettingsChanged();
      override.checked = false;
      config.settings.surfaceOverrides[scope] = null;
      applyInterfaceAppearance();
      saveConfig();
      sync();
    };
    controls.append(input, output, restore);
    row.append(top, controls);
    return row;
  }

  function presetIdFor(name) {
    const base =
      String(name)
        .trim()
        .toLocaleLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "preset";
    let id = base;
    let sequence = 2;
    while (config.presets.some((preset) => preset.id === id))
      id = `${base}-${sequence++}`;
    return id;
  }

  function syncPresetUi() {
    if (!panel) return;
    for (const item of panel.querySelectorAll("[data-preset-id]")) {
      const active = item.dataset.presetId === config.activePresetId;
      item.dataset.active = String(active);
      const button = item.querySelector("[data-preset-apply]");
      if (button) {
        button.textContent = active ? "当前预设" : "应用";
        button.setAttribute("aria-pressed", String(active));
      }
    }
  }

  function renderPresetList() {
    if (!panel) return;
    const list = panel.querySelector("[data-preset-list]");
    if (!list) return;
    list.replaceChildren(
      ...config.presets.map((preset) => {
        const item = document.createElement("article");
        item.className = "preset-row";
        item.dataset.presetId = preset.id;
        const name = document.createElement("input");
        name.type = "text";
        name.value = preset.name;
        name.dataset.presetName = preset.id;
        name.setAttribute("aria-label", `预设 ${preset.name} 名称`);
        const apply = document.createElement("button");
        apply.type = "button";
        apply.dataset.presetApply = preset.id;
        apply.onclick = () => {
          config.activePresetId = preset.id;
          config.settings = cloneSettings(preset.settings);
          saveConfig();
          applyCurrentSettings();
          renderPresetList();
          setSettingsStatus(`已应用预设：${preset.name}`);
        };
        const rename = document.createElement("button");
        rename.type = "button";
        rename.dataset.presetRename = preset.id;
        rename.textContent = "重命名";
        rename.onclick = () => {
          const value = name.value.trim();
          if (!value) {
            setSettingsStatus("预设名称不能为空");
            return;
          }
          preset.name = value;
          saveConfig();
          renderPresetList();
          setSettingsStatus(`预设已重命名为：${value}`);
        };
        item.append(name, apply, rename);
        return item;
      })
    );
    syncPresetUi();
  }

  function setSettingsStatus(message) {
    const target = panel?.querySelector("[data-settings-status]");
    if (target) target.textContent = message;
  }

  function exportSettings() {
    const payload = {
      version: 1,
      settings: cloneSettings(config.settings),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "codex-wallpaper-settings.json";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    setSettingsStatus("设置已导出");
  }

  async function importSettings(file) {
    try {
      const payload = JSON.parse(await file.text());
      if (!payload || typeof payload !== "object" || payload.version !== 1)
        throw new Error("版本无效");
      if (
        Object.keys(payload).some(
          (key) => !["version", "settings"].includes(key)
        )
      )
        throw new Error("文件结构无效");
      if (
        !payload.settings ||
        typeof payload.settings !== "object" ||
        Array.isArray(payload.settings)
      )
        throw new Error("设置结构无效");
      const validation = validateSettingsInput(payload.settings);
      if (validation.error) throw new Error(validation.error);
      config.settings = validation.value;
      config.activePresetId = null;
      saveConfig();
      applyCurrentSettings();
      syncPresetUi();
      setSettingsStatus("设置已导入");
    } catch (error) {
      setSettingsStatus(`导入失败：${error.message}`);
    }
  }

  function resetSettingGroup(group) {
    config.activePresetId = null;
    if (group === "all") config.settings = cloneSettings();
    else {
      for (const [key, definition] of Object.entries(settingDefinitions)) {
        if (definition.group !== group) continue;
        config.settings[key] = structuredClone(defaults.settings[key]);
      }
    }
    saveConfig();
    applyCurrentSettings();
    renderPresetList();
    setSettingsStatus(
      group === "playback"
        ? "已恢复播放默认值"
        : group === "appearance"
          ? "已恢复外观默认值"
          : "已恢复全部设置默认值"
    );
  }

  async function removeImportedMedia() {
    clearImportedPreviews();
    const db = await openDatabase();
    await requestResult(
      db.transaction(dbStore, "readwrite").objectStore(dbStore).clear()
    );
    await loadImported();
    config.favorites = config.favorites.filter(
      (entry) => entry.kind !== "imported"
    );
    config.playlist = config.playlist.filter(
      (entry) => entry.kind !== "imported"
    );
    if (config.active.kind === "imported") config.active = defaults.active;
    saveConfig();
    await applyActive();
    renderPanel();
    setSettingsStatus("已移除导入素材");
  }

  function renderPanel() {
    if (!panel) return;
    const list = panel.querySelector(".wallpaper-list");
    const playlist = panel.querySelector(".playlist-summary");
    const playbackSettings = panel.querySelector("[data-playback-settings]");
    const appearanceSettings = panel.querySelector(".settings-grid");
    if (!list || !playlist || !playbackSettings || !appearanceSettings) return;
    previewObserver.disconnect();
    list.replaceChildren(...libraryEntries().map(card));
    applyLibraryFilters();
    const queued = playlistEntries();
    playlist.textContent = queued.length
      ? `轮播：${queued.map((entry) => entry.title).join(" · ")}`
      : "轮播列表为空";
    const performance = document.createElement("p");
    performance.className = "playlist-summary";
    performance.dataset.performanceSummary = "";
    performance.textContent = performanceSummary();
    const tradeoff = document.createElement("p");
    tradeoff.className = "playback-capability";
    tradeoff.dataset.performanceTradeoff = "";
    tradeoff.textContent = performanceTradeoff();
    const capability = document.createElement("p");
    capability.className = "playback-capability";
    capability.dataset.playbackCapability = "";
    capability.textContent = playbackCapabilityText();
    playbackSettings.replaceChildren(
      playbackProfileControl(),
      performance,
      tradeoff,
      capability,
      settingToggle("静音", "muted"),
      range("音量", "volume", 0, 100, 5, "%"),
      ...(activeMediaType() === "scene"
        ? [range("Scene 上限", "fps", 15, 30, 15, " FPS")]
        : []),
      settingToggle("不可见时暂停", "pauseWhenHidden", {
        disabled: !["video", "scene"].includes(activeMediaType()),
        hint: ["video", "scene"].includes(activeMediaType())
          ? ""
          : "当前素材不适用",
      }),
      range("轮播", "rotationMinutes", 0, 120, 5, " 分钟")
    );
    const type = activeMediaType();
    appearanceSettings.replaceChildren(
      range("暗化", "dim", 0, 70, 1, "%"),
      range("模糊", "blur", 0, 24, 1, "px"),
      range("不透明度", "opacity", 20, 100, 1, "%"),
      ...(["image", "video", "scene"].includes(type)
        ? [
            settingSelect(
              "画面适配",
              "fitMode",
              [
                ["cover", "保持比例填充"],
                ["contain", "完整显示"],
              ],
              {
                disabled: type === "scene" && sceneFitSupported === false,
                hint:
                  type === "scene" && sceneFitSupported === false
                    ? "当前 Scene 不支持原位调整"
                    : "",
              }
            ),
          ]
        : []),
      range("界面读底", "surfaceOpacity", 20, 100, 1, "%"),
      range("界面雾化", "interfaceBlur", 0, 24, 1, "px"),
      settingToggle("细边框", "interfaceBorders"),
      surfaceOverrideControl("聊天区覆盖", "chat"),
      surfaceOverrideControl("侧栏/顶部覆盖", "sidebar"),
      surfaceOverrideControl("右侧面板覆盖", "right"),
      surfaceOverrideControl("设置面板覆盖", "settings")
    );
    renderPresetList();
    if (config.active.kind === "builtin") setStatus("内置渐变");
    else renderRuntimeStatus();
  }

  async function importFiles(files) {
    const db = await openDatabase();
    const transaction = db.transaction(dbStore, "readwrite");
    const store = transaction.objectStore(dbStore);
    let first = null;
    for (const file of files) {
      const type = mediaType(file);
      if (!type) continue;
      const id = `import-${Date.now()}-${crypto.randomUUID()}`;
      first ??= id;
      store.put({
        id,
        title: file.name,
        type,
        blob: file,
        createdAt: Date.now(),
      });
    }
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    await loadImported();
    if (first) {
      config.active = { kind: "imported", id: first };
      saveConfig();
      await applyActive();
    }
    renderPanel();
  }

  async function deleteImported(id) {
    const previewUrl = importedPreviewUrls.get(id);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    importedPreviewUrls.delete(id);
    const db = await openDatabase();
    const transaction = db.transaction(dbStore, "readwrite");
    transaction.objectStore(dbStore).delete(id);
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    await loadImported();
    if (config.active.kind === "imported" && config.active.id === id) {
      config.active = defaults.active;
      saveConfig();
      await applyActive();
    }
    renderPanel();
  }

  async function resetAll() {
    revokePlayback();
    activeGeneration += 1;
    stopRotation();
    pendingAssetRequests.clear();
    pendingPreviewRequests.clear();
    clearImportedPreviews();
    assetTransfers.clear();
    previewObserver.disconnect();
    database?.close();
    database = null;
    channel.postMessage({ type: "prepare-reset" });
    await new Promise((resolve) => setTimeout(resolve, 250));
    if (database) database.close();
    database = null;
    let deleted = false;
    await new Promise((resolve) => {
      const request = indexedDB.deleteDatabase(dbName);
      request.onsuccess = () => {
        deleted = true;
        resolve();
      };
      request.onerror = resolve;
      request.onblocked = () => {
        setStatus("其他窗口仍占用导入素材，请关闭其他窗口后重试");
        resolve();
      };
    });
    if (!deleted) {
      if (!root) mount();
      await applyActive();
      return state();
    }
    removeAdapterNodes();
    root = null;
    panel = null;
    layer = null;
    media = null;
    dim = null;
    status = null;
    imported = [];
    if (typeof globalThis.__codexWallpaperHostRequest === "function") {
      globalThis.__codexWallpaperHostRequest(JSON.stringify({ type: "stop" }));
    }
    const resetConfig = structuredClone(defaults);
    resetConfig.enabled = false;
    config = resetConfig;
    saveConfig();
    installHotkey();
    return state();
  }

  function removeAdapterNodes() {
    clearInterfaceAppearance();
    for (const node of document.querySelectorAll(
      `#${rootId}, #${controlsId}, #${styleId}`
    ))
      node.remove();
  }

  function receivePreview(entry) {
    pendingPreviewRequests.delete(entry.id);
    failedPreviewIds.delete(entry.id);
    const item = sourcePayload.library?.find(
      (candidate) => candidate.id === entry.id
    );
    if (item) {
      item.previewDataUrl = entry.previewDataUrl;
      item.fallback = true;
    }
    const importedItem = imported.find(
      (candidate) => candidate.id === entry.id
    );
    const previewEntry = item
      ? { ...item, kind: "workshop" }
      : importedItem
        ? {
            kind: "imported",
            id: importedItem.id,
            title: importedItem.title,
            type: mediaType(importedItem.blob),
            playable: true,
            previewDataUrl: entry.previewDataUrl,
            assetDataUrl: null,
            thumbnailKind: entry.thumbnailKind,
          }
        : null;
    const previewCard = panel
      ? [...panel.querySelectorAll(".card")].find(
          (candidate) =>
            candidate.dataset.entryKind === previewEntry?.kind &&
            candidate.dataset.entryId === entry.id
        )
      : null;
    const visual = previewCard?.querySelector(".thumb");
    if (visual && previewEntry) {
      previewObserver.unobserve(visual);
      renderThumb(previewEntry, visual);
    }
    return state();
  }

  function receivePreviewError(id) {
    pendingPreviewRequests.delete(id);
    failedPreviewIds.add(id);
    return state();
  }

  function beginAssetTransfer(entry) {
    assetTransfers.set(entry.id, {
      entry,
      parts: [],
      received: 0,
    });
    return state();
  }

  function appendAssetTransferChunk(id, encoded) {
    const transfer = assetTransfers.get(id);
    if (!transfer) return state();
    const bytes = bytesFromBase64(encoded);
    transfer.parts.push(bytes);
    transfer.received += bytes.byteLength;
    return state();
  }

  async function finishAssetTransfer(id) {
    const transfer = assetTransfers.get(id);
    if (!transfer) return state();
    assetTransfers.delete(id);
    pendingAssetRequests.delete(id);
    const { mime, size, ...metadata } = transfer.entry;
    if (transfer.received !== size)
      throw new Error("Asset transfer size mismatch");
    const url = URL.createObjectURL(new Blob(transfer.parts, { type: mime }));
    if (
      config.enabled &&
      config.active.kind === "workshop" &&
      config.active.id === id
    ) {
      failedEntryKeys.delete(`workshop:${id}`);
      if (loadingEntryKey === `workshop:${id}`) loadingEntryKey = null;
      runtimeAssets.set(`workshop:${id}`, {
        ...metadata,
        kind: "workshop",
        playable: true,
        assetDataUrl: null,
        assetUrl: url,
      });
      return applyActive();
    }
    URL.revokeObjectURL(url);
    renderPanel();
    return state();
  }

  function buildPanel() {
    panel = document.createElement("aside");
    panel.className = "panel";
    panel.dataset.codexWallpaperPanel = "";
    panel.setAttribute("aria-label", "Codex 壁纸设置");
    const header = document.createElement("header");
    const heading = document.createElement("strong");
    heading.textContent = "Codex 壁纸";
    const close = document.createElement("button");
    close.textContent = "×";
    close.title = "关闭";
    close.onclick = () => {
      flushConfigSave();
      panel.classList.remove("open");
    };
    header.append(heading, close);

    const library = document.createElement("section");
    library.className = "panel-region";
    library.dataset.panelRegion = "library";
    library.setAttribute("aria-labelledby", "codex-wallpaper-library-title");
    const libraryTitle = document.createElement("h3");
    libraryTitle.id = "codex-wallpaper-library-title";
    libraryTitle.textContent = "壁纸库";
    const libraryBody = document.createElement("div");
    libraryBody.className = "panel-region-body";
    const filters = document.createElement("div");
    filters.className = "library-filters";
    filters.setAttribute("role", "search");
    filters.setAttribute("aria-label", "查找壁纸");
    const searchLabel = document.createElement("label");
    searchLabel.className = "library-filter";
    const searchText = document.createElement("span");
    searchText.textContent = "标题";
    const search = document.createElement("input");
    search.type = "search";
    search.placeholder = "搜索壁纸";
    search.dataset.librarySearch = "";
    searchLabel.append(searchText, search);
    const typeLabel = document.createElement("label");
    typeLabel.className = "library-filter";
    const typeText = document.createElement("span");
    typeText.textContent = "类型";
    const type = document.createElement("select");
    type.dataset.libraryType = "";
    for (const [value, label] of [
      ["all", "全部类型"],
      ["image", "图片"],
      ["video", "视频"],
      ["scene", "Scene"],
      ["web", "Web"],
    ]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      type.append(option);
    }
    typeLabel.append(typeText, type);
    const favoritesLabel = document.createElement("label");
    favoritesLabel.className = "library-filter";
    const favorites = document.createElement("input");
    favorites.type = "checkbox";
    favorites.dataset.libraryFavorites = "";
    const favoritesText = document.createElement("span");
    favoritesText.textContent = "只看收藏";
    favoritesLabel.append(favorites, favoritesText);
    filters.append(searchLabel, typeLabel, favoritesLabel);

    const importRow = document.createElement("label");
    importRow.className = "import-row";
    importRow.textContent = "导入图片或视频";
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*,video/*";
    fileInput.multiple = true;
    fileInput.onchange = () => importFiles(fileInput.files);
    importRow.append(fileInput);

    status = document.createElement("p");
    status.className = "runtime-status";
    status.setAttribute("aria-live", "polite");
    const result = document.createElement("p");
    result.className = "library-result";
    result.dataset.libraryResult = "";
    result.setAttribute("aria-live", "polite");
    const list = document.createElement("div");
    list.className = "wallpaper-list";
    list.setAttribute("aria-label", "壁纸素材");
    const applyFilters = () => {
      libraryFilters.query = search.value;
      libraryFilters.type = type.value;
      libraryFilters.favoritesOnly = favorites.checked;
      const scrollTop = panel.scrollTop;
      applyLibraryFilters();
      panel.scrollTop = scrollTop;
    };
    search.oninput = applyFilters;
    type.onchange = applyFilters;
    favorites.onchange = applyFilters;
    panel.addEventListener("scroll", requestVisiblePreviews, { passive: true });
    libraryBody.append(filters, importRow, status, result, list);
    library.append(libraryTitle, libraryBody);

    const playback = document.createElement("details");
    playback.className = "panel-region";
    playback.dataset.panelRegion = "playback";
    const playbackTitle = document.createElement("summary");
    playbackTitle.textContent = "播放与性能";
    const playbackBody = document.createElement("div");
    playbackBody.className = "panel-region-body";
    const playlistSummary = document.createElement("p");
    playlistSummary.className = "playlist-summary";
    const playbackSettings = document.createElement("div");
    playbackSettings.className = "control-grid";
    playbackSettings.dataset.playbackSettings = "";
    playbackBody.append(playlistSummary, playbackSettings);
    playback.append(playbackTitle, playbackBody);

    const appearance = document.createElement("details");
    appearance.className = "panel-region";
    appearance.dataset.panelRegion = "appearance";
    const appearanceTitle = document.createElement("summary");
    appearanceTitle.textContent = "画面与界面";
    const appearanceBody = document.createElement("div");
    appearanceBody.className = "panel-region-body";
    const settingsGrid = document.createElement("div");
    settingsGrid.className = "settings-grid";
    appearanceBody.append(settingsGrid);
    appearance.append(appearanceTitle, appearanceBody);

    const recovery = document.createElement("details");
    recovery.className = "panel-region";
    recovery.dataset.panelRegion = "recovery";
    const recoveryTitle = document.createElement("summary");
    recoveryTitle.textContent = "预设与恢复";
    const recoveryBody = document.createElement("div");
    recoveryBody.className = "panel-region-body";
    const resetHelp = document.createElement("p");
    resetHelp.className = "playlist-summary";
    resetHelp.textContent =
      "预设保存画面与播放参数；导入导出只包含设置，不包含素材或个人数据。";
    const presetEditor = document.createElement("div");
    presetEditor.className = "preset-editor";
    const presetName = document.createElement("input");
    presetName.type = "text";
    presetName.placeholder = "预设名称";
    presetName.dataset.presetNameInput = "";
    presetName.setAttribute("aria-label", "新预设名称");
    const presetSave = document.createElement("button");
    presetSave.type = "button";
    presetSave.dataset.presetSave = "";
    presetSave.textContent = "保存当前设置";
    presetSave.onclick = () => {
      const value = presetName.value.trim();
      if (!value) {
        setSettingsStatus("预设名称不能为空");
        return;
      }
      const id = presetIdFor(value);
      config.presets.push({
        id,
        name: value,
        settings: cloneSettings(config.settings),
      });
      config.activePresetId = id;
      saveConfig();
      presetName.value = "";
      renderPresetList();
      setSettingsStatus(`已保存预设：${value}`);
    };
    presetEditor.append(presetName, presetSave);
    const presetList = document.createElement("div");
    presetList.className = "preset-list";
    presetList.dataset.presetList = "";

    const transfer = document.createElement("div");
    transfer.className = "settings-transfer";
    const exportButton = document.createElement("button");
    exportButton.type = "button";
    exportButton.dataset.settingsExport = "";
    exportButton.textContent = "导出设置";
    exportButton.onclick = exportSettings;
    const importLabel = document.createElement("label");
    importLabel.className = "settings-import";
    importLabel.textContent = "导入设置";
    const importInput = document.createElement("input");
    importInput.type = "file";
    importInput.accept = "application/json,.json";
    importInput.dataset.settingsImport = "";
    importInput.onchange = async () => {
      const [file] = importInput.files;
      if (file) await importSettings(file);
      importInput.value = "";
    };
    importLabel.append(importInput);
    transfer.append(exportButton, importLabel);
    const settingsStatus = document.createElement("p");
    settingsStatus.className = "settings-status";
    settingsStatus.dataset.settingsStatus = "";
    settingsStatus.setAttribute("aria-live", "polite");

    const resetGroups = document.createElement("div");
    resetGroups.className = "reset-groups";
    for (const [group, label] of [
      ["playback", "恢复播放默认"],
      ["appearance", "恢复外观默认"],
      ["all", "恢复全部设置"],
    ]) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.resetGroup = group;
      button.textContent = label;
      button.onclick = () => resetSettingGroup(group);
      resetGroups.append(button);
    }
    const removeImported = document.createElement("button");
    removeImported.type = "button";
    removeImported.dataset.removeImported = "";
    removeImported.textContent = "移除全部导入素材";
    removeImported.onclick = removeImportedMedia;
    resetGroups.append(removeImported);

    const reset = document.createElement("button");
    reset.className = "reset";
    reset.textContent = "停用并清除本项目数据";
    let resetArmed = false;
    reset.onclick = async () => {
      if (!resetArmed) {
        resetArmed = true;
        reset.textContent = "再次点击确认清除";
        setTimeout(() => {
          resetArmed = false;
          reset.textContent = "停用并清除本项目数据";
        }, 4000);
        return;
      }
      await resetAll();
    };
    recoveryBody.append(
      resetHelp,
      presetEditor,
      presetList,
      transfer,
      settingsStatus,
      resetGroups,
      reset
    );
    recovery.append(recoveryTitle, recoveryBody);
    panel.append(header, library, playback, appearance, recovery);
    return panel;
  }

  function mount() {
    if (root?.isConnected) return;
    root = null;
    removeAdapterNodes();
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = runtimeCss;
    root = document.createElement("div");
    root.id = rootId;
    const controls = document.createElement("div");
    controls.id = controlsId;
    layer = document.createElement("div");
    layer.dataset.codexWallpaperLayer = "";
    media = document.createElement("div");
    media.className =
      config.active.kind === "builtin" ? "media builtin" : "media";
    dim = document.createElement("div");
    dim.className = "dim";
    layer.append(media, dim);
    const toolbar = document.createElement("div");
    toolbar.className = "toolbar";
    const settings = document.createElement("button");
    settings.dataset.codexWallpaperSettings = "";
    settings.textContent = "壁纸设置";
    settings.onclick = () => {
      if (panel.classList.contains("open")) flushConfigSave();
      panel.classList.toggle("open");
    };
    const toggle = document.createElement("button");
    toggle.dataset.codexWallpaperToggle = "";
    toggle.textContent = "停用壁纸";
    toggle.onclick = () => disable();
    toolbar.append(settings, toggle);
    controls.append(toolbar, buildPanel());
    document.documentElement.append(style, root, controls);
    root.append(layer);
    applyInterfaceAppearance();
  }

  async function enable() {
    config.enabled = true;
    saveConfig();
    mount();
    await loadImported();
    await applyActive();
    return state();
  }

  async function disable(persist = true) {
    if (persist) flushConfigSave();
    config.enabled = false;
    if (persist) saveConfig();
    revokePlayback();
    activeGeneration += 1;
    stopRotation();
    pendingAssetRequests.clear();
    pendingPreviewRequests.clear();
    clearImportedPreviews();
    assetTransfers.clear();
    previewObserver.disconnect();
    database?.close();
    database = null;
    removeAdapterNodes();
    root = null;
    panel = null;
    layer = null;
    media = null;
    dim = null;
    status = null;
    installHotkey();
    return state();
  }

  function state() {
    return {
      state: config.enabled ? "enabled" : "disabled",
      backgroundLayers: document.querySelectorAll(
        `#${rootId} [data-codex-wallpaper-layer]`
      ).length,
      controls: document.querySelectorAll(`#${controlsId} button`).length,
      styles: document.querySelectorAll(`#${styleId}`).length,
      activeKind: config.active.kind,
      activeId: config.active.id,
      libraryCount: sourcePayload.library?.length || 0,
      importedCount: imported.length,
      playerCount: document.querySelectorAll(
        `#${rootId} [data-codex-wallpaper-layer] video, #${rootId} [data-codex-wallpaper-layer] canvas, #${rootId} [data-codex-wallpaper-layer] iframe`
      ).length,
      visible: document.visibilityState === "visible",
      measuredFps,
      fpsCap: Number(config.settings.fps),
      volume: Number(config.settings.volume),
      hostReady,
    };
  }

  function syncVisibility() {
    if (document.visibilityState === "hidden") {
      flushConfigSave();
      if (!config.settings.pauseWhenHidden) return;
      playback?.video?.pause();
      playback?.pause?.();
      if (playback?.raf) cancelAnimationFrame(playback.raf);
      return;
    }
    playback?.video?.play().catch(() => {});
    playback?.resume?.();
    playback?.start?.();
    pendingRender?.resume?.();
  }

  function installHotkey() {
    if (globalThis.__codexWallpaperHotkey) return;
    globalThis.__codexWallpaperHotkey = (event) => {
      if (!event.altKey || !event.shiftKey || event.code !== "KeyW") return;
      config.enabled ? disable() : enable();
    };
    addEventListener("keydown", globalThis.__codexWallpaperHotkey);
  }

  async function refresh(nextPayload) {
    sourcePayload = nextPayload || sourcePayload;
    config = readConfig();
    if (!config.enabled) {
      if (root) await disable();
      return state();
    }
    if (!root) mount();
    await loadImported();
    await applyActive();
    return state();
  }

  if (globalThis.__codexWallpaperApi)
    return globalThis.__codexWallpaperApi.refresh(payload);

  installHotkey();
  addEventListener("storage", (event) => {
    if (event.key !== configKey && event.key !== null) return;
    if (configSaveTimer || pendingConfigFields.size > 0) {
      const previous = config;
      const remote = readConfig();
      for (const field of pendingConfigFields) {
        const overrideScope = field.startsWith("surfaceOverrides.")
          ? field.slice("surfaceOverrides.".length)
          : null;
        if (overrideScope)
          remote.settings.surfaceOverrides[overrideScope] =
            config.settings.surfaceOverrides[overrideScope];
        else remote.settings[field] = config.settings[field];
      }
      remote.activePresetId = config.activePresetId;
      config = remote;
      saveConfig();
      applyConfigChange(configChanges(previous, config));
      return;
    }
    const previous = config;
    config = readConfig();
    applyConfigChange(configChanges(previous, config));
  });
  channel.addEventListener("message", (event) => {
    if (event.data?.type === "prepare-reset") {
      disable();
    }
  });
  addEventListener("pagehide", () => {
    flushConfigSave();
    revokePlayback();
    stopRotation();
  });
  document.addEventListener("visibilitychange", syncVisibility);
  globalThis.__codexWallpaperApi = {
    identity: () => structuredClone(identity),
    refresh,
    enable,
    disable,
    state,
    configureHost,
    receivePreview,
    receivePreviewError,
    beginAssetTransfer,
    appendAssetTransferChunk,
    finishAssetTransfer,
    receiveAsset(entry) {
      pendingAssetRequests.delete(entry.id);
      failedEntryKeys.delete(`workshop:${entry.id}`);
      if (loadingEntryKey === `workshop:${entry.id}`) loadingEntryKey = null;
      runtimeAssets.set(`workshop:${entry.id}`, {
        ...entry,
        kind: "workshop",
      });
      if (config.active.kind === "workshop" && config.active.id === entry.id)
        return applyActive();
      renderPanel();
      return state();
    },
    receiveAssetError(id, message) {
      pendingAssetRequests.delete(id);
      assetTransfers.delete(id);
      if (loadingEntryKey === `workshop:${id}`) loadingEntryKey = null;
      failedEntryKeys.add(`workshop:${id}`);
      renderPanel();
      if (config.active.kind === "workshop" && config.active.id === id)
        setStatus(`素材加载失败：${message}`);
      return state();
    },
  };

  if (!config.enabled) return state();
  return enable();
}
