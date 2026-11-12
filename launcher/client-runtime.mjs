export function runtimeSource(payload) {
  return `(${createCodexWallpaperRuntime.toString()})(${JSON.stringify(payload)})`;
}

export function createCodexWallpaperRuntime(payload) {
  const rootId = "codex-wallpaper-p1";
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
      opacity: 72,
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
  let root = null;
  let panel = null;
  let layer = null;
  let media = null;
  let dim = null;
  let status = null;
  let playback = null;
  let currentObjectUrl = null;
  let rotationTimer = null;
  let imported = [];
  let database = null;
  const runtimeAssets = new Map();
  const pendingAssetRequests = new Set();
  const channel = new BroadcastChannel("codex-wallpaper-p1");
  let measuredFps = 0;
  let frameCount = 0;
  let frameWindowStartedAt = performance.now();

  function saveConfig() {
    localStorage.setItem(configKey, JSON.stringify(config));
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

  function revokePlayback() {
    measuredFps = 0;
    frameCount = 0;
    frameWindowStartedAt = performance.now();
    if (playback) {
      playback.cancelled = true;
      if (playback.raf) cancelAnimationFrame(playback.raf);
      playback.video?.pause();
      playback.video?.remove();
      playback.scene?.destroy();
      playback = null;
    }
    if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
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

  function showGradient(message) {
    revokePlayback();
    media.replaceChildren();
    media.className = "media builtin";
    if (message) setStatus(message);
    applyVisualSettings();
  }

  function showImage(url, message) {
    revokePlayback();
    const image = document.createElement("img");
    image.alt = "";
    image.src = url;
    image.onerror = () => showGradient("素材加载失败，已保留静态渐变");
    media.replaceChildren(image);
    media.className = "media";
    if (message) setStatus(message);
    applyVisualSettings();
  }

  function showVideo(url, message) {
    revokePlayback();
    const video = document.createElement("video");
    video.src = url;
    video.loop = true;
    video.muted = Number(config.settings.volume) === 0;
    video.volume = Math.max(
      0,
      Math.min(1, Number(config.settings.volume) || 0)
    );
    video.playsInline = true;
    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 720;
    media.replaceChildren(canvas, video);
    video.className = "playback-source";
    media.className = "media";
    const context = canvas.getContext("2d", { alpha: false });
    const current = {
      cancelled: false,
      video,
      raf: 0,
      lastFrame: 0,
      draw(timestamp) {
        if (current.cancelled || document.visibilityState === "hidden") return;
        const interval = 1000 / Math.max(1, Number(config.settings.fps) || 30);
        if (timestamp - current.lastFrame >= interval) {
          current.lastFrame = timestamp;
          if (video.readyState >= 2) {
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            frameCount += 1;
            if (timestamp - frameWindowStartedAt >= 1000) {
              measuredFps = Math.round(
                (frameCount * 1000) / (timestamp - frameWindowStartedAt)
              );
              frameCount = 0;
              frameWindowStartedAt = timestamp;
            }
          }
        }
        current.raf = requestAnimationFrame(current.draw);
      },
      start() {
        if (!video.paused) current.raf = requestAnimationFrame(current.draw);
      },
    };
    playback = current;
    video.onloadedmetadata = () => {
      const scale = Math.min(
        1,
        1920 / video.videoWidth,
        1080 / video.videoHeight
      );
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      current.start();
    };
    video.onerror = () => {
      if (config.settings.volume) setStatus("视频加载失败，已降级");
      showGradient("视频加载失败，已保留静态渐变");
    };
    video
      .play()
      .then(() => {
        if (document.visibilityState === "hidden") video.pause();
      })
      .catch(() => {
        showGradient("视频无法播放，已保留静态渐变");
      });
    if (message) setStatus(message);
    applyVisualSettings();
  }

  function bytesFromDataUrl(url) {
    const encoded = String(url).split(",", 2)[1] || "";
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1)
      bytes[index] = binary.charCodeAt(index);
    return bytes;
  }

  function showScene(entry) {
    revokePlayback();
    const engine = globalThis.WebWallGL;
    if (!engine?.createScene || !engine?.bytesSource) {
      if (entry.previewDataUrl)
        showImage(
          entry.previewDataUrl,
          `${entry.title} · Scene 渲染器不可用，预览降级`
        );
      else showGradient(`${entry.title} · Scene 渲染器不可用`);
      return;
    }
    const host = document.createElement("div");
    media.replaceChildren(host);
    media.className = "media";
    const instance = engine.createScene(host, {
      fps: Math.max(1, Math.min(30, Number(config.settings.fps) || 30)),
      volume: Math.max(0, Math.min(1, Number(config.settings.volume) || 0)),
      fit: "cover",
    });
    playback = {
      cancelled: false,
      scene: instance,
      pause: () => instance.pause(),
      resume: () => instance.resume(),
      setFps: (fps) => instance.setFps?.(fps),
      setVolume: (volume) => instance.setVolume?.(volume),
    };
    instance
      .load(
        engine.bytesSource(
          bytesFromDataUrl(entry.assetDataUrl),
          { type: "scene", file: "scene.pkg" },
          entry.id
        )
      )
      .then(() => {
        if (document.visibilityState === "hidden") instance.pause();
        setStatus(`${entry.title} · Scene`);
      })
      .catch(() => {
        if (entry.previewDataUrl)
          showImage(
            entry.previewDataUrl,
            `${entry.title} · Scene 失败，预览降级`
          );
        else showGradient(`${entry.title} · Scene 不支持`);
      });
    applyVisualSettings();
  }

  function showWeb(entry) {
    revokePlayback();
    const frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "allow-scripts");
    frame.setAttribute("referrerpolicy", "no-referrer");
    frame.srcdoc = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; script-src 'none'">${entry.webHtml}`;
    media.replaceChildren(frame);
    media.className = "media";
    setStatus(`${entry.title} · Web 离线沙箱`);
    applyVisualSettings();
  }

  async function applyActive() {
    if (!root) return;
    stopRotation();
    const active = config.active || defaults.active;
    if (active.kind === "builtin") {
      showGradient("内置渐变");
    } else {
      const entry = findEntry(active);
      if (!entry) {
        showGradient("已跳过缺失的壁纸");
      } else if (entry.kind === "imported") {
        const db = await openDatabase();
        const item = await requestResult(
          db.transaction(dbStore, "readonly").objectStore(dbStore).get(entry.id)
        );
        if (!item?.blob) {
          showGradient("已跳过缺失的素材");
        } else {
          const url = URL.createObjectURL(item.blob);
          const kind = mediaType(item.blob);
          if (kind === "video") {
            showVideo(url, `${entry.title} · 视频`);
            currentObjectUrl = url;
          } else {
            showImage(url, `${entry.title} · 图片`);
            currentObjectUrl = url;
          }
        }
      } else {
        if (!entry.assetDataUrl && !entry.webHtml) {
          if (!pendingAssetRequests.has(entry.id)) {
            pendingAssetRequests.add(entry.id);
            if (typeof globalThis.__codexWallpaperHostRequest === "function") {
              setStatus(`${entry.title} · 正在载入`);
              globalThis.__codexWallpaperHostRequest(
                JSON.stringify({ type: "load-asset", id: entry.id })
              );
            }
          }
          if (entry.previewDataUrl)
            showImage(entry.previewDataUrl, `${entry.title} · 预览降级`);
          else showGradient(`${entry.title} · 重启专用入口后载入`);
          scheduleRotation();
          renderPanel();
          return;
        }
        const url = entry.assetDataUrl || entry.previewDataUrl;
        if (!url && !entry.webHtml) {
          showGradient(`${entry.title} · 无可用画面`);
        } else if (entry.type === "scene" && entry.assetDataUrl) {
          showScene(entry);
        } else if (entry.type === "web" && entry.webHtml) {
          showWeb(entry);
        } else if (entry.assetDataUrl && entry.type === "video") {
          showVideo(url, `${entry.title} · 视频`);
        } else {
          showImage(
            url,
            entry.assetDataUrl
              ? `${entry.title} · ${entry.type}`
              : `${entry.title} · 预览降级`
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
    renderPanel();
    scheduleRotation();
  }

  function card(entry) {
    const item = document.createElement("article");
    item.className = "card";
    const visual = document.createElement("div");
    visual.className = "thumb";
    if (entry.previewDataUrl || entry.assetDataUrl) {
      const image = document.createElement("img");
      image.src = entry.previewDataUrl || entry.assetDataUrl;
      image.alt = "";
      visual.append(image);
    } else {
      visual.textContent = entry.type.toUpperCase();
    }
    const title = document.createElement("strong");
    title.textContent = entry.title;
    const meta = document.createElement("small");
    meta.textContent =
      entry.reason === "scene-native"
        ? "scene · 原生渲染"
        : entry.reason === "web-offline"
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
    use.onclick = () => {
      config.active = { kind: entry.kind, id: entry.id };
      saveConfig();
      applyActive();
    };
    const favorite = document.createElement("button");
    favorite.textContent = isFavorite(entry) ? "★" : "☆";
    favorite.title = "收藏";
    favorite.onclick = () => toggleKey("favorites", entry);
    const queue = document.createElement("button");
    queue.textContent = inPlaylist(entry) ? "移除轮播" : "加入轮播";
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
    const input = document.createElement("input");
    input.type = "range";
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(config.settings[key]);
    const renderLabel = () => {
      value.textContent = `${input.value}${unit}`;
    };
    input.oninput = () => {
      config.settings[key] = Number(input.value);
      renderLabel();
      saveConfig();
      applyVisualSettings();
      if (key === "volume" && playback?.video) {
        playback.video.muted = Number(input.value) === 0;
        playback.video.volume = Number(input.value) / 100;
      }
      if (key === "volume") playback?.setVolume?.(Number(input.value) / 100);
      if (key === "fps") playback?.setFps?.(Number(input.value));
      if (key === "fps" || key === "rotationMinutes") {
        saveConfig();
        if (key === "rotationMinutes") scheduleRotation();
      }
    };
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
          ? `${active.title} · ${active.reason || active.type}`
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
    stopRotation();
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
    document.getElementById(rootId)?.remove();
    document.getElementById(styleId)?.remove();
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
    close.onclick = () => panel.classList.remove("open");
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
    if (document.getElementById(rootId)) return;
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      #${rootId}, #${rootId} * { box-sizing: border-box; }
      #${rootId} { position: fixed; inset: 0; pointer-events: none; color: rgb(245 245 250); font: 13px/1.4 system-ui, sans-serif; }
      #${rootId} [data-codex-wallpaper-layer] { position: fixed; inset: 0; z-index: 0; pointer-events: none; }
      #${rootId} .media { position: absolute; inset: 0; overflow: hidden; }
      #${rootId} .media.builtin { background: radial-gradient(circle at 18% 20%, #57d7ff 0, transparent 36%), radial-gradient(circle at 82% 78%, #ff9ac6 0, transparent 38%), linear-gradient(135deg, #1b2ab5, #5d32b8 48%, #d44c87); }
      #${rootId} .media img, #${rootId} .media canvas { width: 100%; height: 100%; object-fit: cover; display: block; transform: translateZ(0); }
      #${rootId} .playback-source { position: fixed; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
      #${rootId} .dim { position: absolute; inset: 0; }
      #${rootId} .toolbar { position: fixed; right: 14px; bottom: 14px; z-index: 2147483647; display: flex; gap: 6px; pointer-events: auto; }
      #${rootId} .toolbar button, #${rootId} .panel button { border: 1px solid rgb(255 255 255 / .3); border-radius: 8px; background: rgb(20 20 24 / .9); color: white; padding: 7px 10px; cursor: pointer; }
      #${rootId} .panel { position: fixed; right: 14px; bottom: 58px; z-index: 2147483647; width: min(390px, calc(100vw - 28px)); max-height: min(74vh, 720px); overflow: auto; padding: 14px; border: 1px solid rgb(255 255 255 / .22); border-radius: 14px; background: color-mix(in srgb, var(--app-color-background-surface, rgb(24 24 28)) 94%, transparent); box-shadow: 0 18px 55px rgb(0 0 0 / .42); backdrop-filter: blur(18px); pointer-events: auto; display: none; }
      #${rootId} .panel.open { display: block; }
      #${rootId} .panel header { display: flex; align-items: center; justify-content: space-between; }
      #${rootId} .panel h3 { margin: 16px 0 8px; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; opacity: .72; }
      #${rootId} .import-row { display: flex; align-items: center; justify-content: space-between; margin-top: 12px; padding: 9px 10px; border: 1px dashed rgb(255 255 255 / .3); border-radius: 8px; cursor: pointer; }
      #${rootId} .import-row input { width: 135px; font-size: 11px; }
      #${rootId} .runtime-status, #${rootId} .playlist-summary { margin: 9px 0; color: rgb(215 215 225); }
      #${rootId} .wallpaper-list { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      #${rootId} .card { min-width: 0; padding: 7px; border: 1px solid rgb(255 255 255 / .16); border-radius: 10px; background: rgb(0 0 0 / .18); }
      #${rootId} .thumb { aspect-ratio: 16 / 9; display: grid; place-items: center; overflow: hidden; border-radius: 6px; background: rgb(255 255 255 / .08); font-size: 10px; opacity: .9; }
      #${rootId} .thumb img { width: 100%; height: 100%; object-fit: cover; }
      #${rootId} .card strong { display: block; margin-top: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      #${rootId} .card small { display: block; margin-top: 2px; color: rgb(200 200 210); }
      #${rootId} .card-actions { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
      #${rootId} .card-actions button { padding: 4px 6px; font-size: 10px; }
      #${rootId} .settings-grid { display: grid; gap: 7px; }
      #${rootId} .range { display: grid; grid-template-columns: 64px 48px 1fr; align-items: center; gap: 7px; }
      #${rootId} .range output { color: rgb(205 205 215); font-variant-numeric: tabular-nums; }
      #${rootId} .reset { margin-top: 14px; width: 100%; color: rgb(255 190 190) !important; }
      body :where([data-app-shell-main-surface], [data-app-shell-page-surface], [data-app-shell-page-sidebar], [data-app-shell-trailing-sidebar], [data-app-shell-titlebar], [data-app-shell-pane-content-viewport]) { position: relative; z-index: 1; background-color: color-mix(in srgb, var(--app-color-background-surface, rgb(24 24 28)) 88%, transparent) !important; backdrop-filter: blur(10px) saturate(.85); }
      body :is([data-app-shell-main-surface], [data-app-shell-page-surface], [data-app-shell-page-sidebar], [data-app-shell-trailing-sidebar], [data-app-shell-pane-content-viewport]) :where([class~='bg-surface'], [data-testid='diff-preview-scroll'], [data-composer-surface-variant], pre) { background-color: color-mix(in srgb, var(--app-color-background-surface-under, rgb(12 12 16)) 92%, transparent) !important; }
      body :where([role='dialog'], [data-radix-popper-content-wrapper]) { position: relative; z-index: 3; background-color: color-mix(in srgb, var(--app-color-background-surface-under, rgb(12 12 16)) 96%, transparent) !important; }
    `;
    root = document.createElement("div");
    root.id = rootId;
    layer = document.createElement("div");
    layer.dataset.codexWallpaperLayer = "";
    media = document.createElement("div");
    media.className = "media builtin";
    dim = document.createElement("div");
    dim.className = "dim";
    layer.append(media, dim);
    const toolbar = document.createElement("div");
    toolbar.className = "toolbar";
    const settings = document.createElement("button");
    settings.dataset.codexWallpaperSettings = "";
    settings.textContent = "壁纸设置";
    settings.onclick = () => {
      panel.classList.toggle("open");
      renderPanel();
    };
    const toggle = document.createElement("button");
    toggle.dataset.codexWallpaperToggle = "";
    toggle.textContent = "停用壁纸";
    toggle.onclick = () => disable();
    toolbar.append(settings, toggle);
    root.append(layer, buildPanel(), toolbar);
    document.documentElement.append(style, root);
  }

  async function enable() {
    config.enabled = true;
    saveConfig();
    mount();
    await loadImported();
    await applyActive();
    return state();
  }

  async function disable() {
    config.enabled = false;
    saveConfig();
    revokePlayback();
    stopRotation();
    database?.close();
    database = null;
    document.getElementById(rootId)?.remove();
    document.getElementById(styleId)?.remove();
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
      controls: document.querySelectorAll(`#${rootId} button`).length,
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
    };
  }

  function syncVisibility() {
    if (!playback) return;
    if (document.visibilityState === "hidden") {
      playback.video?.pause();
      playback.pause?.();
      if (playback.raf) cancelAnimationFrame(playback.raf);
    } else {
      playback.video?.play().catch(() => {});
      playback.resume?.();
      playback.start?.();
    }
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
    config = readConfig();
    if (config.enabled) refresh(sourcePayload);
    else disable();
  });
  channel.addEventListener("message", (event) => {
    if (event.data?.type === "prepare-reset") {
      disable();
    }
  });
  addEventListener("pagehide", () => {
    revokePlayback();
    stopRotation();
  });
  document.addEventListener("visibilitychange", syncVisibility);
  globalThis.__codexWallpaperApi = {
    refresh,
    enable,
    disable,
    state,
    receiveAsset(entry) {
      pendingAssetRequests.delete(entry.id);
      runtimeAssets.set(`workshop:${entry.id}`, {
        ...entry,
        kind: "workshop",
      });
      return applyActive();
    },
    receiveAssetError(id, message) {
      pendingAssetRequests.delete(id);
      setStatus(`素材加载失败：${message}`);
      renderPanel();
      return state();
    },
  };

  if (!config.enabled) return state();
  return enable();
}
