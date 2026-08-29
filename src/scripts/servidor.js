(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const guildId = params.get("id");

  function initials(name) {
    return String(name || "Lore").trim().split(/\s+/).slice(0,2).map(x => x[0]).join("").toUpperCase() || "L";
  }

  async function fetchJson(url) {
    const response = await fetch(url, { headers: { Accept: "application/json" }, credentials: "same-origin", cache: "no-store" });
    const text = await response.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
    if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`);
    return data;
  }

  function show(id) {
    $("loading").classList.add("hidden");
    $("error").classList.add("hidden");
    $("content").classList.add("hidden");
    $(id).classList.remove("hidden");
  }

  async function init() {
    if (!guildId) {
      $("errorMessage").textContent = "Nenhum ID de servidor foi informado.";
      show("error");
      return;
    }

    try {
      const me = await fetchJson("/api/me");
      if (!me.authenticated) {
        location.href = "/auth/discord";
        return;
      }

      const data = await fetchJson("/api/lore/servers");
      const servers = Array.isArray(data.servers) ? data.servers : [];
      const server = servers.find(s => String(s.id) === String(guildId));

      if (!server) throw new Error("Esse servidor não está disponível na lista da Lore.");

      $("name").textContent = server.name || "Servidor";
      $("id").textContent = server.id || "—";
      $("members").textContent = Number(server.memberCount || 0).toLocaleString("pt-BR");
      $("iconFallback").textContent = initials(server.name);

      if (server.icon) {
        $("icon").src = server.icon;
        $("icon").classList.remove("hidden");
        $("iconFallback").classList.add("hidden");
      }

      show("content");
    } catch (error) {
      console.error("Erro ao carregar servidor:", error);
      $("errorMessage").textContent = error.message || "Não foi possível carregar o servidor.";
      show("error");
    }
  }

  init();
})();
