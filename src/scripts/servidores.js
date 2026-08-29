(() => {
  "use strict";

  const state = { servers: [] };
  const $ = (id) => document.getElementById(id);

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function initials(name) {
    const parts = String(name || "Lore").trim().split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]).join("").toUpperCase() || "L";
  }

  async function fetchJson(url) {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      credentials: "same-origin",
      cache: "no-store"
    });

    const text = await response.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }

    if (!response.ok) {
      throw new Error(data.message || `HTTP ${response.status}`);
    }

    return data;
  }

  function show(screen) {
    [$("loading"), $("login"), $("content"), $("error")].forEach((el) => {
      if (el) el.classList.add("hidden");
    });
    screen?.classList.remove("hidden");
  }

  function renderProfile(user) {
    const name = user.globalName || user.username || "Usuário";
    $("profileName").textContent = name;
    $("profileId").textContent = user.id || "ID indisponível";

    const avatar = $("profileAvatar");
    const fallback = $("profileFallback");
    if (user.avatar && user.id) {
      avatar.src = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
      avatar.classList.remove("hidden");
      fallback.classList.add("hidden");
    } else {
      fallback.textContent = initials(name);
      fallback.classList.remove("hidden");
      avatar.classList.add("hidden");
    }
  }

  function renderServers(servers) {
    state.servers = Array.isArray(servers) ? servers : [];
    $("serverCount").textContent = `${state.servers.length} ${state.servers.length === 1 ? "servidor" : "servidores"}`;

    const grid = $("serversGrid");
    const empty = $("empty");
    grid.innerHTML = "";

    if (!state.servers.length) {
      empty.classList.remove("hidden");
      return;
    }

    empty.classList.add("hidden");

    for (const server of state.servers) {
      const name = escapeHtml(server.name || "Servidor sem nome");
      const id = encodeURIComponent(server.id || "");
      const icon = server.icon
        ? `<img class="server-icon" src="${escapeHtml(server.icon)}" alt="">`
        : `<div class="server-icon server-icon-fallback">${escapeHtml(initials(server.name))}</div>`;

      const card = document.createElement("article");
      card.className = "server-card-modern";
      card.innerHTML = `
        <div class="server-card-top">
          ${icon}
          <div class="server-card-heading">
            <h3>${name}</h3>
            <span class="server-online"><i></i> Lore conectada</span>
          </div>
        </div>
        <div class="server-meta">
          <div><span>Membros</span><strong>${Number(server.memberCount || 0).toLocaleString("pt-BR")}</strong></div>
          <div><span>ID</span><strong class="mono">${escapeHtml(server.id || "—")}</strong></div>
        </div>
        <a class="manage-button" href="/servidor?id=${id}">Gerenciar <span>→</span></a>
      `;
      grid.appendChild(card);
    }
  }

  async function load() {
    show($("loading"));

    try {
      const me = await fetchJson("/api/me");
      if (!me.authenticated || !me.user) {
        show($("login"));
        return;
      }

      renderProfile(me.user);

      const data = await fetchJson("/api/lore/servers");
      renderServers(data.servers);
      show($("content"));
    } catch (error) {
      console.error("Erro ao carregar servidores:", error);
      $("errorMessage").textContent = error.message || "Não foi possível carregar os servidores.";
      show($("error"));
    }
  }

  $("retry").addEventListener("click", load);
  load();
})();
