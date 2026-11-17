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
        position: fixed; z-index: 2147483647; width: min(390px, calc(100vw - 28px)); overflow: auto; padding: 14px; border: 1px solid var(--codex-wallpaper-line-strong); border-radius: var(--codex-wallpaper-radius); background: var(--codex-wallpaper-panel); box-shadow: var(--codex-wallpaper-shadow); pointer-events: auto; display: none;
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
      #${controlsId} .panel h3 { margin: 16px 0 8px; color: color-mix(in srgb, var(--app-color-text-foreground, white) 72%, transparent); font-size: 12px; letter-spacing: .08em; text-transform: uppercase; }
      #${controlsId} .import-row { display: flex; align-items: center; justify-content: space-between; margin-top: 12px; padding: 9px 10px; border: 1px dashed var(--codex-wallpaper-line-strong); border-radius: var(--codex-wallpaper-radius-sm); cursor: pointer; }
      #${controlsId} .import-row input { width: 135px; font-size: 11px; }
      #${controlsId} .runtime-status, #${controlsId} .playlist-summary { margin: 9px 0; color: color-mix(in srgb, var(--app-color-text-foreground, white) 82%, transparent); }
      #${controlsId} .wallpaper-list { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      #${controlsId} .card { min-width: 0; padding: 7px; border: 1px solid var(--codex-wallpaper-line); border-radius: 10px; background: color-mix(in srgb, var(--app-color-background-surface-under, rgb(12 12 16)) 44%, transparent); }
      #${controlsId} .card[data-selected='true'] { border-color: var(--codex-wallpaper-line-strong); background: color-mix(in srgb, var(--app-color-accent-blue, rgb(51 156 255)) 12%, var(--codex-wallpaper-raised)); }
      #${controlsId} .thumb { aspect-ratio: 16 / 9; display: grid; place-items: center; overflow: hidden; border-radius: 6px; background: color-mix(in srgb, var(--app-color-text-foreground, white) 8%, transparent); font-size: 10px; }
      #${controlsId} .thumb img { width: 100%; height: 100%; object-fit: cover; }
      #${controlsId} .card strong { display: block; margin-top: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      #${controlsId} .card small { display: block; margin-top: 2px; color: color-mix(in srgb, var(--app-color-text-foreground, white) 72%, transparent); }
      #${controlsId} .card-actions { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
      #${controlsId} .card-actions button { padding: 4px 6px; font-size: 10px; }
      #${controlsId} .settings-grid { display: grid; gap: 7px; }
      #${controlsId} .range { display: grid; grid-template-columns: 64px 48px 1fr; align-items: center; gap: 7px; }
      #${controlsId} .range output { color: color-mix(in srgb, var(--app-color-text-foreground, white) 78%, transparent); font-variant-numeric: tabular-nums; }
      #${controlsId} .reset { margin-top: 14px; width: 100%; color: var(--color-text-danger, rgb(224 46 42)) !important; }
      :root {
        --codex-wallpaper-frame: color-mix(in srgb, var(--app-color-background-surface, rgb(24 24 28)) 72%, transparent);
        --codex-wallpaper-canvas: color-mix(in srgb, var(--app-color-background-surface, rgb(24 24 28)) 18%, transparent);
        --codex-wallpaper-raised: color-mix(in srgb, var(--app-color-background-surface-under, rgb(12 12 16)) 90%, transparent);
        --codex-wallpaper-panel: color-mix(in srgb, var(--app-color-background-surface-under, rgb(12 12 16)) 94%, transparent);
        --codex-wallpaper-settings-canvas: color-mix(in srgb, var(--app-color-background-surface-under, rgb(12 12 16)) 64%, transparent);
        --codex-wallpaper-settings-card: color-mix(in srgb, var(--app-color-background-surface, rgb(24 24 28)) 42%, transparent);
        --codex-wallpaper-settings-control: color-mix(in srgb, var(--app-color-text-foreground, rgb(245 245 250)) 6%, transparent);
        --codex-wallpaper-line: color-mix(in srgb, var(--app-color-text-foreground, rgb(245 245 250)) 10%, transparent);
        --codex-wallpaper-line-strong: color-mix(in srgb, var(--app-color-text-foreground, rgb(245 245 250)) 16%, transparent);
        --codex-wallpaper-radius: 14px;
        --codex-wallpaper-radius-sm: 9px;
        --codex-wallpaper-shadow: 0 12px 34px rgb(0 0 0 / .22);
      }
      html[data-theme='light'] {
        --codex-wallpaper-frame: color-mix(in srgb, var(--app-color-background-surface, rgb(255 255 255)) 80%, transparent);
        --codex-wallpaper-canvas: color-mix(in srgb, var(--app-color-background-surface, rgb(255 255 255)) 12%, transparent);
        --codex-wallpaper-settings-canvas: color-mix(in srgb, var(--app-color-background-surface-under, rgb(232 232 237)) 72%, transparent);
        --codex-wallpaper-settings-card: color-mix(in srgb, var(--app-color-background-surface, rgb(247 247 249)) 62%, transparent);
      }
      body :where([data-app-shell-main-surface], [data-app-shell-page-sidebar], [data-app-shell-titlebar], [data-app-shell-pane-content-viewport]) { background-color: var(--codex-wallpaper-frame) !important;
        &:not([data-app-shell-titlebar]) { position: relative; z-index: 1; }
      }
      body [data-app-shell-main-surface] { background-color: var(--codex-wallpaper-canvas) !important; border-radius: 0 var(--codex-wallpaper-radius) 0 0 !important; --color-text-tertiary: var(--color-text-secondary); }
      body [data-app-shell-pane-content-viewport] { background-color: var(--codex-wallpaper-canvas) !important; box-shadow: inset 1px 0 0 var(--codex-wallpaper-line); }
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
      body [data-app-shell-trailing-sidebar] { background-color: transparent !important; box-shadow: inset 1px 0 0 var(--codex-wallpaper-line); }
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

export function runtimeSource(payload) {
  const runtimeCss = createRuntimeStyles(
    "codex-wallpaper-p1",
    "codex-wallpaper-p1-controls"
  );
  return `(${createCodexWallpaperRuntime.toString()})(${JSON.stringify(
    payload
  )}, ${JSON.stringify(runtimeCss)})`;
}

export function createCodexWallpaperRuntime(payload, runtimeCss) {
  const rootId = "codex-wallpaper-p1";
  const controlsId = "codex-wallpaper-p1-controls";
  const styleId = "codex-wallpaper-p1-style";
  const configKey = "codex-wallpaper-p1-config";
  const dbName = "codex-wallpaper-media";
  const dbStore = "media";

  const defaults = {
    enabled: true,
    active: { kind: "builtin", id: "aurora" },
    favorites: [],
    playlist: [],
    settings: {
      dim: 18,
      blur: 0,
      opacity: 100,
      fps: 30,
      volume: 0,
      rotationMinutes: 0,
    },
  };

  function readConfig() {
    try {
      const value = JSON.parse(localStorage.getItem(configKey) || "null");
      return {
        ...defaults,
        ...(value && typeof value === "object" ? value : {}),
        active:
          value?.active && typeof value.active === "object"
            ? value.active
            : defaults.active,
        favorites: Array.isArray(value?.favorites) ? value.favorites : [],
        playlist: Array.isArray(value?.playlist) ? value.playlist : [],
        settings: { ...defaults.settings, ...(value?.settings || {}) },
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
  let imported = [];
  let database = null;
  const runtimeAssets = new Map();
  const pendingAssetRequests = new Set();
  const pendingPreviewRequests = new Set();
  const failedPreviewIds = new Set();
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

  function saveConfig() {
    if (configSaveTimer) clearTimeout(configSaveTimer);
    configSaveTimer = null;
    localStorage.setItem(configKey, JSON.stringify(config));
  }

  function scheduleConfigSave() {
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
      appearance: ["dim", "blur", "opacity"].some(
        (key) => previous.settings[key] !== next.settings[key]
      ),
      volume: previous.settings.volume !== next.settings.volume,
      fps: previous.settings.fps !== next.settings.fps,
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
        previewDataUrl: null,
        assetDataUrl: null,
        reason: null,
      })),
      ...(sourcePayload.library || []).map((item) => ({
        ...item,
        kind: "workshop",
      })),
    ];
  }

  function requestPreview(id) {
    const entry = sourcePayload.library?.find(
      (candidate) => candidate.id === id
    );
    if (
      !id ||
      entry?.previewDataUrl ||
      pendingPreviewRequests.has(id) ||
      failedPreviewIds.has(id) ||
      typeof globalThis.__codexWallpaperHostRequest !== "function"
    )
      return;
    pendingPreviewRequests.add(id);
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

  function applyVisualSettings() {
    if (!layer || !media || !dim) return;
    layer.style.opacity = String(config.settings.opacity / 100);
    media.style.filter = config.settings.blur
      ? `blur(${config.settings.blur}px)`
      : "";
    dim.style.background = `rgb(4 6 15 / ${config.settings.dim / 100})`;
  }

  function applyPlaybackSettings(change) {
    const volume = Number(config.settings.volume) / 100;
    if (change.volume && playback?.video) {
      playback.video.muted = volume === 0;
      playback.video.volume = volume;
    }
    if (change.volume) playback?.setVolume?.(volume);
    if (change.fps) playback?.setFps?.(Number(config.settings.fps));
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
    if (use) use.setAttribute("aria-pressed", String(selected));
    if (favoriteButton) {
      favoriteButton.textContent = favorite ? "★" : "☆";
      favoriteButton.setAttribute("aria-pressed", String(favorite));
    }
    if (queueButton) {
      queueButton.textContent = queued ? "移除轮播" : "加入轮播";
      queueButton.setAttribute("aria-pressed", String(queued));
    }
  }

  function syncCardStates() {
    if (!panel) return;
    for (const item of panel.querySelectorAll(".card")) updateCardState(item);
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
    if (change.favorites || change.playlist) syncCardStates();
    if (change.playlist) syncPlaylistSummary();
    syncSettingControls();
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
    video.muted = Number(config.settings.volume) === 0;
    video.volume = Math.max(
      0,
      Math.min(1, Number(config.settings.volume) || 0)
    );
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
      if (document.visibilityState === "hidden") video.pause();
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
      if (document.visibilityState === "hidden") drawFirstFrame();
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
        if (document.visibilityState === "hidden") {
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
      volume: Math.max(0, Math.min(1, Number(config.settings.volume) || 0)),
      fit: "cover",
    });
    let cancelled = false;
    let settled = false;
    const current = {
      cancelled: false,
      scene: instance,
      pause: () => instance.pause(),
      resume: () => instance.resume(),
      setFps: (fps) => instance.setFps?.(fps),
      setVolume: (volume) => instance.setVolume?.(volume),
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
        if (document.visibilityState === "hidden") instance.pause();
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
    if (listName === "playlist") {
      syncPlaylistSummary();
      scheduleRotation();
    }
  }

  function entryState(entry) {
    if (
      hostReady &&
      entry.kind === "workshop" &&
      entry.type !== "web" &&
      !entry.playable &&
      !entry.webHtml
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
      const image = document.createElement("img");
      image.src = visualUrl;
      image.alt = "";
      image.onerror = () => {
        failedPreviewIds.add(entry.id);
        image.remove();
        visual.textContent = entry.type.toUpperCase();
        visual.dataset.previewId = entry.id;
        previewObserver.observe(visual);
      };
      visual.append(image);
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
    const selected =
      config.active.kind === entry.kind && config.active.id === entry.id;
    item.dataset.selected = String(selected);
    const visual = document.createElement("div");
    visual.className = "thumb";
    renderThumb(entry, visual);
    const title = document.createElement("strong");
    title.textContent = entry.title;
    const meta = document.createElement("small");
    const state = entryState(entry);
    meta.textContent =
      state === "scene-native"
        ? "scene · 原生渲染"
        : state.endsWith("-on-demand")
          ? `${entry.type} · 按需加载`
          : state === "web-offline"
            ? "web · 离线沙箱"
            : entry.type === "scene" || entry.type === "web"
              ? `${entry.type} · 预览降级`
              : entry.playable
                ? entry.type
                : `${entry.type} · 不可播放`;
    const actions = document.createElement("div");
    actions.className = "card-actions";
    const use = document.createElement("button");
    use.textContent = "使用";
    use.dataset.entryAction = "use";
    use.setAttribute("aria-pressed", String(selected));
    use.onclick = () => {
      config.active = { kind: entry.kind, id: entry.id };
      saveConfig();
      requestPreview(entry.id);
      applyActive();
      renderPanel();
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
    item.append(visual, title, meta, actions);
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
      renderLabel();
      applyVisualSettings();
      applyPlaybackSettings({
        volume: key === "volume",
        fps: key === "fps",
      });
      if (key === "rotationMinutes") scheduleRotation();
      scheduleConfigSave();
    };
    input.onchange = flushConfigSave;
    input.onblur = flushConfigSave;
    heading.textContent = label;
    row.append(heading, value, input);
    renderLabel();
    return row;
  }

  function renderPanel() {
    if (!panel) return;
    const list = panel.querySelector(".wallpaper-list");
    const playlist = panel.querySelector(".playlist-summary");
    const settings = panel.querySelector(".settings-grid");
    if (!list || !playlist || !settings) return;
    previewObserver.disconnect();
    list.replaceChildren(...libraryEntries().map(card));
    const queued = playlistEntries();
    playlist.textContent = queued.length
      ? `轮播：${queued.map((entry) => entry.title).join(" · ")}`
      : "轮播列表为空";
    settings.replaceChildren(
      range("暗化", "dim", 0, 70, 1, "%"),
      range("模糊", "blur", 0, 24, 1, "px"),
      range("不透明度", "opacity", 20, 100, 1, "%"),
      range("帧率", "fps", 15, 30, 15, " FPS"),
      range("音量", "volume", 0, 100, 5, "%"),
      range("轮播", "rotationMinutes", 0, 120, 5, " 分钟")
    );
    const active = findEntry(config.active);
    setStatus(
      config.active.kind === "builtin"
        ? "内置渐变"
        : active
          ? `${active.title} · ${entryState(active)}`
          : "已跳过缺失的壁纸"
    );
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
    const previewCard = panel
      ? [...panel.querySelectorAll(".card")].find(
          (candidate) =>
            candidate.dataset.entryKind === "workshop" &&
            candidate.dataset.entryId === entry.id
        )
      : null;
    const visual = previewCard?.querySelector(".thumb");
    if (visual) {
      previewObserver.unobserve(visual);
      renderThumb({ ...item, kind: "workshop" }, visual);
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
    const library = document.createElement("section");
    const libraryTitle = document.createElement("h3");
    libraryTitle.textContent = "壁纸库";
    const list = document.createElement("div");
    list.className = "wallpaper-list";
    library.append(libraryTitle, list);

    const playlist = document.createElement("section");
    const playlistTitle = document.createElement("h3");
    playlistTitle.textContent = "播放与轮播";
    const playlistSummary = document.createElement("p");
    playlistSummary.className = "playlist-summary";
    playlist.append(playlistTitle, playlistSummary);

    const settings = document.createElement("section");
    const settingsTitle = document.createElement("h3");
    settingsTitle.textContent = "外观";
    const settingsGrid = document.createElement("div");
    settingsGrid.className = "settings-grid";
    settings.append(settingsTitle, settingsGrid);

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
    panel.append(header, importRow, status, library, playlist, settings, reset);
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
    if (configSaveTimer) {
      flushConfigSave();
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
      renderPanel();
      if (config.active.kind === "workshop" && config.active.id === id)
        setStatus(`素材加载失败：${message}`);
      return state();
    },
  };

  if (!config.enabled) return state();
  return enable();
}
