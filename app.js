(() => {
  "use strict";
  const STORAGE_KEY = "sleeplog-offline-v1";
  const $ = id => document.getElementById(id);
  let data = loadData();
  let tickHandle = null;

  function loadData() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return {
        active: parsed.active && parsed.active.startedAt ? parsed.active : null,
        history: Array.isArray(parsed.history) ? parsed.history.filter(x => x && x.id && x.startedAt && x.endedAt) : []
      };
    } catch {
      return { active: null, history: [] };
    }
  }

  function saveData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (error) {
      alert("Не удалось сохранить данные на телефоне. Проверь свободное место и настройки браузера.");
      console.error(error);
      return false;
    }
  }

  const pad = n => String(n).padStart(2, "0");
  function dateFrom(value) { return new Date(value); }
  function durationMs(start, end = Date.now()) {
    return Math.max(0, dateFrom(start).getTime() <= end ? end - dateFrom(start).getTime() : 0);
  }
  function parts(ms) {
    const minutes = Math.floor(ms / 60000);
    return { hours: Math.floor(minutes / 60), minutes: minutes % 60, totalMinutes: minutes };
  }
  function formatDuration(ms) {
    const p = parts(ms);
    return `${p.hours} ч ${p.minutes} мин`;
  }
  function formatTimer(ms) {
    const sec = Math.floor(ms / 1000);
    return `${pad(Math.floor(sec / 3600))}:${pad(Math.floor(sec / 60) % 60)}:${pad(sec % 60)}`;
  }
  function formatDate(value) {
    return dateFrom(value).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  }
  function formatTime(value) {
    return dateFrom(value).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  }
  function safeText(value) {
    return String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  }

  function completedDuration(entry) {
    return durationMs(entry.startedAt, dateFrom(entry.endedAt).getTime());
  }
  function getWeekDays() {
    const days = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      days.push(d);
    }
    return days;
  }
  function durationForDay(entry, dayStart, dayEnd) {
    const a = Math.max(dateFrom(entry.startedAt).getTime(), dayStart.getTime());
    const b = Math.min(dateFrom(entry.endedAt).getTime(), dayEnd.getTime());
    return Math.max(0, b - a);
  }
  function renderChart() {
    const days = getWeekDays();
    const entries = [...data.history];
    const max = Math.max(8 * 3600000, ...days.map(day => {
      const end = new Date(day); end.setDate(end.getDate() + 1);
      return entries.reduce((sum, entry) => sum + durationForDay(entry, day, end), 0);
    }));
    $("week-chart").innerHTML = days.map((day, index) => {
      const end = new Date(day); end.setDate(end.getDate() + 1);
      const ms = entries.reduce((sum, entry) => sum + durationForDay(entry, day, end), 0);
      const height = Math.max(ms > 0 ? 4 : 2, Math.min(100, ms / max * 100));
      const label = day.toLocaleDateString("ru-RU", { weekday: "short" }).replace(".", "");
      return `<div class="chart-day"><span class="bar-hours">${ms ? (ms / 3600000).toLocaleString("ru-RU", { maximumFractionDigits: 1 }) : "—"}</span><div class="bar-track"><div class="bar ${index === 6 ? "today" : ""}" style="height:${height}%"></div></div><span class="bar-label">${safeText(label)}</span></div>`;
    }).join("");
  }
  function renderHistory() {
    const list = $("history-list");
    const entries = [...data.history].sort((a, b) => dateFrom(b.startedAt) - dateFrom(a.startedAt));
    $("empty-history").hidden = entries.length > 0;
    list.innerHTML = entries.slice(0, 100).map(entry => `
      <article class="history-item">
        <div class="history-moon">☾</div>
        <div class="history-info">
          <div class="history-date">${safeText(formatDate(entry.startedAt))}</div>
          <div class="history-time">${safeText(formatTime(entry.startedAt))} — ${safeText(formatTime(entry.endedAt))}</div>
        </div>
        <div class="history-duration">${safeText(formatDuration(completedDuration(entry)))}</div>
        <button class="delete-button" data-delete="${safeText(entry.id)}" aria-label="Удалить запись" title="Удалить">×</button>
      </article>`).join("");
    list.querySelectorAll("[data-delete]").forEach(button => button.addEventListener("click", () => {
      if (!confirm("Удалить эту запись сна?")) return;
      data.history = data.history.filter(item => item.id !== button.dataset.delete);
      saveData(); render();
    }));
  }
  function renderStats() {
    const total = data.history.reduce((sum, entry) => sum + completedDuration(entry), 0);
    const weekStart = new Date(); weekStart.setHours(0,0,0,0); weekStart.setDate(weekStart.getDate() - 6);
    const weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate() + 1); weekEnd.setHours(0,0,0,0);
    const week = data.history.reduce((sum, entry) => sum + durationForDay(entry, weekStart, weekEnd), 0);
    $("total-stat").textContent = formatDuration(total);
    $("week-stat").textContent = formatDuration(week);
  }
  function renderActive() {
    const button = $("sleep-button");
    const active = Boolean(data.active);
    $("session-label").textContent = active ? "ЗАПИСЬ ИДЁТ" : "СЕГОДНЯ";
    $("session-status").textContent = active ? `Начало: ${formatDate(data.active.startedAt)} в ${formatTime(data.active.startedAt)}` : "Сон ещё не начат";
    button.textContent = active ? "✓ Завершить сон" : "☾ Начать сон";
    button.classList.toggle("stop", active);
    $("timer").textContent = active ? formatTimer(durationMs(data.active.startedAt)) : "00:00:00";
  }
  function render() {
    const now = new Date();
    $("today-label").textContent = now.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" }).toUpperCase();
    $("greeting").textContent = now.getHours() >= 5 && now.getHours() < 12 ? "Доброе утро" : now.getHours() >= 18 || now.getHours() < 5 ? "Спокойной ночи" : "Время отдохнуть";
    renderActive(); renderStats(); renderChart(); renderHistory();
  }
  $("sleep-button").addEventListener("click", () => {
    if (!data.active) {
      data.active = { startedAt: new Date().toISOString() };
      if (!saveData()) { data.active = null; return; }
    } else {
      const endedAt = new Date().toISOString();
      if (dateFrom(endedAt) <= dateFrom(data.active.startedAt)) return;
      data.history.push({ id: (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`), startedAt: data.active.startedAt, endedAt });
      data.active = null;
      if (!saveData()) { data.active = { startedAt: data.history[data.history.length - 1].startedAt }; data.history.pop(); return; }
    }
    render();
  });
  $("clear-button").addEventListener("click", () => {
    if (!data.history.length) { alert("История уже пустая."); return; }
    if (!confirm("Точно удалить всю историю сна? Это действие нельзя отменить.")) return;
    data.history = [];
    saveData(); render();
  });
  $("export-button").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), ...data }, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `sleeplog-backup-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  });
  render();
  tickHandle = setInterval(() => { if (data.active) renderActive(); }, 1000);
  window.addEventListener("pageshow", render);
})();
