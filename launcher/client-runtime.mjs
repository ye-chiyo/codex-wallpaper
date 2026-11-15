export function runtimeSource(payload) {
  return `(${createCodexWallpaperRuntime.toString()})(${JSON.stringify(payload)})`;
}

export function createCodexWallpaperRuntime(payload) {
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
  let renderGeneration = 0;
  let activeGeneration = 0;
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

  function revokePlayback() {
    renderGeneration += 1;
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
    if (currentObjectUrl) {
      for (const [key, asset] of runtimeAssets) {
        if (asset.assetUrl === currentObjectUrl) runtimeAssets.delete(key);
      }
      URL.revokeObjectURL(currentObjectUrl);
    }
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

  async function configureHost() {
    hostReady = true;
    pendingAssetRequests.clear();
    pendingPreviewRequests.clear();
    if (root) await applyActive();
    return state();
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
    const generation = renderGeneration;
    const image = document.createElement("img");
    image.alt = "";
    image.src = url;
    image.onerror = () => {
      if (generation === renderGeneration)
        showGradient("素材加载失败，已保留静态渐变");
    };
    media.replaceChildren(image);
    media.className = "media";
    if (message) setStatus(message);
    applyVisualSettings();
  }

  function showVideo(url, message, previewUrl) {
    revokePlayback();
    const generation = renderGeneration;
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
    const preview = previewUrl ? document.createElement("img") : null;
    if (preview) {
      preview.className = "media-preview";
      preview.alt = "";
      preview.src = previewUrl;
    }
    media.replaceChildren(...(preview ? [preview] : []), canvas, video);
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
            preview?.remove();
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
      if (generation !== renderGeneration) return;
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
      if (generation !== renderGeneration) return;
      if (config.settings.volume) setStatus("视频加载失败，已降级");
      if (previewUrl) showImage(previewUrl, "视频加载失败，已保留预览");
      else showGradient("视频加载失败，已保留静态渐变");
    };
    video
      .play()
      .then(() => {
        if (generation !== renderGeneration) return;
        if (document.visibilityState === "hidden") video.pause();
      })
      .catch(() => {});
    if (message) setStatus(message);
    applyVisualSettings();
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
    revokePlayback();
    const generation = renderGeneration;
    const engine = globalThis.WebWallGL;
    if (!engine?.createScene || !engine?.bytesSource) {
      if (previewUrl)
        showImage(previewUrl, `${entry.title} · Scene 渲染器不可用，预览降级`);
      else showGradient(`${entry.title} · Scene 渲染器不可用`);
      return;
    }
    const host = document.createElement("div");
    host.className = "scene-host";
    const preview = previewUrl ? document.createElement("img") : null;
    if (preview) {
      preview.className = "media-preview";
      preview.alt = "";
      preview.src = previewUrl;
    }
    media.replaceChildren(host, ...(preview ? [preview] : []));
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
    sceneBytes(assetUrl)
      .then((bytes) => {
        if (generation !== renderGeneration) return;
        return instance.load(
          engine.bytesSource(
            bytes,
            { type: "scene", file: "scene.pkg" },
            entry.id
          )
        );
      })
      .then(() => {
        if (generation !== renderGeneration) return;
        if (document.visibilityState === "hidden") instance.pause();
        host.classList.add("ready");
        preview?.remove();
        setStatus(`${entry.title} · Scene`);
      })
      .catch(() => {
        if (generation !== renderGeneration) return;
        if (previewUrl)
          showImage(previewUrl, `${entry.title} · Scene 失败，预览降级`);
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
    const generation = ++activeGeneration;
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
        if (generation !== activeGeneration) return state();
        const item = await requestResult(
          db.transaction(dbStore, "readonly").objectStore(dbStore).get(entry.id)
        );
        if (generation !== activeGeneration) return state();
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
        const assetUrl = entry.assetUrl || entry.assetDataUrl;
        const previewUrl = entry.previewDataUrl;
        if (entry.type === "web" && !entry.webHtml) {
          if (previewUrl)
            showImage(previewUrl, `${entry.title} · Web 预览降级`);
          else showGradient(`${entry.title} · Web 离线文件不可用`);
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
          if (previewUrl) showImage(previewUrl, `${entry.title} · 预览降级`);
          else showGradient(`${entry.title} · 重启专用入口后载入`);
          scheduleRotation();
          renderPanel();
          return;
        }
        const url = assetUrl || previewUrl;
        if (!url && !entry.webHtml) {
          showGradient(`${entry.title} · 无可用画面`);
        } else if (entry.type === "scene" && assetUrl) {
          showScene(entry, assetUrl, previewUrl);
        } else if (entry.type === "web" && entry.webHtml) {
          showWeb(entry);
        } else if (assetUrl && entry.type === "video") {
          showVideo(url, `${entry.title} · 视频`, previewUrl);
        } else {
          showImage(
            url,
            assetUrl
              ? `${entry.title} · ${entry.type}`
              : `${entry.title} · 预览降级`
          );
        }
        if (assetUrl?.startsWith("blob:")) currentObjectUrl = assetUrl;
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

  function card(entry) {
    const item = document.createElement("article");
    item.className = "card";
    const visual = document.createElement("div");
    visual.className = "thumb";
    const previewUrl = entry.previewDataUrl;
    const visualUrl = previewUrl || entry.assetDataUrl;
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
    } else {
      visual.textContent = entry.type.toUpperCase();
      visual.dataset.previewId = entry.id;
      previewObserver.observe(visual);
    }
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
    use.onclick = () => {
      config.active = { kind: entry.kind, id: entry.id };
      saveConfig();
      requestPreview(entry.id);
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
    renderPanel();
    if (config.active.kind === "workshop" && config.active.id === entry.id) {
      const active = findEntry(config.active);
      if (!active?.assetUrl && !active?.assetDataUrl && !active?.webHtml)
        return applyActive();
    }
    return state();
  }

  function receivePreviewError(id) {
    pendingPreviewRequests.delete(id);
    failedPreviewIds.add(id);
    renderPanel();
    return state();
  }

  function beginAssetTransfer(entry) {
    assetTransfers.set(entry.id, {
      entry,
      parts: [],
      received: 0,
    });
    if (
      config.active.kind === "workshop" &&
      config.active.id === entry.id &&
      entry.previewDataUrl
    )
      showImage(entry.previewDataUrl, `${entry.title} · 正在载入`);
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
    if (root?.isConnected) return;
    root = null;
    removeAdapterNodes();
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      #${rootId}, #${rootId} * { box-sizing: border-box; }
      #${rootId}, #${controlsId} { position: fixed; inset: 0; pointer-events: none; color: rgb(245 245 250); font: 13px/1.4 system-ui, sans-serif; }
      #${controlsId} { z-index: 2147483647; }
      #${rootId} [data-codex-wallpaper-layer] { position: fixed; inset: 0; z-index: 0; pointer-events: none; }
      #${rootId} .media { position: absolute; inset: 0; overflow: hidden; }
      #${rootId} .media.builtin { background: radial-gradient(circle at 18% 20%, #57d7ff 0, transparent 36%), radial-gradient(circle at 82% 78%, #ff9ac6 0, transparent 38%), linear-gradient(135deg, #1b2ab5, #5d32b8 48%, #d44c87); }
      #${rootId} .scene-host { position: absolute; inset: 0; opacity: 0; transition: opacity .16s ease-out; }
      #${rootId} .scene-host.ready { opacity: 1; }
      #${rootId} .media-preview { position: absolute; inset: 0; z-index: 2; width: 100%; height: 100%; object-fit: cover; display: block; }
      #${rootId} .media img, #${rootId} .media canvas { width: 100%; height: 100%; object-fit: cover; display: block; transform: translateZ(0); }
      #${rootId} .playback-source { position: fixed; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
      #${rootId} .dim { position: absolute; inset: 0; }
      #${controlsId} .toolbar { position: fixed; right: 14px; bottom: 14px; z-index: 2147483647; display: flex; gap: 6px; pointer-events: auto; }
      #${controlsId} .toolbar button, #${controlsId} .panel button { border: 1px solid rgb(255 255 255 / .3); border-radius: 8px; background: rgb(20 20 24 / .9); color: white; padding: 7px 10px; cursor: pointer; }
      #${controlsId} .panel { position: fixed; right: 14px; bottom: 58px; z-index: 2147483647; width: min(390px, calc(100vw - 28px)); max-height: min(74vh, 720px); overflow: auto; padding: 14px; border: 1px solid rgb(255 255 255 / .22); border-radius: 14px; background: color-mix(in srgb, var(--app-color-background-surface, rgb(24 24 28)) 94%, transparent); box-shadow: 0 18px 55px rgb(0 0 0 / .42); backdrop-filter: blur(18px); pointer-events: auto; display: none; }
      #${controlsId} .panel.open { display: block; }
      #${controlsId} .panel header { display: flex; align-items: center; justify-content: space-between; }
      #${controlsId} .panel h3 { margin: 16px 0 8px; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; opacity: .72; }
      #${controlsId} .import-row { display: flex; align-items: center; justify-content: space-between; margin-top: 12px; padding: 9px 10px; border: 1px dashed rgb(255 255 255 / .3); border-radius: 8px; cursor: pointer; }
      #${controlsId} .import-row input { width: 135px; font-size: 11px; }
      #${controlsId} .runtime-status, #${controlsId} .playlist-summary { margin: 9px 0; color: rgb(215 215 225); }
      #${controlsId} .wallpaper-list { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      #${controlsId} .card { min-width: 0; padding: 7px; border: 1px solid rgb(255 255 255 / .16); border-radius: 10px; background: rgb(0 0 0 / .18); }
      #${controlsId} .thumb { aspect-ratio: 16 / 9; display: grid; place-items: center; overflow: hidden; border-radius: 6px; background: rgb(255 255 255 / .08); font-size: 10px; opacity: .9; }
      #${controlsId} .thumb img { width: 100%; height: 100%; object-fit: cover; }
      #${controlsId} .card strong { display: block; margin-top: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      #${controlsId} .card small { display: block; margin-top: 2px; color: rgb(200 200 210); }
      #${controlsId} .card-actions { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
      #${controlsId} .card-actions button { padding: 4px 6px; font-size: 10px; }
      #${controlsId} .settings-grid { display: grid; gap: 7px; }
      #${controlsId} .range { display: grid; grid-template-columns: 64px 48px 1fr; align-items: center; gap: 7px; }
      #${controlsId} .range output { color: rgb(205 205 215); font-variant-numeric: tabular-nums; }
      #${controlsId} .reset { margin-top: 14px; width: 100%; color: rgb(255 190 190) !important; }
      body :where([data-app-shell-main-surface], [data-app-shell-page-sidebar], [data-app-shell-trailing-sidebar], [data-app-shell-titlebar], [data-app-shell-pane-content-viewport]) { z-index: 1; background-color: color-mix(in srgb, var(--app-color-background-surface, rgb(24 24 28)) 64%, transparent) !important; backdrop-filter: blur(14px) saturate(.9);
        &:not([data-app-shell-titlebar]) { position: relative; }
      }
      body [data-app-shell-trailing-sidebar]:has([data-thread-find-target='review']) { background-color: transparent !important; }
      body [data-app-shell-page-surface] { background-color: transparent !important; backdrop-filter: none; }
      body :is([data-app-shell-main-surface], [data-app-shell-page-surface], [data-app-shell-page-sidebar], [data-app-shell-trailing-sidebar], [data-app-shell-pane-content-viewport]) :where([class~='bg-surface'], [data-testid='diff-preview-scroll'], [data-composer-surface-variant], pre) { background-color: color-mix(in srgb, var(--app-color-background-surface-under, rgb(12 12 16)) 92%, transparent) !important; }
      body [data-thread-scroll-footer] [class~='bg-surface']:not([data-composer-surface-variant], [data-composer-surface-variant] *, [data-pip-obstacle='thread-footer-leading'], [data-pip-obstacle='thread-footer-leading'] *) { background-color: transparent !important; }
      body [data-app-action-timeline-scroll] > :has(> [data-thread-scroll-footer])::before,
      body [data-app-action-timeline-scroll] > :has(> [data-thread-scroll-footer])::after { background: none !important; }
      body [data-app-shell-trailing-sidebar] [data-thread-find-target='review'] { background-color: transparent !important; }
      body :where([role='dialog'], [data-radix-popper-content-wrapper]) { position: relative; z-index: 3; background-color: color-mix(in srgb, var(--app-color-background-surface-under, rgb(12 12 16)) 96%, transparent) !important; }
    `;
    root = document.createElement("div");
    root.id = rootId;
    const controls = document.createElement("div");
    controls.id = controlsId;
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
    controls.append(buildPanel(), toolbar);
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

  async function disable() {
    config.enabled = false;
    saveConfig();
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
