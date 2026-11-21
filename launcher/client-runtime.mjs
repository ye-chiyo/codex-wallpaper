import { createHash } from "node:crypto";

function createRuntimeStyles(rootId, controlsId) {
  const surface = "var(--app-color-background-surface, rgb(24 24 28))";
  const under = "var(--app-color-background-surface-under, rgb(12 12 16))";
  const surfaceColor = (base, scope) =>
    `color-mix(in srgb, ${base} var(--codex-wallpaper-${scope}-opacity), transparent)`;
  const frame = surfaceColor("var(--codex-wallpaper-surface-base)", "surface");
  const canvas = surfaceColor("var(--codex-wallpaper-surface-base)", "chat");
  const panelColor = surfaceColor(
    "var(--codex-wallpaper-panel-base)",
    "settings"
  );
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
      /* Position the settings panel above the composer when it is available. */
      body [data-composer-surface-variant] { anchor-name: --codex-wallpaper-composer; }
      #${controlsId} .panel :where(button, .panel-file) { border: 1px solid var(--codex-wallpaper-line-strong); border-radius: var(--codex-wallpaper-radius-sm); background: var(--codex-wallpaper-raised); color: inherit; padding: 6px 10px; font: inherit; min-block-size: 32px; cursor: pointer; transition: background-color .12s ease-out, border-color .12s ease-out; }
      #${controlsId} .panel .panel-file:hover,
      #${controlsId} .panel button:hover { background: color-mix(in srgb, var(--app-color-text-foreground, rgb(245 245 250)) 8%, var(--codex-wallpaper-raised)); }
      #${controlsId} .panel button:active { background: color-mix(in srgb, var(--app-color-text-foreground, rgb(245 245 250)) 14%, var(--codex-wallpaper-raised)); }
      #${controlsId} .panel button[aria-pressed='true'] { border-color: var(--codex-wallpaper-line-strong); background: color-mix(in srgb, var(--app-color-accent-blue, rgb(51 156 255)) 18%, var(--codex-wallpaper-raised)); }
      #${controlsId} .panel :is(button, select, input, summary):focus-visible,
      #${controlsId} .panel .panel-file:focus-within { outline: 2px solid var(--color-text-accent, rgb(51 156 255)); outline-offset: 2px; }
      #${controlsId} .panel button:disabled { opacity: .48; cursor: not-allowed; }
      #${controlsId} .panel {
        --panel-inset: 20px;
        --panel-accent: var(--color-text-accent, var(--app-color-accent-blue, #0285ff));
        --panel-muted: color-mix(in srgb, currentColor 75%, transparent);
        box-sizing: border-box;
        position: fixed; z-index: 2147483647; width: min(448px, calc(100% - 28px)); overflow: auto; border: 1px solid var(--codex-wallpaper-line-strong); border-radius: var(--codex-wallpaper-radius); background-color: ${panelColor}; backdrop-filter: var(--codex-wallpaper-interface-blur); box-shadow: var(--codex-wallpaper-shadow); pointer-events: auto; display: none;
        overscroll-behavior: contain;
        scrollbar-width: thin;
        scrollbar-gutter: stable;
        scroll-padding-block: 112px 12px;
        inset: auto 14px 14px auto;
        height: min(80vh, 760px, calc(100% - 28px));
      }
      #${controlsId} .panel.open { display: block; }
      html:has([data-composer-surface-variant]) #${controlsId} .panel {
        position-anchor: --codex-wallpaper-composer;
        position-area: top span-right;
        inset: 14px 14px 8px 14px;
        place-self: end;
      }
      #${controlsId} .panel-navigation { position: sticky; top: 0; z-index: 1; padding: 14px var(--panel-inset) 0; background: var(--codex-wallpaper-panel-base); border-bottom: 1px solid var(--codex-wallpaper-line-strong); }
      #${controlsId} .panel-navigation header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 6px; }
      #${controlsId} .panel-navigation h2 { margin: 0; font-size: 18px; font-weight: 650; }
      #${controlsId} .panel-navigation .panel-close { display: grid; place-items: center; width: 32px; padding: 0; border-color: transparent; background-color: transparent; }
      #${controlsId} .panel-navigation .panel-close:hover { background-color: var(--codex-wallpaper-settings-control); }
      #${controlsId} .panel-tabs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
      #${controlsId} .panel-tabs button { min-width: 0; padding: 8px 4px; border: 0; border-radius: 6px 6px 0 0; background: transparent; color: var(--panel-muted); font-weight: 550; }
      #${controlsId} .panel-tabs button:hover { background: var(--codex-wallpaper-settings-control); color: inherit; }
      #${controlsId} .panel-tabs button:focus-visible { outline-offset: -3px; }
      #${controlsId} .panel-tabs button[aria-selected='true'] { box-shadow: inset 0 -2px var(--panel-accent); color: inherit; font-weight: 650; }
      #${controlsId} .panel-region[hidden] { display: none; }
      #${controlsId} .panel-region-body { display: grid; gap: 16px; padding: 16px var(--panel-inset) 20px; }
      #${controlsId} .settings-group, #${controlsId} .preset-section { display: grid; gap: 8px; min-width: 0; }
      #${controlsId} .settings-group + .settings-group, #${controlsId} .preset-section, #${controlsId} .preset-section > .settings-group { border-top: 1px solid var(--codex-wallpaper-line-strong); padding-top: 14px; }
      #${controlsId} .panel-region-body h3 { margin: 0 0 2px; font-size: 14px; font-weight: 650; }
      #${controlsId} .panel-region-body summary { cursor: pointer; padding: 8px 0; }
      #${controlsId} .panel-file { position: relative; display: grid; align-items: center; box-sizing: border-box; text-align: center; }
      #${controlsId} .panel-file input { position: absolute; width: 1px; height: 1px; margin: 0; clip-path: inset(50%); }
      #${controlsId} .library-filters { display: grid; grid-template-columns: minmax(0, 1fr) max-content; column-gap: 12px; row-gap: 8px; }
      #${controlsId} .library-filter { display: grid; gap: 4px; min-width: 0; color: var(--panel-muted); font-size: 12px; }
      #${controlsId} .library-filter:has(input[type='checkbox']) { display: flex; align-items: center; gap: 8px; min-height: 32px; color: inherit; }
      #${controlsId} .panel :is(input[type='search'], input[type='text'], select) { box-sizing: border-box; min-width: 0; width: 100%; min-height: 34px; border: 1px solid var(--codex-wallpaper-line-strong); border-radius: var(--codex-wallpaper-radius-sm); background: var(--codex-wallpaper-raised); color: inherit; padding: 6px 10px; font: inherit; }
      #${controlsId} .panel select { appearance: auto; }
      #${controlsId} .panel input::placeholder { color: var(--panel-muted); }
      #${controlsId} .library-summary { display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: 4px 12px; padding-top: 12px; border-top: 1px solid var(--codex-wallpaper-line-strong); }
      #${controlsId} .runtime-status { margin: 0; min-width: 0; overflow-wrap: anywhere; font-weight: 550; }
      #${controlsId} .library-result, #${controlsId} .playlist-summary, #${controlsId} .playback-capability, #${controlsId} .settings-status { margin: 0; color: var(--panel-muted); font-size: 12px; overflow-wrap: anywhere; }
      #${controlsId} .wallpaper-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
      #${controlsId} .card { position: relative; min-width: 0; padding: 8px; border: 1px solid var(--codex-wallpaper-line); border-radius: 12px; background: var(--codex-wallpaper-settings-control); }
      #${controlsId} .card[hidden] { display: none; }
      #${controlsId} .card[data-selected='true'] { border-color: var(--codex-wallpaper-line-strong); background: color-mix(in srgb, var(--app-color-accent-blue, rgb(51 156 255)) 12%, var(--codex-wallpaper-raised)); }
      #${controlsId} .card-current { position: absolute; top: 14px; right: 14px; padding: 2px 6px; border-radius: 6px; background: var(--codex-wallpaper-panel-base); color: inherit; font-size: 11px; font-weight: 650; }
      #${controlsId} .card-current[hidden] { display: none; }
      #${controlsId} .thumb { aspect-ratio: 16 / 9; display: grid; place-items: center; overflow: hidden; border-radius: 6px; background: color-mix(in srgb, var(--app-color-text-foreground, white) 8%, transparent); font-size: 10px; }
      #${controlsId} .thumb img, #${controlsId} .thumb video { width: 100%; height: 100%; object-fit: cover; }
      #${controlsId} .card strong { display: block; margin-top: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 650; }
      #${controlsId} .card small { display: block; margin-top: 2px; color: var(--panel-muted); overflow-wrap: anywhere; }
      #${controlsId} .card-actions { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
      #${controlsId} .panel .card-actions button { padding: 4px 8px; font-size: 12px; }
      #${controlsId} .card-actions [data-entry-action='use'] { font-weight: 650; }
      #${controlsId} .panel [data-remove-imported] { justify-self: start; }
      #${controlsId} .settings-grid, #${controlsId} .control-grid { display: grid; gap: 16px; }
      #${controlsId} .range, #${controlsId} .profile-control { display: grid; grid-template-columns: 6.5em minmax(0, 1fr); align-items: center; gap: 8px; }
      #${controlsId} .range { grid-template-columns: 6.5em minmax(0, 1fr) 5.25em; }
      #${controlsId} .range-value { min-width: 0; }
      #${controlsId} .panel .range-value :is(button, input) { width: 100%; min-width: 0; min-height: 32px; box-sizing: border-box; padding: 3px 4px; font: inherit; text-align: center; }
      #${controlsId} .range-value input { border: 1px solid var(--codex-wallpaper-line-strong); border-radius: var(--codex-wallpaper-radius-sm); background: var(--codex-wallpaper-raised); color: inherit; }
      #${controlsId} .range output { color: color-mix(in srgb, var(--app-color-text-foreground, white) 78%, transparent); font-variant-numeric: tabular-nums; }
      #${controlsId} .setting-toggle { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 32px; }
      #${controlsId} .setting-toggle input { order: 1; }
      #${controlsId} .panel input[type='checkbox'] {
        appearance: auto;
        flex: none;
        inline-size: 16px;
        block-size: 16px;
        margin: 0;
        accent-color: var(--color-text-accent, rgb(51 156 255));
      }
      #${controlsId} .panel label:has(> input[type='checkbox']:enabled) { cursor: pointer; }
      #${controlsId} .panel-region-body details { padding-inline: 10px; border: 1px solid var(--codex-wallpaper-line-strong); border-radius: var(--codex-wallpaper-radius-sm); }
      #${controlsId} .panel-region-body details[open] { padding-bottom: 8px; }
      #${controlsId} .panel-region-body summary { font-weight: 550; }
      #${controlsId} .surface-override { display: grid; gap: 4px; padding: 6px 0; border-bottom: 1px solid var(--codex-wallpaper-line); }
      #${controlsId} .surface-override:last-child { border-bottom: 0; }
      #${controlsId} .surface-override-controls { display: grid; grid-template-columns: minmax(0, 1fr) 42px auto; align-items: center; gap: 7px; }
      #${controlsId} .panel input[type='range'] {
        appearance: none;
        min-width: 0;
        width: 100%;
        height: 28px;
        margin: 0;
        background: transparent;
        cursor: pointer;
      }
      #${controlsId} .panel input[type='range']::-webkit-slider-runnable-track {
        height: 4px;
        border-radius: 4px;
        background: color-mix(in srgb, currentColor 45%, transparent);
      }
      #${controlsId} .panel input[type='range']::-webkit-slider-thumb {
        appearance: none;
        width: 14px;
        height: 14px;
        margin-top: -5px;
        border-radius: 50%;
        background: var(--panel-accent);
      }
      #${controlsId} .panel input[type='range']:disabled { opacity: .55; cursor: not-allowed; }
      #${controlsId} .panel input[type='range']:disabled::-webkit-slider-thumb { background: currentColor; }
      #${controlsId} .surface-override-controls output { color: color-mix(in srgb, var(--app-color-text-foreground, white) 78%, transparent); font-variant-numeric: tabular-nums; }
      #${controlsId} .panel .surface-override-controls button { padding: 4px 8px; font-size: 12px; }
      #${controlsId} .preset-editor, #${controlsId} .settings-transfer, #${controlsId} .preset-row, #${controlsId} .reset-groups { display: grid; gap: 8px; }
      #${controlsId} .preset-editor { grid-template-columns: minmax(0, 1fr) auto; }
      #${controlsId} .preset-list { display: grid; gap: 8px; }
      #${controlsId} .preset-row { grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; }
      #${controlsId} .settings-transfer, #${controlsId} .reset-groups { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      #${controlsId} .preset-list:empty { display: none; }
      #${controlsId} .reset-groups [data-reset-group='all'] { grid-column: 1 / -1; }
      #${controlsId} .panel .reset { justify-self: start; margin-top: 4px; color: var(--color-text-danger, #f07474); }
      html[data-theme='light'] #${controlsId} .panel .reset { color: var(--color-text-danger, #ab2424); }
      @media (max-width: 520px) {
        #${controlsId} .panel, html:has([data-composer-surface-variant]) #${controlsId} .panel {
          --panel-inset: 14px;
          width: min(400px, calc(100% - 16px));
          height: min(82vh, calc(100dvh - 64px));
          position-anchor: auto;
          position-area: none;
          inset: auto 8px 52px auto;
          place-self: auto;
        }
      }
      @media (max-width: 400px) {
        #${controlsId} .panel-tabs { gap: 4px; }
        #${controlsId} .panel-tabs button { font-size: 12px; }
        #${controlsId} .wallpaper-list { grid-template-columns: 1fr; }
      }
      :root {
        --codex-wallpaper-surface-base: ${surface};
        --codex-wallpaper-panel-base: ${under};
        --codex-wallpaper-raised: color-mix(in srgb, var(--app-color-background-surface-under, rgb(12 12 16)) 90%, transparent);
        --codex-wallpaper-settings-canvas-base: var(--app-color-background-surface-under, rgb(12 12 16));
        --codex-wallpaper-settings-card-base: var(--app-color-background-surface, rgb(24 24 28));
        --codex-wallpaper-settings-control: color-mix(in srgb, var(--app-color-text-foreground, rgb(245 245 250)) 6%, transparent);
        --codex-wallpaper-line: color-mix(in srgb, var(--app-color-text-foreground, rgb(245 245 250)) 10%, transparent);
        --codex-wallpaper-line-strong: color-mix(in srgb, var(--app-color-text-foreground, rgb(245 245 250)) 16%, transparent);
        --codex-wallpaper-radius: 14px;
        --codex-wallpaper-radius-sm: 9px;
        --codex-wallpaper-shadow: 0 12px 34px rgb(0 0 0 / .22);
      }
      html[data-theme='light'] {
        --codex-wallpaper-settings-canvas-base: var(--app-color-background-surface-under, rgb(232 232 237));
        --codex-wallpaper-settings-card-base: var(--app-color-background-surface, rgb(247 247 249));
      }
      body :where([data-app-shell-main-surface], [data-app-shell-page-sidebar], [data-app-shell-titlebar], [data-app-shell-pane-content-viewport], [data-app-shell-trailing-sidebar]) { background-color: ${frame} !important; backdrop-filter: var(--codex-wallpaper-interface-blur);
        &:not([data-app-shell-titlebar]) { position: relative; z-index: 1; }
      }
      body [data-app-shell-workspace] > [data-app-shell-surface-backing] { background-color: transparent !important; }
      body [data-app-shell-main-surface] { background-color: ${canvas} !important; border-radius: 0 var(--codex-wallpaper-radius) 0 0 !important; --color-text-tertiary: var(--color-text-secondary); }
      body [data-app-shell-page-sidebar], body [data-app-shell-titlebar] { background-color: color-mix(in srgb, var(--app-color-background-surface, rgb(24 24 28)) var(--codex-wallpaper-sidebar-opacity), transparent) !important; }
      body [data-app-shell-pane-content-viewport], body [data-app-shell-trailing-sidebar] { background-color: color-mix(in srgb, var(--app-color-background-surface, rgb(24 24 28)) var(--codex-wallpaper-right-opacity), transparent) !important; box-shadow: inset 1px 0 0 var(--codex-wallpaper-line); }
      body [data-app-shell-tabs] [data-app-shell-compact-page-gutter='false'] { background-color: transparent !important; }
      body :where([data-app-navigation-rail], [data-slate-sidebar-content]) {
        background-color: transparent !important;
        box-shadow: inset -1px 0 0 var(--codex-wallpaper-line);
        --color-text-tertiary: var(--color-text-secondary);
      }
      body :is([data-app-shell-titlebar], [data-app-shell-frame] > :has(> [role='menubar'])) {
        background-color: ${surfaceColor(surface, "top")} !important;
        box-shadow: inset 0 -1px 0 var(--codex-wallpaper-line);
        --color-text-tertiary: var(--color-text-secondary);
      }
      body [data-app-shell-trailing-sidebar] [role='tablist'] { background-color: transparent !important; box-shadow: inset 0 -1px 0 var(--codex-wallpaper-line); }
      body [data-app-shell-trailing-sidebar] file-tree-container { --trees-bg-override: transparent !important; background-color: transparent !important; }
      body [data-app-shell-page-surface] { background-color: transparent !important; backdrop-filter: none; }
      body [data-browser-sidebar-webview] { background-color: var(--app-color-background-surface-under, rgb(12, 12, 16)) !important; opacity: 1 !important; }
      body [data-browser-sidebar-webview] > webview { background-color: var(--app-color-background-surface-under, rgb(12, 12, 16)) !important; }
      body [data-app-shell-frame] { background-color: ${frame} !important; }
      /* Resolve the settings route once before matching its descendant rules. */
      body [data-app-shell-feature-navigation='true']:has([data-settings-nav-scroll-container]) { --codex-wallpaper-native-settings: active; }
      @container style(--codex-wallpaper-native-settings: active) {
        body [data-app-shell-feature-navigation='true'] {
          & main[data-app-shell-main-surface] :where([class~='electron:bg-surface']) { background-color: ${surfaceColor("var(--codex-wallpaper-settings-canvas-base)", "settings-canvas")} !important; }
          & main[data-app-shell-main-surface] :where([class~='rounded-2xl'][class~='border-default']) {
            background-color: ${surfaceColor("var(--codex-wallpaper-settings-card-base)", "settings-card")} !important;
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
      }
      body [data-app-shell-main-surface] :where([data-testid='webmcp-tool-scroll'], [data-summary-panel-variant], pre) { background-color: var(--codex-wallpaper-raised) !important; }
      body :is([data-app-shell-page-sidebar]:not([data-app-shell-frame]), [data-app-shell-trailing-sidebar], [data-app-shell-pane-content-viewport]) :where([class~='bg-surface'], [data-testid='diff-preview-scroll'], pre:not(.composer-diff-simple-line pre)) { background-color: var(--codex-wallpaper-raised) !important; }
      body [data-app-shell-main-surface] :where([data-testid='webmcp-tool-scroll'], [data-summary-panel-variant]) { border-radius: var(--codex-wallpaper-radius) !important; box-shadow: inset 0 0 0 1px var(--codex-wallpaper-line-strong), 0 12px 34px rgb(0 0 0 / .18) !important; }
      body [data-pip-obstacle='thread-footer-leading'] { background-color: var(--codex-wallpaper-raised) !important; }
      body [data-composer-surface-variant] { background-color: var(--codex-wallpaper-raised) !important; border-radius: var(--codex-wallpaper-radius) !important; box-shadow: inset 0 0 0 1px var(--codex-wallpaper-line-strong), 0 12px 32px rgb(0 0 0 / .16) !important; }
      body [data-composer-surface-variant]:hover { background-color: color-mix(in srgb, var(--app-color-text-foreground, rgb(245 245 250)) 4%, var(--codex-wallpaper-raised)) !important; }
      body [data-composer-surface-variant]:focus-within { box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--app-color-text-foreground, rgb(245 245 250)) 32%, transparent), 0 12px 32px rgb(0 0 0 / .16) !important; }
      body [data-app-shell-main-content-top-fade] > [aria-hidden='true'] { background-image: linear-gradient(${canvas}, transparent) !important; }
      body [data-thread-scroll-footer] [class~='bg-surface']:not([data-composer-surface-variant], [data-composer-surface-variant] *, [data-pip-obstacle='thread-footer-leading'], [data-pip-obstacle='thread-footer-leading'] *) { background-color: transparent !important; }
      body [data-app-action-timeline-scroll] > :has(> [data-thread-scroll-footer])::before,
      body [data-app-action-timeline-scroll] > :has(> [data-thread-scroll-footer])::after { background: none !important; }
      body [data-app-shell-trailing-sidebar] [data-thread-find-target='review'] { background-color: transparent !important; }
      body [data-app-shell-trailing-sidebar] :is([data-thread-find-target='review'], [data-testid='diff-preview-scroll']) {
        --diffs-bg-addition: color-mix(in srgb, var(--color-codex-diff-added, transparent) 24%, transparent) !important;
        --diffs-bg-deletion: color-mix(in srgb, var(--color-codex-diff-deleted, transparent) 24%, transparent) !important;
      }
      body [data-app-shell-trailing-sidebar] [data-testid='diff-preview-scroll'] .composer-diff-simple-line { background-color: color-mix(in srgb, var(--app-color-background-surface-under, rgb(12 12 16)) 78%, transparent) !important; border-radius: var(--codex-wallpaper-radius-sm); }
      body :where([role='dialog'], [role='menu']) { background-color: ${panelColor} !important; }
      body [role='dialog'].settings-dialog:has([data-settings-nav-scroll-container]) {
        & .settings-dialog-sidebar, & [data-settings-panel] .settings-dialog-content {
          background-color: transparent !important;
        }
      }
      body [data-radix-popper-content-wrapper] { background-color: transparent !important; }
      body :where([role='menu'], [data-radix-popper-content-wrapper]) :is([role^='menuitem'], [data-radix-collection-item]) { border-radius: var(--codex-wallpaper-radius-sm); }
      body :where([role='menu'], [data-radix-popper-content-wrapper]) :is([role^='menuitem'], [data-radix-collection-item]):is(:hover:where(:not([aria-disabled='true'], [data-disabled], :disabled)), :focus-visible) { background-color: color-mix(in srgb, var(--app-color-text-foreground, white) 9%, transparent) !important; }
      body :where([role='menu'], [data-radix-popper-content-wrapper]) :is([aria-checked='true'], [aria-selected='true'], [data-state='checked']) { background-color: color-mix(in srgb, var(--app-color-accent-blue, rgb(51 156 255)) 18%, transparent) !important; }
      body :where([role='menu'], [data-radix-popper-content-wrapper]) :is([aria-disabled='true'], :disabled) { opacity: .48; cursor: not-allowed; }
      body [data-codex-wallpaper-usage-action] { cursor: pointer; }
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

export function runtimeSource(
  payload,
  hostReady = false,
  waitForMainInterface = false,
  desktopStartup = false
) {
  const css = createRuntimeStyles(
    "codex-wallpaper-p1",
    "codex-wallpaper-p1-controls"
  );
  return `(${createCodexWallpaperRuntime.toString()})(${JSON.stringify(
    payload
  )}, ${JSON.stringify(css)}, ${JSON.stringify(candidateIdentity())}, ${JSON.stringify(hostReady)}, ${JSON.stringify(waitForMainInterface)}, ${JSON.stringify(desktopStartup)})`;
}

function createCodexWallpaperRuntime(
  payload,
  runtimeCss,
  identity,
  initialHostReady = false,
  waitForMainInterface = false,
  desktopStartup = false
) {
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
  let interfaceRules = [];

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
    const profile = performanceProfiles[next.performanceProfile];
    if (
      profile &&
      (Number(next.fps) !== profile.fps ||
        Boolean(next.pauseWhenHidden) !== profile.pauseWhenHidden)
    )
      next.performanceProfile = "custom";
    return next;
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
  let startupVideo = sourcePayload.startupVideo;
  let hostReady = initialHostReady;
  let mainInterfaceShown = !waitForMainInterface;
  let cancelMainInterfaceWait = null;
  let startupImport = null;
  let startupAssetError = null;
  let startupInterfaceAt = null;
  let startupFrameAt = null;
  let resolveStartupPresentation = null;
  let importedLibraryLoaded = false;
  let rotationImportsLoading = false;
  let root = null;
  let removeUsageMenuInteraction;
  let panel = null;
  let panelReturnFocus = null;
  let layer = null;
  let media = null;
  let presentedMedia = null;
  let committedSelection = null;
  let previewKey = null;
  let previewPicture = null;
  let previewImageData = null;
  let scenePreview = null;
  let previewResizeTimer = null;
  let startupMotion = null;
  let startupMotionToken = 0;
  let dim = null;
  let status = null;
  let playback = null;
  let currentObjectUrl = null;
  let rotationTimer = null;
  let activeGeneration = 0;
  let pendingRender = null;
  let imported = [];
  let database = null;
  let openingDatabase = null;
  const runtimeAssets = new Map();
  const assetRequestTokens = new Map();
  const pendingPreviewRequests = new Set();
  const failedPreviewIds = new Set();
  const importedPreviewUrls = new Map();
  const assetTransfers = new Map();
  const assetFileTransfers = new Map();
  const channel = new BroadcastChannel("codex-wallpaper-p1");
  const runtimeEvents = new AbortController();
  const previewObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      previewObserver.unobserve(entry.target);
      requestPreview(entry.target.dataset.previewId);
    }
  });
  let measuredFps = 0;
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
    const rotationChanged = pendingConfigFields.delete("rotationMinutes");
    pendingConfigFields.clear();
    localStorage.setItem(configKey, JSON.stringify(config));
    publishStartupPreview();
    if (rotationChanged) scheduleRotation();
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
        .filter(
          ([key, definition]) =>
            definition.group === "appearance" &&
            !valuesEqual(previous.settings[key], next.settings[key])
        )
        .map(([key]) => key),
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
    if (openingDatabase) return openingDatabase;
    const opening = new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(dbStore))
          db.createObjectStore(dbStore, { keyPath: "id" });
      };
      request.onsuccess = () => {
        if (openingDatabase !== opening || runtimeEvents.signal.aborted) {
          request.result.close();
          reject(new Error("Wallpaper database read cancelled"));
          return;
        }
        openingDatabase = null;
        database = request.result;
        resolve(database);
      };
      request.onerror = () => {
        if (openingDatabase === opening) openingDatabase = null;
        reject(request.error);
      };
    });
    openingDatabase = opening;
    return opening;
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
    if (database !== db) return;
    imported = values
      .filter((item) => item?.blob)
      .sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
    importedLibraryLoaded = true;
  }

  async function readImported(id) {
    const db = await openDatabase();
    return requestResult(
      db.transaction(dbStore, "readonly").objectStore(dbStore).get(id)
    );
  }

  function mediaType(blob) {
    if (blob.type.startsWith("image/")) return "image";
    if (blob.type.startsWith("video/")) return "video";
    return null;
  }

  function importedEntry(item) {
    return {
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
    };
  }

  function workshopEntry(item) {
    return { ...item, kind: "workshop" };
  }

  function libraryEntries() {
    return [
      ...imported.map(importedEntry),
      ...(sourcePayload.library || []).map(workshopEntry),
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
      (item) => item.kind === active.kind && item.id === active.id
    );
    return entry
      ? { ...entry, ...(runtimeAssets.get(entryKey(entry)) || {}) }
      : null;
  }

  function entryKey(entry) {
    return `${entry.kind}:${entry.id}`;
  }

  function setStatus(message) {
    if (status) status.textContent = message;
  }

  function releasePlayback(target) {
    if (!target) return;
    if (target.raf) cancelAnimationFrame(target.raf);
    if (target.video) {
      const { video } = target;
      video.pause();
      video.removeAttribute("src");
      video.load();
      video.remove();
    }
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

  function cancelAssetFileTransfer(token) {
    const transfer = assetFileTransfers.get(String(token));
    if (!transfer) return false;
    assetFileTransfers.delete(String(token));
    transfer.input.remove();
    transfer.resolve(null);
    return true;
  }

  function cancelPendingRender() {
    const pending = pendingRender;
    pendingRender = null;
    pending?.cancel();
  }

  function revokePlayback() {
    cancelPendingRender();
    measuredFps = 0;
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
    if (playback) applyPlaybackSettings({ volume: true, fps: true });
    syncMediaCapabilities();
    if (loadingEntryKey) {
      loadingEntryKey = null;
      syncCardState(config.active);
    }
    if (desktopStartup) {
      committedSelection = JSON.stringify(config.active);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (
            media !== next ||
            !config.enabled ||
            committedSelection !== JSON.stringify(config.active)
          )
            return;
          presentedMedia = next;
          startupFrameAt = Date.now();
          settleStartupPresentation();
          setTimeout(() => {
            if (
              config.enabled &&
              media === next &&
              !runtimeEvents.signal.aborted
            )
              publishStartupPreview();
          }, 0);
        })
      );
    }
  }

  function makeStartupPoster(picture) {
    const canvas = document.createElement("canvas");
    const width =
      picture?.videoWidth ?? picture?.naturalWidth ?? picture?.width ?? 1280;
    const height =
      picture?.videoHeight ?? picture?.naturalHeight ?? picture?.height ?? 800;
    const scale = Math.min(1, 2560 / Math.max(width, height));
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d");
    if (picture) {
      if (picture instanceof HTMLCanvasElement) {
        context.fillStyle = "#16161b";
        context.fillRect(0, 0, canvas.width, canvas.height);
      }
      context.drawImage(picture, 0, 0, canvas.width, canvas.height);
    } else {
      const gradient = context.createLinearGradient(
        0,
        0,
        canvas.width,
        canvas.height
      );
      gradient.addColorStop(0, "#1b2ab5");
      gradient.addColorStop(0.48, "#5d32b8");
      gradient.addColorStop(1, "#d44c87");
      context.fillStyle = gradient;
      context.fillRect(0, 0, canvas.width, canvas.height);
      for (const [x, y, radius, color] of [
        [0.18, 0.2, 0.36, "#57d7ff"],
        [0.82, 0.78, 0.38, "#ff9ac6"],
      ]) {
        const shine = context.createRadialGradient(
          x * canvas.width,
          y * canvas.height,
          0,
          x * canvas.width,
          y * canvas.height,
          radius * canvas.width
        );
        shine.addColorStop(0, color);
        shine.addColorStop(1, "transparent");
        context.fillStyle = shine;
        context.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
    const poster = canvas.toDataURL("image/jpeg", 0.9);
    return poster.length <= 1_700_000
      ? poster
      : canvas.toDataURL("image/jpeg", 0.78);
  }

  function startupScenePoster(scene, fit) {
    const canvas = scene.canvas;
    if (
      !(canvas instanceof HTMLCanvasElement) ||
      !media.contains(canvas) ||
      !canvas.clientHeight
    )
      return undefined;
    const aspect = Math.round((100 * canvas.clientWidth) / canvas.clientHeight);
    if (
      scenePreview?.scene === scene &&
      scenePreview.fit === fit &&
      scenePreview.aspect === aspect
    )
      return scenePreview.poster;
    // WebWallGL 3.0.0 exposes its editor through this runtime link. Its capture
    // copies the frame before WebGL clears the buffer, without resizing the scene.
    const editor =
      globalThis[Symbol.for("webwallgl.runtime-link")]?.get(scene)?.sceneCtl
        ?.editor;
    if (typeof editor?.captureFrame !== "function") return undefined;

    const capture = { scene, fit, aspect, poster: undefined };
    scenePreview = capture;
    void (async () => {
      try {
        const frame = await editor.captureFrame();
        if (
          scenePreview !== capture ||
          playback?.scene !== scene ||
          !config.enabled
        )
          return;
        if (Math.abs((100 * frame.width) / frame.height - aspect) > 1) return;
        capture.poster = makeStartupPoster(frame);
        publishStartupPreview();
      } catch {
        // The author preview remains available when a scene cannot be captured.
      }
    })();
    return undefined;
  }

  function cancelStartupMotion() {
    const work = startupMotion;
    startupMotion = null;
    if (!work) return;
    clearTimeout(work.timer);
    work.stop?.();
  }

  function planStartupMotion(element, active, fitMode, aspect) {
    if (
      element &&
      startupMotion?.element === element &&
      startupMotion.fitMode === fitMode &&
      startupMotion.aspect === aspect
    )
      return;
    cancelStartupMotion();
    if (
      document.visibilityState !== "visible" ||
      typeof element?.captureStream !== "function" ||
      !globalThis.MediaRecorder?.isTypeSupported("video/webm;codecs=vp8")
    )
      return;
    const work = { element, fitMode, aspect, token: ++startupMotionToken };
    startupMotion = work;
    work.timer = setTimeout(() => {
      globalThis.__codexWallpaperHostRequest(
        JSON.stringify({
          type: "startup-motion-needed",
          kind: active.kind,
          id: active.id,
          fitMode,
          aspect,
          token: work.token,
        })
      );
    }, 2200);
  }

  function startupMotionDecision(token, needed) {
    const work = startupMotion;
    if (work?.token !== token || !needed || work.stop) return;
    let stream;
    try {
      const { element } = work;
      const width = element.videoWidth ?? element.width;
      const height = element.videoHeight ?? element.height;
      stream =
        element instanceof HTMLCanvasElement
          ? element.captureStream(24)
          : element.captureStream();
      const tracks = stream.getVideoTracks();
      if (!tracks.length)
        throw new Error("Wallpaper does not expose a video track");
      const recorder = new MediaRecorder(new MediaStream(tracks), {
        mimeType: "video/webm;codecs=vp8",
        videoBitsPerSecond: 10_000_000,
      });
      const stopTracks = () =>
        stream.getTracks().forEach((track) => track.stop());
      const stopRecorder = () => {
        clearTimeout(work.timer);
        if (recorder.state !== "inactive") recorder.stop();
        stopTracks();
      };
      work.stop = stopRecorder;
      const parts = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) parts.push(event.data);
      };
      recorder.onerror = () => {
        if (startupMotion === work) cancelStartupMotion();
      };
      recorder.onstop = () => {
        stopTracks();
        if (startupMotion !== work || !parts.length) return;
        const clip = new Blob(parts, { type: "video/webm" });
        if (clip.size > 6_000_000 || clip.size < 256) return;
        const reader = new FileReader();
        reader.onload = () => {
          if (startupMotion !== work || !work.element.isConnected) return;
          const webm = String(reader.result).split(",", 2)[1];
          const size = 192 * 1024;
          for (
            let offset = 0, index = 0;
            offset < webm?.length;
            offset += size, index++
          ) {
            globalThis.__codexWallpaperHostRequest(
              JSON.stringify({
                type: "startup-motion-chunk",
                token,
                index,
                width,
                height,
                last: offset + size >= webm.length,
                data: webm.slice(offset, offset + size),
              })
            );
          }
        };
        reader.readAsDataURL(clip);
      };
      recorder.start();
      work.timer = setTimeout(stopRecorder, 3600);
    } catch {
      stream?.getTracks().forEach((track) => track.stop());
    }
  }

  function publishStartupPreview() {
    if (
      !desktopStartup ||
      typeof globalThis.__codexWallpaperHostRequest !== "function"
    )
      return;
    const { enabled, active, settings } = config;
    const { dim, opacity, fitMode } = settings;
    const selection = JSON.stringify(active);
    const presented =
      enabled && media === presentedMedia && committedSelection === selection;
    const scene = presented ? playback?.scene : null;
    const scenePoster = scene ? startupScenePoster(scene, fitMode) : undefined;
    if (!scene) scenePreview = null;
    const picture =
      presented && activeMediaType() !== "scene"
        ? media?.querySelector("img, video")
        : null;
    const video =
      picture instanceof HTMLVideoElement
        ? { width: picture.videoWidth, height: picture.videoHeight }
        : undefined;
    const aspect = scenePoster ? scenePreview.aspect : undefined;
    const motionElement = scenePoster
      ? scene.canvas
      : video && active.kind === "imported"
        ? picture
        : null;
    planStartupMotion(motionElement, active, fitMode, aspect);
    const pictureKey = scenePoster ?? picture;
    const key = JSON.stringify(
      enabled ? [selection, dim, opacity, fitMode] : [false]
    );
    if (previewKey === key && (!pictureKey || pictureKey === previewPicture))
      return;
    if (pictureKey !== previewPicture) previewImageData = null;
    previewKey = key;
    previewPicture = pictureKey;
    let poster =
      scenePoster ??
      (picture || active.kind === "builtin" ? previewImageData : undefined);
    try {
      if (!poster && enabled && (picture || active.kind === "builtin"))
        previewImageData = poster = makeStartupPoster(picture);
    } catch {
      // Unsupported media can still use its local workshop preview.
    }
    globalThis.__codexWallpaperHostRequest(
      JSON.stringify({
        type: "startup-preview",
        enabled,
        kind: active.kind,
        id: active.id,
        poster,
        source: scenePoster ? "scene-frame" : "media",
        dim,
        opacity,
        fitMode,
        video,
        aspect,
      })
    );
  }

  function stageMedia() {
    const next = document.createElement("div");
    next.className = "media staged";
    layer.insertBefore(next, dim);
    return next;
  }

  function trackPending(cancel, resume = null) {
    const pending = { cancelled: false, settled: false, resume };
    pending.cancel = () => {
      if (pending.cancelled) return;
      pending.cancelled = true;
      cancel();
    };
    pendingRender = pending;
    return pending;
  }

  function finishPending(pending) {
    if (pendingRender === pending) pendingRender = null;
  }

  function isCurrentStage(generation, pending) {
    if (!pending.cancelled && generation === activeGeneration) return true;
    pending.cancel();
    return false;
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

  function shouldPauseHidden() {
    return (
      config.settings.pauseWhenHidden && document.visibilityState === "hidden"
    );
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
      return "Scene 可限制渲染帧率。性能优先为 15 FPS，均衡为 30 FPS。";
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

  function bindInterfaceAppearance(rules) {
    const token =
      /var\(--codex-wallpaper-((?:surface|chat|sidebar|top|right|settings(?:-canvas|-card)?)-opacity|interface-blur)\)/g;
    for (const rule of rules) {
      for (const property of rule.style || []) {
        const template = rule.style.getPropertyValue(property);
        if (!template.match(token)) continue;
        const priority = rule.style.getPropertyPriority(property);
        let previous;
        interfaceRules.push((values) => {
          const next = template.replace(token, (_, key) => values[key]);
          if (next === previous) return;
          rule.style.setProperty(property, next, priority);
          previous = next;
        });
      }
      if (rule.cssRules) bindInterfaceAppearance(rule.cssRules);
    }
  }

  function applyInterfaceAppearance() {
    const settingsOpacity = surfaceOpacityValue("settings");
    const blur = Math.max(
      0,
      Math.min(24, Number(config.settings.interfaceBlur) || 0)
    );
    // Updating inherited variables on html invalidates unrelated Codex styles
    // during a drag. Update the original surface declarations instead.
    const values = {
      "surface-opacity": `${Math.max(20, Math.min(100, Number(config.settings.surfaceOpacity) || 72))}%`,
      "chat-opacity": `${surfaceOpacityValue("chat")}%`,
      "sidebar-opacity": `${surfaceOpacityValue("sidebar")}%`,
      "top-opacity": `${hasSurfaceOverride("sidebar") ? surfaceOpacityValue("sidebar") : 0}%`,
      "right-opacity": `${surfaceOpacityValue("right")}%`,
      "settings-opacity": `${settingsOpacity}%`,
      "settings-canvas-opacity": `${Math.round(settingsOpacity * 0.68)}%`,
      "settings-card-opacity": `${Math.round(settingsOpacity * 0.45)}%`,
      "interface-blur": blur > 0 ? `blur(${blur}px)` : "none",
    };
    for (const apply of interfaceRules) apply(values);
  }

  function applyInterfaceBorders() {
    const style = document.documentElement.style;
    for (const property of [
      "--codex-wallpaper-line",
      "--codex-wallpaper-line-strong",
    ]) {
      if (config.settings.interfaceBorders) style.removeProperty(property);
      else style.setProperty(property, "transparent");
    }
  }

  function applyVisualSettings(key) {
    if (
      !key ||
      ["surfaceOpacity", "surfaceOverrides", "interfaceBlur"].includes(key)
    )
      applyInterfaceAppearance();
    if (!key || key === "interfaceBorders") applyInterfaceBorders();
    if (!layer || !media || !dim) return;
    if (!key || key === "opacity")
      layer.style.opacity = String(config.settings.opacity / 100);
    if (!key || key === "blur")
      media.style.filter = config.settings.blur
        ? `blur(${config.settings.blur}px)`
        : "";
    if (!key || key === "dim")
      dim.style.background = `rgb(4 6 15 / ${config.settings.dim / 100})`;
    if (key && key !== "fitMode") return;
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
    scheduleRotation();
    if (!playback) return;
    if (shouldPauseHidden()) {
      playback.video?.pause();
      playback.pause?.();
      if (playback.raf) cancelAnimationFrame(playback.raf);
      return;
    }
    playback.video?.play().catch(() => {});
    playback.resume?.();
  }

  function applyCurrentSettings() {
    applyVisualSettings();
    applyPlaybackSettings({ volume: true, fps: true });
    applyHiddenPolicy();
    syncSettingControls();
  }

  function markSettingsChanged(performance = false) {
    const hadActivePreset = config.activePresetId !== null;
    config.activePresetId = null;
    if (performance) {
      config.settings.performanceProfile = "custom";
      pendingConfigFields.add("performanceProfile");
    }
    if (hadActivePreset) syncPresetUi();
  }

  function setControlText(element, value) {
    const text = `${value}${element.dataset.unit || ""}`;
    const current = element.firstChild;
    if (!current) element.append(text);
    else if (current.data !== text) current.data = text;
  }

  function syncSettingControls() {
    if (!panel) return;
    for (const input of panel.querySelectorAll(".range input[type='range']"))
      syncRangeValue(input, config.settings[input.dataset.setting]);
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
        if (output) setControlText(output, input.value);
      }
      if (restore) restore.disabled = !enabled;
    }
    syncPerformanceControls();
  }

  function syncPerformanceControls() {
    const profile = panel?.querySelector("[data-playback-profile]");
    if (!profile) return;
    profile.value = config.settings.performanceProfile;
    const summary = panel.querySelector("[data-performance-summary]");
    setControlText(summary, performanceSummary());
    const tradeoff = panel.querySelector("[data-performance-tradeoff]");
    setControlText(tradeoff, performanceTradeoff());
  }

  function syncMediaCapabilities() {
    const hint = panel?.querySelector("[data-audio-capability]");
    if (!hint) return;
    const fit = panel.querySelector("[data-setting='fitMode']");
    if (fit) {
      const supported = playback?.scene
        ? playback.supportsFit
        : Boolean(media?.querySelector("img, video"));
      fit.disabled = !supported;
      setControlText(
        fit.previousElementSibling,
        supported ? "画面适配" : "画面适配（当前画面不适用）"
      );
    }
    const type = activeMediaType();
    const canPlayAudio =
      (type === "video" && Boolean(playback?.video)) ||
      (type === "scene" && Boolean(playback?.setVolume));
    const volume = panel.querySelector("[data-setting='volume']");
    volume.disabled = !canPlayAudio;
    volume.closest(".range").querySelector(".range-value button").disabled =
      !canPlayAudio;
    panel.querySelector("[data-setting='muted']").disabled = !canPlayAudio;
    syncPauseControl();
    hint.hidden = canPlayAudio;
    hint.textContent = ["video", "scene"].includes(type)
      ? "静音和音量仅在原生播放时可用。"
      : "当前素材不适用静音和音量。";
    const capability = panel.querySelector("[data-playback-capability]");
    const fps = panel.querySelector("[data-setting='fps']");
    if (fps) {
      fps.disabled = !playback?.setFps;
      fps.closest(".range").querySelector(".range-value button").disabled =
        fps.disabled;
    }
    setControlText(
      capability,
      fps?.disabled
        ? "帧率上限仅在 Scene 原生渲染时可用。"
        : playbackCapabilityText()
    );
  }

  function syncPauseControl(
    canRotate = config.settings.rotationMinutes > 0 &&
      playlistEntries().length >= 2
  ) {
    const toggle = panel?.querySelector("[data-setting='pauseWhenHidden']");
    if (!toggle) return;
    toggle.disabled = !canRotate && !playback?.video && !playback?.scene;
    setControlText(
      toggle.nextElementSibling,
      toggle.disabled
        ? "不可见时暂停（当前无动态播放或轮播）"
        : "不可见时暂停播放和轮播"
    );
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
      const entry = findEntry(key);
      if (entry) setControlText(status, entryStatusText(entry));
    }
  }

  function cardFor(key) {
    return panel?.querySelector(
      `.card[data-entry-kind="${CSS.escape(key.kind)}"][data-entry-id="${CSS.escape(key.id)}"]`
    );
  }

  function syncCardState(key) {
    const item = cardFor(key);
    if (item) updateCardState(item);
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
    if (
      !panel?.classList.contains("open") ||
      panel.querySelector("[data-panel-region='library']").hidden
    )
      return;
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

  function syncPlaylistSummary() {
    const summary = panel?.querySelector(".playlist-summary");
    if (!summary) return;
    const queued = playlistEntries();
    summary.textContent = queued.length
      ? `轮播：${queued.map((entry) => entry.title).join(" · ")}`
      : "轮播列表为空";
  }

  function syncConfigUi(change) {
    for (const key of change.appearance) applyVisualSettings(key);
    applyPlaybackSettings(change);
    if (change.favorites || change.playlist) {
      for (const item of panel?.querySelectorAll(".card") || [])
        updateCardState(item);
      if (change.favorites) applyLibraryFilters();
    }
    if (change.playlist) syncPlaylistSummary();
    syncSettingControls();
    if (change.presets) renderPresetList();
    if (change.pauseWhenHidden) applyHiddenPolicy();
    else if (change.rotation || change.playlist) scheduleRotation();
  }

  async function applyConfigChange(change) {
    if (!config.enabled) {
      publishStartupPreview();
      return root || cancelMainInterfaceWait ? disable(false) : state();
    }
    if (!root) {
      publishStartupPreview();
      return restoreActive();
    }
    syncConfigUi(change);
    publishStartupPreview();
    if (change.enabled || change.identity) {
      await applyActive();
    }
    return state();
  }

  function recoverFailedMedia(message, previewUrl = null) {
    if (loadingEntryKey) {
      failedEntryKeys.add(loadingEntryKey);
      loadingEntryKey = null;
      syncCardState(config.active);
    }
    if (
      media &&
      (media.classList.contains("builtin") ||
        media.querySelector("img, video, canvas, iframe, .scene-host.ready"))
    ) {
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
    assetRequestTokens.clear();
    pendingPreviewRequests.clear();
    if (root) await applyActive();
    else if (config.enabled && !mainInterfaceShown) await restoreActive();
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
    const pending = trackPending(() => {
      image.onerror = null;
      next.remove();
      releaseObjectUrl(objectUrl, currentObjectUrl);
    });
    const fail = () => {
      if (pending.settled) return;
      pending.settled = true;
      finishPending(pending);
      if (!isCurrentStage(generation, pending)) return;
      next.remove();
      releaseObjectUrl(objectUrl, currentObjectUrl);
      recoverFailedMedia("素材加载失败");
    };
    const commit = () => {
      if (pending.settled) return;
      pending.settled = true;
      finishPending(pending);
      if (!isCurrentStage(generation, pending)) return;
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
    let frameRequest = 0;
    let resume = null;
    const current = {
      video,
    };
    const pending = trackPending(
      () => {
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
      if (pending.settled) return;
      pending.settled = true;
      finishPending(pending);
      if (!isCurrentStage(generation, pending)) return;
      pending.cancel();
      recoverFailedMedia("视频加载失败", previewUrl);
    };
    const drawFirstFrame = () => {
      if (pending.settled) return;
      if (!isCurrentStage(generation, pending)) return;
      if (
        video.seeking ||
        !video.videoWidth ||
        !video.videoHeight ||
        video.readyState < 2
      )
        return;
      pending.settled = true;
      finishPending(pending);
      if (frameRequest) video.cancelVideoFrameCallback?.(frameRequest);
      video.onloadedmetadata = null;
      commitMedia(next, current, objectUrl);
      if (shouldPauseHidden()) video.pause();
      if (message) setStatus(message);
    };
    const waitForPresentedFrame = () => {
      if (
        pending.settled ||
        pending.cancelled ||
        generation !== activeGeneration ||
        frameRequest
      )
        return;
      if (typeof video.requestVideoFrameCallback === "function") {
        frameRequest = video.requestVideoFrameCallback(() => {
          frameRequest = 0;
          drawFirstFrame();
          // Chromium can present before the element reports HAVE_CURRENT_DATA.
          waitForPresentedFrame();
        });
      } else {
        video.addEventListener("loadeddata", drawFirstFrame, { once: true });
      }
    };
    const drawLoadedFrame = () => {
      if (shouldPauseHidden()) drawFirstFrame();
      else requestAnimationFrame(drawFirstFrame);
    };
    const drawLoadedFrameOrSeek = () => {
      if (video.readyState >= 2) {
        drawLoadedFrame();
        return;
      }
      video.addEventListener("loadeddata", drawLoadedFrame, { once: true });
      video.addEventListener("seeked", drawLoadedFrame, { once: true });
      try {
        video.currentTime = 0.001;
      } catch {}
    };
    resume = () => {
      if (
        pending.settled ||
        pending.cancelled ||
        generation !== activeGeneration
      )
        return;
      if (video.readyState >= 2) drawLoadedFrame();
      video
        .play()
        .then(waitForPresentedFrame)
        .catch(() => {});
    };
    video.onloadedmetadata = () => {
      if (!isCurrentStage(generation, pending)) return;
      if (
        startupVideo &&
        config.active.kind === "workshop" &&
        config.active.id === startupVideo.id &&
        Number.isFinite(video.duration) &&
        video.duration > 0
      ) {
        const elapsed = (Date.now() - startupVideo.started) / 1000;
        startupVideo = null;
        if (elapsed > 0 && elapsed < 35) {
          try {
            video.currentTime = elapsed % video.duration;
          } catch {}
        }
      }
      waitForPresentedFrame();
    };
    video.onerror = fail;
    video
      .play()
      .then(() => {
        if (!isCurrentStage(generation, pending)) return;
        if (shouldPauseHidden()) {
          video.pause();
          drawLoadedFrameOrSeek();
        }
      })
      .catch(() => {
        if (
          pending.settled ||
          pending.cancelled ||
          generation !== activeGeneration
        )
          return;
        drawLoadedFrameOrSeek();
      });
  }

  function bytesFromBase64(encoded) {
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1)
      bytes[index] = binary.charCodeAt(index);
    return bytes;
  }

  async function sceneBytes(assetUrl) {
    if (assetUrl.startsWith("data:"))
      return bytesFromBase64(String(assetUrl).split(",", 2)[1] || "");
    const response = await fetch(assetUrl);
    if (!response.ok) throw new Error(`Scene asset ${response.status}`);
    return new Uint8Array(await response.arrayBuffer());
  }

  function showScene(entry, assetUrl, previewUrl) {
    const generation = activeGeneration;
    const engine = globalThis.WebWallGL;
    const objectUrl = assetUrl.startsWith("blob:") ? assetUrl : null;
    if (!engine?.createScene || !engine?.bytesSource) {
      releaseObjectUrl(objectUrl, currentObjectUrl);
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
    const current = {
      scene: instance,
      supportsFit: typeof instance.setFit === "function",
      pause: () => instance.pause(),
      resume: () => instance.resume(),
      setFps: instance.setFps?.bind(instance),
      setVolume: instance.setVolume?.bind(instance),
      setFit: (fit) => instance.setFit?.(fit),
    };
    const pending = trackPending(() => {
      releasePlayback(current);
      next.remove();
      releaseObjectUrl(objectUrl, currentObjectUrl);
    });
    const fail = () => {
      if (pending.settled) return;
      pending.settled = true;
      finishPending(pending);
      pending.cancel();
      if (generation === activeGeneration)
        recoverFailedMedia(`${entry.title} · Scene 加载失败`, previewUrl);
    };
    sceneBytes(assetUrl)
      .then((bytes) => {
        if (pending.cancelled || generation !== activeGeneration) throw null;
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
        if (pending.settled) return;
        if (!isCurrentStage(generation, pending)) return;
        pending.settled = true;
        finishPending(pending);
        host.classList.add("ready");
        commitMedia(next, current, objectUrl);
        if (shouldPauseHidden()) instance.pause();
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
    const pending = trackPending(() => {
      frame.onload = null;
      next.remove();
    });
    frame.onload = () => {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (pending.settled) return;
          if (!isCurrentStage(generation, pending)) return;
          pending.settled = true;
          finishPending(pending);
          commitMedia(next);
          setStatus(`${entry.title} · Web 离线沙箱`);
        })
      );
    };
    next.append(frame);
    frame.srcdoc = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; script-src 'none'">${entry.webHtml}`;
  }

  function discardInactiveAssetRequests(active) {
    for (const id of assetRequestTokens.keys()) {
      if (isActiveWorkshop(id)) continue;
      assetRequestTokens.delete(id);
      assetTransfers.delete(id);
    }
    for (const [token, transfer] of assetFileTransfers) {
      if (active.kind !== "workshop" || active.id !== transfer.entry.id)
        cancelAssetFileTransfer(token);
    }
  }

  function requestWorkshopAsset(entry) {
    if (
      assetRequestTokens.has(entry.id) ||
      typeof globalThis.__codexWallpaperHostRequest !== "function"
    )
      return;
    const requestToken = crypto.randomUUID();
    assetRequestTokens.set(entry.id, requestToken);
    globalThis.__codexWallpaperHostRequest(
      JSON.stringify({
        type: "load-asset",
        id: entry.id,
        request: requestToken,
      })
    );
  }

  async function applyActive() {
    if (!root) return;
    const generation = ++activeGeneration;
    cancelPendingRender();
    stopRotation();
    const active = config.active || defaults.active;
    discardInactiveAssetRequests(active);
    const entry = findEntry(active);
    loadingEntryKey = entry ? entryKey(entry) : null;
    if (entry) {
      failedEntryKeys.delete(loadingEntryKey);
      setStatus(`正在加载：${entry.title}`);
    }
    const previousCard = panel?.querySelector('.card[data-selected="true"]');
    const selectedCard = cardFor(active);
    if (previousCard && previousCard !== selectedCard)
      updateCardState(previousCard);
    if (selectedCard) updateCardState(selectedCard);
    if (active.kind === "builtin") {
      showGradient("内置渐变");
    } else if (active.kind === "imported") {
      const prepared = startupImport;
      startupImport = null;
      const item =
        prepared?.id === active.id
          ? await prepared.result
          : await readImported(active.id);
      if (generation !== activeGeneration) return state();
      if (!item?.blob) {
        recoverFailedMedia("已跳过缺失的素材");
      } else {
        if (!entry) imported.unshift(item);
        const url = URL.createObjectURL(item.blob);
        if (mediaType(item.blob) === "video") {
          showVideo(url, `${item.title} · 视频`, url);
        } else {
          showImage(url, `${item.title} · 图片`, url);
        }
      }
    } else {
      if (!entry) {
        setStatus("已跳过缺失的壁纸，已保留当前画面");
      } else {
        const assetUrl = entry.assetUrl || entry.assetDataUrl;
        const previewUrl = entry.previewDataUrl;
        if (entry.type === "web" && !entry.webHtml) {
          if (previewUrl)
            showImage(previewUrl, `${entry.title} · Web 预览降级`);
          else recoverFailedMedia(`${entry.title} · Web 离线文件不可用`);
          scheduleRotation();
          renderPanel(false);
          return;
        }
        if (!assetUrl && !entry.webHtml) {
          if (startupAssetError?.id === entry.id) {
            const { message } = startupAssetError;
            startupAssetError = null;
            recoverFailedMedia(`素材加载失败：${message}`, previewUrl);
          } else {
            requestWorkshopAsset(entry);
          }
          scheduleRotation();
          return;
        }
        const url = assetUrl || previewUrl;
        if (entry.type === "scene" && assetUrl) {
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
    renderPanel(false);
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
            entry.webHtml ||
            runtimeAssets.has(entryKey(entry)) ||
            entryState(entry).endsWith("-on-demand"))
      );
  }

  function scheduleRotation() {
    stopRotation();
    const minutes = Number(config.settings.rotationMinutes);
    if (
      config.enabled &&
      minutes > 0 &&
      !importedLibraryLoaded &&
      config.playlist.some((entry) => entry.kind === "imported")
    ) {
      if (!rotationImportsLoading) {
        rotationImportsLoading = true;
        void loadImported()
          .then(() => {
            if (root && importedLibraryLoaded) scheduleRotation();
          })
          .catch(() => {})
          .finally(() => {
            rotationImportsLoading = false;
          });
      }
      return;
    }
    const entries = config.enabled && minutes > 0 ? playlistEntries() : [];
    syncPauseControl(entries.length >= 2);
    if (entries.length < 2 || shouldPauseHidden()) return;
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
    syncCardState(entry);
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
    title.title = entry.title;
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
      config.active = { kind: entry.kind, id: entry.id };
      saveConfig();
      if (entry.type !== "video") requestPreview(entry.id);
      return applyActive();
    };
    const favorite = document.createElement("button");
    favorite.textContent = isFavorite(entry) ? "★" : "☆";
    favorite.dataset.entryAction = "favorite";
    favorite.title = "收藏";
    favorite.setAttribute("aria-label", "收藏");
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

  function syncRangeValue(
    input,
    setting,
    editor = input.parentElement.querySelector(".range-value")
  ) {
    const value = String(setting);
    if (input.value !== value) input.value = value;
    setControlText(editor.querySelector("output"), value);
    const number = editor.querySelector("input");
    if (document.activeElement !== number) number.value = value;
  }

  function rangeValueEditor(label, input, unit, read, preview) {
    const editor = document.createElement("div");
    editor.className = "range-value";
    const button = document.createElement("button");
    button.type = "button";
    button.title = "输入精确值";
    button.setAttribute("aria-label", `${label}，输入精确值`);
    const value = document.createElement("output");
    value.dataset.unit = unit;
    button.append(value);
    const number = document.createElement("input");
    number.type = "number";
    number.min = input.min;
    number.max = input.max;
    number.step = "any";
    number.hidden = true;
    number.setAttribute(
      "aria-label",
      `${label}${unit ? `（${unit.trim()}）` : ""}`
    );
    button.onclick = () => {
      number.value = String(read());
      button.hidden = true;
      number.hidden = false;
      number.focus();
      number.select();
    };
    number.oninput = () => {
      if (number.value && number.validity.valid) preview(number.valueAsNumber);
    };
    number.onblur = () => {
      number.hidden = true;
      button.hidden = false;
      flushConfigSave();
    };
    number.onkeydown = (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      number.blur();
      button.focus();
    };
    editor.append(button, number);
    syncRangeValue(input, read(), editor);
    return editor;
  }

  function range(label, key, min, max, unit = "") {
    const row = document.createElement("div");
    row.className = "range";
    const heading = document.createElement("span");
    heading.textContent = label;
    const input = document.createElement("input");
    input.type = "range";
    input.min = String(min);
    input.max = String(max);
    input.step = "1";
    input.dataset.setting = key;
    input.setAttribute("aria-label", label);
    const preview = (value) => {
      if (value === config.settings[key]) return;
      config.settings[key] = value;
      markSettingsChanged(key === "fps");
      syncRangeValue(input, value);
      if (key === "volume") {
        if (value > 0 && config.settings.muted) {
          config.settings.muted = false;
          panel.querySelector("[data-setting-toggle='muted']").checked = false;
          scheduleConfigSave("muted");
        }
        applyPlaybackSettings({ volume: true });
      } else if (key === "fps") {
        applyPlaybackSettings({ fps: true });
        syncPerformanceControls();
      } else if (key !== "rotationMinutes") {
        applyVisualSettings(key);
      }
      scheduleConfigSave(key);
    };
    input.oninput = () => preview(Number(input.value));
    input.onchange = flushConfigSave;
    input.onblur = flushConfigSave;
    row.append(
      heading,
      input,
      rangeValueEditor(label, input, unit, () => config.settings[key], preview)
    );
    return row;
  }

  function settingToggle(label, key) {
    const row = document.createElement("label");
    row.className = "setting-toggle";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = Boolean(config.settings[key]);
    input.dataset.setting = key;
    input.dataset.settingToggle = key;
    const text = document.createElement("span");
    text.textContent = label;
    input.onchange = () => {
      config.settings[key] = input.checked;
      markSettingsChanged(key === "pauseWhenHidden");
      if (key === "pauseWhenHidden")
        config.settings.performanceProfile = "custom";
      applyPlaybackSettings({ volume: key === "muted" });
      if (key === "pauseWhenHidden") applyHiddenPolicy();
      if (key === "interfaceBorders") applyVisualSettings(key);
      saveConfig();
      syncSettingControls();
    };
    row.append(input, text);
    return row;
  }

  function settingSelect(label, key, options) {
    const row = document.createElement("label");
    row.className = "profile-control";
    const text = document.createElement("span");
    text.textContent = label;
    const select = document.createElement("select");
    select.dataset.setting = key;
    select.dataset.settingSelect = key;
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
      applyVisualSettings(key);
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
    input.setAttribute("aria-label", `${label}强度`);
    input.disabled = !override.checked;
    input.value = String(surfaceOpacityValue(scope));
    const output = document.createElement("output");
    output.dataset.unit = "%";
    setControlText(output, input.value);
    const restore = document.createElement("button");
    restore.type = "button";
    restore.dataset.restoreSurface = scope;
    restore.textContent = "恢复继承";
    restore.setAttribute("aria-label", `${label}：恢复继承`);
    restore.disabled = !override.checked;

    const sync = () => {
      const enabled = override.checked;
      input.disabled = !enabled;
      restore.disabled = !enabled;
      input.value = String(surfaceOpacityValue(scope));
      setControlText(output, input.value);
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
      setControlText(output, input.value);
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
      override.focus();
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

  function settingsGroup(title, ...controls) {
    const group = document.createElement("section");
    group.className = "settings-group";
    const heading = document.createElement("h3");
    heading.textContent = title;
    group.append(heading, ...controls);
    return group;
  }

  function renderPanel(renderCards = true) {
    if (!panel) return;
    const list = panel.querySelector(".wallpaper-list");
    const playlist = panel.querySelector(".playlist-summary");
    const playbackSettings = panel.querySelector("[data-playback-settings]");
    const appearanceSettings = panel.querySelector(".settings-grid");
    if (!list || !playlist || !playbackSettings || !appearanceSettings) return;
    if (renderCards) {
      previewObserver.disconnect();
      list.replaceChildren(...libraryEntries().map(card));
      applyLibraryFilters();
    }
    syncPlaylistSummary();
    const type = activeMediaType();
    const controlKind = ["image", "video", "web"].includes(type)
      ? "standard"
      : type === "scene"
        ? "scene"
        : "base";
    if (panel.dataset.controlKind !== controlKind) {
      panel.dataset.controlKind = controlKind;
      const performance = document.createElement("p");
      performance.className = "playback-capability";
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
      const audioCapability = document.createElement("p");
      audioCapability.className = "playback-capability";
      audioCapability.dataset.audioCapability = "";
      playbackSettings.replaceChildren(
        settingsGroup(
          "性能",
          playbackProfileControl(),
          ...(type === "scene"
            ? [range("Scene 上限", "fps", 1, 30, " FPS")]
            : []),
          settingToggle("不可见时暂停", "pauseWhenHidden"),
          performance,
          tradeoff,
          capability
        ),
        settingsGroup(
          "音频",
          settingToggle("静音", "muted"),
          range("音量", "volume", 0, 100, "%"),
          audioCapability
        ),
        settingsGroup(
          "轮播",
          range("轮播间隔", "rotationMinutes", 0, 120, " 分钟"),
          playlist
        )
      );
      const advanced = document.createElement("details");
      const advancedTitle = document.createElement("summary");
      advancedTitle.textContent = "分区读底覆盖";
      const advancedHelp = document.createElement("p");
      advancedHelp.className = "playback-capability";
      advancedHelp.textContent =
        "勾选分区后可单独调节读底强度。未勾选时沿用默认读底。";
      advanced.append(
        advancedTitle,
        advancedHelp,
        surfaceOverrideControl("聊天区覆盖", "chat"),
        surfaceOverrideControl("侧栏/顶部覆盖", "sidebar"),
        surfaceOverrideControl("右侧面板覆盖", "right"),
        surfaceOverrideControl("设置面板覆盖", "settings")
      );
      appearanceSettings.replaceChildren(
        settingsGroup(
          "壁纸画面",
          range("暗化", "dim", 0, 70, "%"),
          range("模糊", "blur", 0, 24, "px"),
          range("不透明度", "opacity", 20, 100, "%"),
          ...(controlKind !== "base"
            ? [
                settingSelect("画面适配", "fitMode", [
                  ["cover", "保持比例填充"],
                  ["contain", "完整显示"],
                ]),
              ]
            : [])
        ),
        settingsGroup(
          "界面效果",
          range("界面读底", "surfaceOpacity", 20, 100, "%"),
          range("界面雾化", "interfaceBlur", 0, 24, "px"),
          settingToggle("细边框", "interfaceBorders"),
          advanced
        )
      );
      renderPresetList();
    }
    syncSettingControls();
    syncMediaCapabilities();
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

  async function resetAll() {
    cancelRuntimeWork();
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
    removeMountedRuntime();
    imported = [];
    config = { ...structuredClone(defaults), enabled: false };
    saveConfig();
    installHotkey();
    return state();
  }

  function bindUsageMenuInteraction() {
    const events = new AbortController();
    const marker = "data-codex-wallpaper-usage-action";
    const usageLabels = new Set([
      "5-hour limit",
      "Weekly limit",
      "Credits",
      "5 小时用量上限",
      "每周限额",
      "额度",
    ]);
    let currentMenu;
    let usageRows = [];
    let manageUsage;

    function restoreRows() {
      for (const row of usageRows) {
        row.removeAttribute(marker);
        row.setAttribute("aria-disabled", "true");
      }
      usageRows = [];
    }

    function useMenu(menu) {
      const trigger = document.getElementById(
        menu.getAttribute("aria-labelledby")
      );
      if (
        !trigger?.matches('button[aria-haspopup="menu"]') ||
        trigger.getAttribute("aria-controls") !== menu.id ||
        !/^(用量|Usage)$/.test(trigger.getAttribute("aria-label"))
      )
        return false;

      const items = [
        ...menu.querySelectorAll(
          '[role="menuitem"][data-radix-collection-item]'
        ),
      ];
      const action = items.find(
        (item) =>
          !item.matches('[aria-disabled="true"], [data-disabled]') &&
          /^(管理用量|Manage usage)$/i.test(item.textContent.trim())
      );
      if (!action) return false;

      restoreRows();
      currentMenu = menu;
      manageUsage = action;
      usageRows = items.filter(
        (item) =>
          item.matches('[aria-disabled="true"]:not([data-disabled])') &&
          usageLabels.has(
            item
              .querySelector("[data-menu-row-content] > :first-child")
              ?.textContent.trim()
          )
      );
      for (const row of usageRows) {
        // Keep the host's row and its reset-time tooltip in place.
        row.removeAttribute("aria-disabled");
        row.setAttribute(marker, "");
      }
      return true;
    }

    function handleMenuEvent(event) {
      if (!(event.target instanceof Element)) return;
      const menu = event.target.closest(
        '[role="menu"][data-radix-menu-content][data-state="open"]'
      );
      if (!menu || (menu !== currentMenu && !useMenu(menu))) return;
      const activates =
        event.type === "click" ||
        (event.type === "keydown" &&
          !event.repeat &&
          (event.key === "Enter" || event.key === " "));
      if (
        !activates ||
        !usageRows.includes(event.target.closest(`[${marker}]`)) ||
        !manageUsage.isConnected ||
        !menu.contains(manageUsage)
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      manageUsage.click();
    }

    for (const type of ["focusin", "pointerover", "click", "keydown"]) {
      document.addEventListener(type, handleMenuEvent, {
        capture: true,
        signal: events.signal,
      });
    }
    return () => {
      events.abort();
      restoreRows();
    };
  }

  function removeAdapterNodes() {
    removeUsageMenuInteraction?.();
    removeUsageMenuInteraction = undefined;
    interfaceRules = [];
    document.documentElement.style.removeProperty("--codex-wallpaper-line");
    document.documentElement.style.removeProperty(
      "--codex-wallpaper-line-strong"
    );
    for (const node of document.querySelectorAll(
      `#${rootId}, #${controlsId}, #${styleId}`
    ))
      node.remove();
  }

  function cancelRuntimeWork() {
    cancelStartupMotion();
    revokePlayback();
    activeGeneration += 1;
    stopRotation();
    assetRequestTokens.clear();
    pendingPreviewRequests.clear();
    clearImportedPreviews();
    assetTransfers.clear();
    startupImport = null;
    startupAssetError = null;
    for (const token of assetFileTransfers.keys())
      cancelAssetFileTransfer(token);
    for (const asset of runtimeAssets.values()) {
      if (asset.assetUrl?.startsWith("blob:")) releaseObjectUrl(asset.assetUrl);
    }
    previewObserver.disconnect();
    database?.close();
    database = null;
    openingDatabase = null;
    importedLibraryLoaded = false;
  }

  function removeMountedRuntime() {
    restorePanelFocus();
    removeAdapterNodes();
    root = null;
    panel = null;
    layer = null;
    media = null;
    presentedMedia = null;
    committedSelection = null;
    dim = null;
    status = null;
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
      ? workshopEntry(item)
      : importedItem
        ? {
            ...importedEntry(importedItem),
            previewDataUrl: entry.previewDataUrl,
            thumbnailKind: entry.thumbnailKind,
          }
        : null;
    const visual = previewEntry
      ? cardFor(previewEntry)?.querySelector(".thumb")
      : null;
    if (visual) {
      previewObserver.unobserve(visual);
      renderThumb(previewEntry, visual);
    }
    if (isActiveWorkshop(entry.id) && item?.type === "web" && !item.webHtml)
      return applyActive();
    return state();
  }

  function receivePreviewError(id) {
    pendingPreviewRequests.delete(id);
    failedPreviewIds.add(id);
    return state();
  }

  function isActiveWorkshop(id) {
    return config.active.kind === "workshop" && config.active.id === String(id);
  }

  function hasAssetRequestToken(id, requestToken) {
    return (
      !requestToken ||
      assetRequestTokens.get(String(id)) === String(requestToken)
    );
  }

  function isCurrentAssetRequest(id, requestToken) {
    return (
      config.enabled &&
      isActiveWorkshop(id) &&
      hasAssetRequestToken(id, requestToken)
    );
  }

  function rememberWorkshopAsset(id, asset) {
    const key = String(id);
    assetRequestTokens.delete(key);
    failedEntryKeys.delete(`workshop:${key}`);
    if (loadingEntryKey === `workshop:${key}`) loadingEntryKey = null;
    runtimeAssets.set(`workshop:${key}`, { ...asset, kind: "workshop" });
  }

  function completeRuntimeAsset(id, metadata, url, requestToken = null) {
    if (!isCurrentAssetRequest(id, requestToken)) return null;
    rememberWorkshopAsset(id, {
      ...metadata,
      playable: true,
      assetDataUrl: null,
      assetUrl: url,
    });
    return applyActive();
  }

  function beginAssetTransfer(entry, requestToken = null) {
    if (!isCurrentAssetRequest(entry.id, requestToken)) return false;
    if (entry.fileFallbackReason)
      console.info(
        "Codex Wallpaper File fallback",
        entry.id,
        entry.fileFallbackReason
      );
    assetTransfers.set(entry.id, {
      entry,
      parts: [],
      received: 0,
      requestToken,
    });
    return state();
  }

  function appendAssetTransferChunk(id, encoded, requestToken = null) {
    const transfer = assetTransfers.get(id);
    if (!transfer) return false;
    if (
      requestToken &&
      transfer.requestToken &&
      String(requestToken) !== String(transfer.requestToken)
    )
      return false;
    const bytes = bytesFromBase64(encoded);
    transfer.parts.push(bytes);
    transfer.received += bytes.byteLength;
    return state();
  }

  async function finishAssetTransfer(id, requestToken = null) {
    const transfer = assetTransfers.get(id);
    if (!transfer) return false;
    if (
      (requestToken &&
        transfer.requestToken &&
        String(requestToken) !== String(transfer.requestToken)) ||
      (transfer.requestToken &&
        !isCurrentAssetRequest(id, transfer.requestToken))
    ) {
      assetTransfers.delete(id);
      return false;
    }
    assetTransfers.delete(id);
    const { mime, size, ...metadata } = transfer.entry;
    if (transfer.received !== size)
      throw new Error("Asset transfer size mismatch");
    const url = URL.createObjectURL(new Blob(transfer.parts, { type: mime }));
    const completed = completeRuntimeAsset(
      id,
      metadata,
      url,
      transfer.requestToken
    );
    if (completed) return completed;
    URL.revokeObjectURL(url);
    return state();
  }

  function beginAssetFileTransfer(entry, layout = null, requestToken = null) {
    if (
      (!root && !cancelMainInterfaceWait) ||
      !isCurrentAssetRequest(entry.id, requestToken)
    )
      return null;
    const token = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const input = document.createElement("input");
    input.type = "file";
    input.hidden = true;
    input.dataset.codexWallpaperFile = token;
    let resolveFile;
    const file = new Promise((resolve) => {
      resolveFile = resolve;
    });
    input.onchange = () => {
      resolveFile(input.files?.[0] ?? null);
    };
    (root || document.documentElement).append(input);
    assetFileTransfers.set(token, {
      file,
      resolve: resolveFile,
      input,
      entry,
      layout,
      requestToken,
    });
    return token;
  }

  async function finishAssetFileTransfer(token, requestToken = null) {
    const key = String(token);
    const transfer = assetFileTransfers.get(key);
    if (!transfer) return false;
    const file = await transfer.file;
    if (assetFileTransfers.get(key) !== transfer) return false;
    if (
      (requestToken &&
        transfer.requestToken &&
        String(requestToken) !== String(transfer.requestToken)) ||
      (transfer.requestToken &&
        !isCurrentAssetRequest(transfer.entry.id, transfer.requestToken))
    ) {
      assetFileTransfers.delete(key);
      transfer.input.remove();
      return false;
    }
    if (!file) {
      cancelAssetFileTransfer(key);
      return null;
    }
    const { mime, size, ...metadata } = transfer.entry;
    if (file.size !== size) throw new Error("File transfer size mismatch");
    let url;
    if (transfer.layout?.layout === "virtual") {
      const parts = transfer.layout.segments.map((segment) =>
        segment.type === "inline"
          ? new Uint8Array(bytesFromBase64(segment.data))
          : file.slice(segment.offset, segment.offset + segment.length)
      );
      url = URL.createObjectURL(new Blob(parts, { type: mime }));
    } else {
      url = URL.createObjectURL(new Blob([file], { type: mime }));
    }
    assetFileTransfers.delete(key);
    transfer.input.remove();
    const completed = completeRuntimeAsset(
      transfer.entry.id,
      metadata,
      url,
      transfer.requestToken
    );
    if (completed) return completed;
    URL.revokeObjectURL(url);
    return false;
  }

  function restorePanelFocus() {
    if (
      panel?.contains(document.activeElement) &&
      panelReturnFocus?.isConnected
    )
      panelReturnFocus.focus({ preventScroll: true });
    panelReturnFocus = null;
  }

  function closePanel() {
    flushConfigSave();
    restorePanelFocus();
    panel.classList.remove("open");
  }

  async function togglePanel() {
    if (panel.classList.contains("open")) {
      closePanel();
      return;
    }
    const opened = panel;
    panelReturnFocus = document.activeElement;
    opened.classList.add("open");
    opened.focus({ preventScroll: true });
    if (!opened.querySelector(".wallpaper-list .card")) {
      // Keep the local library off the first-frame path.
      if (waitForMainInterface) {
        try {
          await loadImported();
        } catch {
          if (panel === opened) setStatus("无法读取导入的壁纸");
        }
      }
      if (panel !== opened || !opened.classList.contains("open")) return;
      renderPanel();
    }
    requestAnimationFrame(requestVisiblePreviews);
  }

  function buildPanel() {
    panel = document.createElement("aside");
    panel.tabIndex = -1;
    panel.className = "panel";
    panel.dataset.codexWallpaperPanel = "";
    panel.setAttribute("aria-label", "Codex 壁纸设置");
    const header = document.createElement("header");
    const heading = document.createElement("h2");
    heading.textContent = "壁纸设置";
    const close = document.createElement("button");
    close.type = "button";
    close.className = "panel-close";
    close.innerHTML =
      '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="m4 4 8 8m0-8-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
    close.title = "关闭";
    close.setAttribute("aria-label", "关闭壁纸设置");
    close.setAttribute("aria-keyshortcuts", "Alt+Shift+S");
    close.onclick = closePanel;
    header.append(heading, close);

    const library = document.createElement("section");
    library.className = "panel-region";
    library.dataset.panelRegion = "library";
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
    const importRow = document.createElement("label");
    importRow.className = "import-row panel-file";
    importRow.textContent = "导入素材";
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*,video/*";
    fileInput.multiple = true;
    fileInput.onchange = () => importFiles(fileInput.files);
    importRow.append(fileInput);
    filters.append(searchLabel, typeLabel, favoritesLabel, importRow);

    const librarySummary = document.createElement("div");
    librarySummary.className = "library-summary";
    status = document.createElement("p");
    status.className = "runtime-status";
    status.setAttribute("aria-live", "polite");
    const result = document.createElement("p");
    result.className = "library-result";
    result.dataset.libraryResult = "";
    result.setAttribute("aria-live", "polite");
    librarySummary.append(status, result);
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
    libraryBody.append(filters, librarySummary, list);
    library.append(libraryBody);

    const playback = document.createElement("section");
    playback.className = "panel-region";
    playback.dataset.panelRegion = "playback";
    const playbackBody = document.createElement("div");
    playbackBody.className = "panel-region-body";
    const playlistSummary = document.createElement("p");
    playlistSummary.className = "playlist-summary";
    const playbackSettings = document.createElement("div");
    playbackSettings.className = "control-grid";
    playbackSettings.dataset.playbackSettings = "";
    playbackBody.append(playlistSummary, playbackSettings);
    playback.append(playbackBody);

    const appearance = document.createElement("section");
    appearance.className = "panel-region";
    appearance.dataset.panelRegion = "appearance";
    const appearanceBody = document.createElement("div");
    appearanceBody.className = "panel-region-body";
    const settingsGrid = document.createElement("div");
    settingsGrid.className = "settings-grid";
    appearanceBody.append(settingsGrid);
    appearance.append(appearanceBody);

    const recovery = document.createElement("section");
    recovery.className = "preset-section";
    recovery.dataset.presetSection = "";
    const recoveryTitle = document.createElement("h3");
    recoveryTitle.textContent = "预设";
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
    importLabel.className = "panel-file";
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
    libraryBody.append(removeImported);

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
    recovery.append(
      recoveryTitle,
      resetHelp,
      presetEditor,
      presetList,
      transfer,
      settingsStatus,
      settingsGroup("恢复设置", resetGroups, reset)
    );
    appearanceBody.append(recovery);

    const navigation = document.createElement("div");
    navigation.className = "panel-navigation";
    const tabs = document.createElement("div");
    tabs.className = "panel-tabs";
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", "壁纸设置页面");
    const pages = [
      [library, "壁纸库"],
      [playback, "播放与性能"],
      [appearance, "外观与预设"],
    ];
    const selectPage = (index) => {
      flushConfigSave();
      for (const [position, [page]] of pages.entries()) {
        const selected = position === index;
        page.hidden = !selected;
        tabs.children[position].setAttribute("aria-selected", String(selected));
        tabs.children[position].tabIndex = selected ? 0 : -1;
      }
      panel.scrollTop = 0;
      if (index === 0) requestAnimationFrame(requestVisiblePreviews);
    };
    for (const [index, [page, label]] of pages.entries()) {
      const key = page.dataset.panelRegion;
      const tab = document.createElement("button");
      tab.type = "button";
      tab.id = `codex-wallpaper-tab-${key}`;
      tab.dataset.panelPage = key;
      tab.textContent = label;
      tab.setAttribute("role", "tab");
      page.id = `codex-wallpaper-page-${key}`;
      page.setAttribute("role", "tabpanel");
      page.setAttribute("aria-labelledby", tab.id);
      tab.setAttribute("aria-controls", page.id);
      tab.onclick = () => selectPage(index);
      tab.onkeydown = (event) => {
        const next = {
          ArrowLeft: (index + pages.length - 1) % pages.length,
          ArrowRight: (index + 1) % pages.length,
          Home: 0,
          End: pages.length - 1,
        }[event.key];
        if (next === undefined) return;
        event.preventDefault();
        selectPage(next);
        tabs.children[next].focus();
      };
      tabs.append(tab);
    }
    navigation.append(header, tabs);
    panel.append(navigation, ...pages.map(([page]) => page));
    selectPage(0);
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
    controls.append(buildPanel());
    document.documentElement.append(style, root, controls);
    root.append(layer);
    bindInterfaceAppearance(style.sheet.cssRules);
    applyInterfaceAppearance();
    applyInterfaceBorders();
    removeUsageMenuInteraction = bindUsageMenuInteraction();
  }

  function watchMainInterface() {
    const contentSelector =
      "[data-app-shell-active-page='true'] [data-app-shell-main-surface] [data-composer-surface-variant], " +
      "[data-app-shell-frame] [data-settings-nav-scroll-container]";
    const events = new AbortController();
    let frame = null;
    let previousContent = null;

    function check() {
      frame = null;
      const content =
        document.visibilityState === "visible" &&
        Array.from(document.querySelectorAll(contentSelector)).find((node) => {
          if (
            node.closest("[inert]") ||
            getComputedStyle(node).pointerEvents === "none" ||
            !node.checkVisibility({
              opacityProperty: true,
              visibilityProperty: true,
              contentVisibilityAuto: true,
            })
          )
            return false;
          const rect = node.getBoundingClientRect();
          return (
            rect.width > 0 &&
            rect.height > 0 &&
            rect.right > 0 &&
            rect.bottom > 0 &&
            rect.left < innerWidth &&
            rect.top < innerHeight
          );
        });
      if (!content) {
        previousContent = null;
        return;
      }
      // Leave a rendering opportunity for the unmodified interface before mounting.
      if (content !== previousContent) {
        previousContent = content;
        queueCheck();
        return;
      }
      cancelMainInterfaceWait();
      mainInterfaceShown = true;
      startupInterfaceAt = Date.now();
      const restoration = restoreActive();
      const mounted = root;
      restoration.catch((error) => {
        if (root === mounted) disable(false);
        console.error("Codex wallpaper restoration failed", error);
      });
    }

    function queueCheck() {
      if (frame === null) frame = requestAnimationFrame(check);
    }

    const observer = new MutationObserver(queueCheck);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        "class",
        "style",
        "hidden",
        "inert",
        "data-app-shell-active-page",
        "data-app-shell-main-surface",
        "data-composer-surface-variant",
        "data-app-shell-frame",
        "data-settings-nav-scroll-container",
      ],
    });
    for (const type of ["visibilitychange", "transitionend", "animationend"]) {
      document.addEventListener(type, queueCheck, { signal: events.signal });
    }
    addEventListener("resize", queueCheck, { signal: events.signal });
    cancelMainInterfaceWait = () => {
      observer.disconnect();
      events.abort();
      if (frame !== null) cancelAnimationFrame(frame);
      cancelMainInterfaceWait = null;
    };
    queueCheck();
  }

  async function restoreActive() {
    if (!mainInterfaceShown) {
      if (!cancelMainInterfaceWait) watchMainInterface();
      const active = config.active;
      discardInactiveAssetRequests(active);
      if (startupImport?.id !== active.id) startupImport = null;
      if (startupAssetError?.id !== active.id) startupAssetError = null;
      for (const asset of runtimeAssets.values()) {
        if (asset.assetUrl?.startsWith("blob:") && !isActiveWorkshop(asset.id))
          releaseObjectUrl(asset.assetUrl);
      }
      if (active.kind === "imported" && !startupImport) {
        startupImport = {
          id: active.id,
          result: readImported(active.id).catch(() => null),
        };
      } else if (active.kind === "workshop" && hostReady) {
        const entry = findEntry(active);
        if (
          entry &&
          entry.type !== "web" &&
          !entry.assetUrl &&
          !entry.assetDataUrl &&
          !entry.webHtml &&
          !startupAssetError
        )
          requestWorkshopAsset(entry);
      }
      return state();
    }
    mount();
    if (!waitForMainInterface) await loadImported();
    await applyActive();
    return state();
  }

  function startupPresentation() {
    if (!config.enabled) return "disabled";
    return mainInterfaceShown &&
      presentedMedia &&
      media === presentedMedia &&
      committedSelection === JSON.stringify(config.active) &&
      document.visibilityState === "visible"
      ? "visible"
      : "waiting";
  }

  function startupPresentationTiming(status) {
    return { status, interfaceAt: startupInterfaceAt, frameAt: startupFrameAt };
  }

  function settleStartupPresentation() {
    const status = startupPresentation();
    if (status === "waiting" || !resolveStartupPresentation) return;
    resolveStartupPresentation(startupPresentationTiming(status));
    resolveStartupPresentation = null;
  }

  async function enable(persist = true) {
    config.enabled = true;
    if (persist) saveConfig();
    return restoreActive();
  }

  async function disable(persist = true) {
    config.enabled = false;
    if (persist) saveConfig();
    cancelMainInterfaceWait?.();
    cancelRuntimeWork();
    removeMountedRuntime();
    installHotkey();
    settleStartupPresentation();
    return state();
  }

  async function discardStartup() {
    runtimeEvents.abort();
    clearTimeout(configSaveTimer);
    channel.close();
    await disable(false);
    delete globalThis.__codexWallpaperHotkey;
    delete globalThis.__codexWallpaperApi;
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
      libraryRevalidationFailed: Boolean(
        sourcePayload.libraryRevalidationFailed
      ),
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
      cancelStartupMotion();
      flushConfigSave();
      if (!config.settings.pauseWhenHidden) return;
      applyHiddenPolicy();
      return;
    }
    if (config.settings.pauseWhenHidden) scheduleRotation();
    playback?.video?.play().catch(() => {});
    playback?.resume?.();
    pendingRender?.resume?.();
    settleStartupPresentation();
    publishStartupPreview();
  }

  function installHotkey() {
    if (globalThis.__codexWallpaperHotkey) return;
    globalThis.__codexWallpaperHotkey = (event) => {
      if (
        !event.altKey ||
        !event.shiftKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.isComposing ||
        event.defaultPrevented
      )
        return;
      const settings = event.code === "KeyS" && panel?.isConnected;
      if (!settings && event.code !== "KeyW") return;
      event.preventDefault();
      event.stopPropagation();
      if (event.repeat) return;
      if (settings) void togglePanel();
      else if (config.enabled) void disable();
      else void enable();
    };
    addEventListener("keydown", globalThis.__codexWallpaperHotkey, {
      capture: true,
      signal: runtimeEvents.signal,
    });
  }

  async function refresh(nextPayload) {
    sourcePayload = nextPayload || sourcePayload;
    config = readConfig();
    publishStartupPreview();
    if (!config.enabled)
      return root || cancelMainInterfaceWait ? disable(false) : state();
    return restoreActive();
  }

  if (globalThis.__codexWallpaperApi)
    return globalThis.__codexWallpaperApi.refresh(payload);

  installHotkey();
  addEventListener(
    "storage",
    (event) => {
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
    },
    { signal: runtimeEvents.signal }
  );
  channel.addEventListener(
    "message",
    (event) => {
      if (event.data?.type === "prepare-reset") {
        disable();
      }
    },
    { signal: runtimeEvents.signal }
  );
  addEventListener(
    "pagehide",
    () => {
      clearTimeout(previewResizeTimer);
      flushConfigSave();
      cancelStartupMotion();
      revokePlayback();
      stopRotation();
    },
    { signal: runtimeEvents.signal }
  );
  document.addEventListener("visibilitychange", syncVisibility, {
    signal: runtimeEvents.signal,
  });
  if (desktopStartup) {
    addEventListener(
      "resize",
      () => {
        if (!config.enabled || !playback?.scene) return;
        clearTimeout(previewResizeTimer);
        previewResizeTimer = setTimeout(() => publishStartupPreview(), 350);
      },
      { signal: runtimeEvents.signal }
    );
  }
  globalThis.__codexWallpaperApi = {
    identity: () => structuredClone(identity),
    refresh,
    enable,
    disable,
    discardStartup,
    state,
    startupMotionDecision,
    startupPresentation,
    async waitForStartupPresentation() {
      const status = startupPresentation();
      if (status !== "waiting") return startupPresentationTiming(status);
      const { promise, resolve } = Promise.withResolvers();
      resolveStartupPresentation = resolve;
      const timer = setTimeout(
        () => resolve(startupPresentationTiming("timeout")),
        25_000
      );
      try {
        return await promise;
      } finally {
        clearTimeout(timer);
        if (resolveStartupPresentation === resolve)
          resolveStartupPresentation = null;
      }
    },
    configureHost,
    receivePreview,
    receivePreviewError,
    beginAssetTransfer,
    beginAssetFileTransfer,
    appendAssetTransferChunk,
    finishAssetTransfer,
    finishAssetFileTransfer,
    cancelAssetFileTransfer,
    receiveAsset(entry, requestToken = null) {
      if (!hasAssetRequestToken(entry.id, requestToken)) return state();
      rememberWorkshopAsset(entry.id, entry);
      if (isActiveWorkshop(entry.id)) return applyActive();
      syncCardState({ kind: "workshop", id: entry.id });
      syncPlaylistSummary();
      return state();
    },
    receiveAssetError(id, message, requestToken = null) {
      if (!hasAssetRequestToken(id, requestToken)) return state();
      assetRequestTokens.delete(id);
      assetTransfers.delete(id);
      failedEntryKeys.add(`workshop:${id}`);
      if (isActiveWorkshop(id)) {
        if (!root) {
          startupAssetError = { id, message };
          return state();
        }
        const entry = findEntry({ kind: "workshop", id: String(id) });
        recoverFailedMedia(`素材加载失败：${message}`, entry?.previewDataUrl);
      } else {
        syncCardState({ kind: "workshop", id });
      }
      return state();
    },
  };

  publishStartupPreview();
  if (!config.enabled) return state();
  return enable(!initialHostReady);
}
