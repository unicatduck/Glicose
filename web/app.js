(function () {
  "use strict";

  const DEFAULT_SETTINGS = {
    host: "127.0.0.1",
    port: 17580,
    secret: "",
    units: "mgdl",
    low: 70,
    high: 180,
    lookbackHours: 24,
    peakWindowMinutes: 120,
    refreshMinutes: 5,
  };

  const SETTINGS_KEY = "glicose.settings";
  const MEALS_KEY = "glicose.meals";
  const MANUAL_KEY = "glicose.manualReadings";

  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch (e) {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  function loadMeals() {
    try {
      const raw = localStorage.getItem(MEALS_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch (e) {
      return [];
    }
  }

  function saveMeals(meals) {
    localStorage.setItem(MEALS_KEY, JSON.stringify(meals));
  }

  function loadManualReadings() {
    try {
      const raw = localStorage.getItem(MANUAL_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch (e) {
      return [];
    }
  }

  function saveManualReadings(readings) {
    localStorage.setItem(MANUAL_KEY, JSON.stringify(readings));
  }

  // ---- Pure data helpers (also used by tests) ----

  function mgdlToMmol(mgdl) {
    return mgdl / 18.018;
  }

  function mmolToMgdl(mmol) {
    return mmol * 18.018;
  }

  function formatValue(mgdl, units) {
    if (mgdl == null) return "-";
    if (units === "mmol") return mgdlToMmol(mgdl).toFixed(1);
    return String(Math.round(mgdl));
  }

  const TREND_ARROWS = {
    NONE: "?",
    DoubleUp: "↑↑",
    SingleUp: "↑",
    FortyFiveUp: "↗",
    Flat: "→",
    FortyFiveDown: "↘",
    SingleDown: "↓",
    DoubleDown: "↓↓",
    NOT_COMPUTABLE: "?",
    RATE_OUT_OF_RANGE: "?",
  };

  function trendArrow(direction) {
    return TREND_ARROWS[direction] || "?";
  }

  function classify(mgdl, low, high) {
    if (mgdl == null) return "";
    if (mgdl < low) return "low";
    if (mgdl > high) return "high";
    return "ok";
  }

  /**
   * Groups sgv entries (each {date(ms), sgv(mg/dL), direction}) into per-hour buckets.
   * Returns array sorted descending by hour start, each bucket:
   * { hourStart(ms), last, min, max, count, direction }
   */
  function groupByHour(entries) {
    const buckets = new Map();
    for (const e of entries) {
      const d = new Date(e.date);
      d.setMinutes(0, 0, 0);
      const key = d.getTime();
      if (!buckets.has(key)) {
        buckets.set(key, { hourStart: key, readings: [] });
      }
      buckets.get(key).readings.push(e);
    }
    const result = [];
    for (const bucket of buckets.values()) {
      const sorted = bucket.readings.slice().sort((a, b) => a.date - b.date);
      const values = sorted.map((r) => r.sgv);
      const lastReading = sorted[sorted.length - 1];
      result.push({
        hourStart: bucket.hourStart,
        last: lastReading.sgv,
        direction: lastReading.direction,
        min: Math.min(...values),
        max: Math.max(...values),
        count: sorted.length,
        hasManual: sorted.some((r) => r.source === "manual"),
      });
    }
    result.sort((a, b) => b.hourStart - a.hourStart);
    return result;
  }

  /**
   * For a meal at mealTime(ms), finds the baseline (closest reading at/before meal time,
   * falling back to the closest reading after) and the peak reading within peakWindowMinutes after.
   */
  function analyzeMeal(entries, mealTimeMs, peakWindowMinutes) {
    const sorted = entries.slice().sort((a, b) => a.date - b.date);
    let baseline = null;
    for (const e of sorted) {
      if (e.date <= mealTimeMs) baseline = e;
      else break;
    }
    if (!baseline) {
      baseline = sorted.find((e) => e.date > mealTimeMs) || null;
    }

    const windowEnd = mealTimeMs + peakWindowMinutes * 60 * 1000;
    const windowReadings = sorted.filter(
      (e) => e.date >= mealTimeMs && e.date <= windowEnd
    );

    let peak = null;
    for (const e of windowReadings) {
      if (!peak || e.sgv > peak.sgv) peak = e;
    }

    if (!baseline || !peak) {
      return { baseline, peak, delta: null };
    }
    return { baseline, peak, delta: peak.sgv - baseline.sgv };
  }

  function buildSgvUrl(settings) {
    const count = Math.max(1, Math.round((settings.lookbackHours * 60) / 5) + 20);
    return `http://${settings.host}:${settings.port}/sgv.json?count=${count}`;
  }

  async function sha1Hex(text) {
    const enc = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest("SHA-1", enc);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  async function fetchEntries(settings) {
    const headers = {};
    if (settings.secret) {
      headers["api-secret"] = await sha1Hex(settings.secret);
    }
    const res = await fetch(buildSgvUrl(settings), { headers });
    if (!res.ok) {
      throw new Error(`O xDrip+ respondeu com o código ${res.status}`);
    }
    const data = await res.json();
    const cutoff = Date.now() - settings.lookbackHours * 60 * 60 * 1000;
    return data
      .filter((e) => typeof e.sgv === "number" && e.date >= cutoff)
      .map((e) => ({ date: e.date, sgv: e.sgv, direction: e.direction, source: "xdrip" }));
  }

  /**
   * Merges live xDrip+ entries with manually-added historical readings into one
   * sorted list, so both feed the same hourly grouping / meal analysis.
   */
  function mergeEntries(liveEntries, manualReadings) {
    const manualAsEntries = manualReadings.map((m) => ({
      date: m.date,
      sgv: m.sgv,
      direction: undefined,
      source: "manual",
    }));
    return liveEntries.concat(manualAsEntries).sort((a, b) => a.date - b.date);
  }

  // ---- UI wiring (skipped entirely in non-browser test environment) ----

  const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";

  if (isBrowser) {
    let settings = loadSettings();
    let meals = loadMeals();
    let manualReadings = loadManualReadings();
    let liveEntries = [];
    let latestEntries = [];
    let refreshTimer = null;

    const statusBar = document.getElementById("statusBar");
    const summaryEl = document.getElementById("summary");
    const hourlyBody = document.getElementById("hourlyBody");
    const mealsList = document.getElementById("mealsList");
    const manualList = document.getElementById("manualList");

    function setStatus(message, isError) {
      statusBar.textContent = message;
      statusBar.classList.toggle("error", !!isError);
    }

    function hourLabel(ms) {
      const d = new Date(ms);
      const today = new Date();
      const isToday = d.toDateString() === today.toDateString();
      const time = d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
      if (isToday) return time;
      const day = d.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" });
      return `${day} ${time}`;
    }

    function mealsInHour(hourStart) {
      const hourEnd = hourStart + 60 * 60 * 1000;
      return meals.filter((m) => m.time >= hourStart && m.time < hourEnd);
    }

    function renderSummary() {
      if (latestEntries.length === 0) {
        summaryEl.innerHTML = "";
        return;
      }
      const values = latestEntries.map((e) => e.sgv);
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const min = Math.min(...values);
      const max = Math.max(...values);
      const inRange = values.filter((v) => v >= settings.low && v <= settings.high).length;
      const inRangePct = Math.round((inRange / values.length) * 100);

      const cards = [
        { label: "Média", value: formatValue(avg, settings.units) },
        { label: "Mínimo", value: formatValue(min, settings.units) },
        { label: "Máximo", value: formatValue(max, settings.units) },
        { label: "Tempo no intervalo", value: `${inRangePct}%` },
      ];
      summaryEl.innerHTML = cards
        .map(
          (c) => `<div class="card"><div class="value">${c.value}</div><div class="label">${c.label}</div></div>`
        )
        .join("");
    }

    function renderHourly() {
      const buckets = groupByHour(latestEntries);
      hourlyBody.innerHTML = buckets
        .map((b) => {
          const cls = classify(b.last, settings.low, settings.high);
          const mealsHere = mealsInHour(b.hourStart);
          const mealMark = mealsHere.length ? `<span class="meal-marker" title="${mealsHere.map((m) => m.label || "refeição").join(", ")}">🍽️</span>` : "";
          const manualMark = b.hasManual ? `<span class="meal-marker" title="Leitura manual (antiga)">✍️</span>` : "";
          return `<tr class="${cls}">
            <td>${hourLabel(b.hourStart)}</td>
            <td><span class="badge ${cls}">${formatValue(b.last, settings.units)}</span></td>
            <td>${formatValue(b.min, settings.units)}</td>
            <td>${formatValue(b.max, settings.units)}</td>
            <td>${trendArrow(b.direction)}</td>
            <td>${mealMark}${manualMark}</td>
          </tr>`;
        })
        .join("");
      if (buckets.length === 0) {
        hourlyBody.innerHTML = `<tr><td colspan="6" class="empty-hint">Sem leituras no período selecionado.</td></tr>`;
      }
    }

    function renderMeals() {
      const sorted = meals.slice().sort((a, b) => b.time - a.time);
      if (sorted.length === 0) {
        mealsList.innerHTML = `<div class="empty-hint">Ainda não registaste nenhuma refeição.</div>`;
        return;
      }
      mealsList.innerHTML = sorted
        .map((m) => {
          const { baseline, peak, delta } = analyzeMeal(latestEntries, m.time, settings.peakWindowMinutes);
          let stats = "Sem dados suficientes";
          if (delta != null) {
            const sign = delta >= 0 ? "+" : "";
            const peakTime = new Date(peak.date).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
            stats = `pico ${formatValue(peak.sgv, settings.units)} às ${peakTime}<br><span class="delta">${sign}${formatValue(delta, settings.units)}</span>`;
          }
          const time = new Date(m.time).toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
          const carbs = m.carbs ? ` &middot; ${m.carbs} g HC` : "";
          return `<div class="meal-card" data-id="${m.id}">
            <div class="meal-main">
              <span class="meal-time">${time}</span>
              <span class="meal-label">${m.label || "Refeição"}${carbs}</span>
            </div>
            <div class="meal-stats">${stats}</div>
            <button class="delete" data-id="${m.id}" title="Apagar">&times;</button>
          </div>`;
        })
        .join("");

      mealsList.querySelectorAll("button.delete").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-id");
          meals = meals.filter((m) => String(m.id) !== id);
          saveMeals(meals);
          renderMeals();
          renderHourly();
        });
      });
    }

    function renderManualList() {
      const sorted = manualReadings.slice().sort((a, b) => b.date - a.date);
      if (sorted.length === 0) {
        manualList.innerHTML = `<div class="empty-hint">Ainda não adicionaste nenhuma leitura antiga.</div>`;
        return;
      }
      manualList.innerHTML = sorted
        .map((m) => {
          const time = new Date(m.date).toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
          return `<div class="meal-card" data-id="${m.id}">
            <div class="meal-main">
              <span class="meal-time">${time}</span>
              <span class="meal-label">Leitura manual</span>
            </div>
            <div class="meal-stats">${formatValue(m.sgv, settings.units)} ${settings.units === "mmol" ? "mmol/L" : "mg/dL"}</div>
            <button class="delete" data-id="${m.id}" title="Apagar">&times;</button>
          </div>`;
        })
        .join("");

      manualList.querySelectorAll("button.delete").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-id");
          manualReadings = manualReadings.filter((m) => String(m.id) !== id);
          saveManualReadings(manualReadings);
          latestEntries = mergeEntries(liveEntries, manualReadings);
          renderManualList();
          renderSummary();
          renderHourly();
          renderMeals();
        });
      });
    }

    async function refresh() {
      setStatus("A atualizar...");
      try {
        liveEntries = await fetchEntries(settings);
        latestEntries = mergeEntries(liveEntries, manualReadings);
        renderSummary();
        renderHourly();
        renderMeals();
        renderManualList();
        setStatus(`Atualizado às ${new Date().toLocaleTimeString("pt-PT")} · ${latestEntries.length} leituras`);
      } catch (err) {
        console.error(err);
        const hint = err instanceof TypeError
          ? " (pode ser CORS/rede: confirma que o Web Service está ativo no xDrip+ e que estás a abrir esta página no mesmo telemóvel)"
          : "";
        setStatus(`Erro a ligar ao xDrip+: ${err.message}${hint}`, true);
        latestEntries = mergeEntries([], manualReadings);
        renderHourly();
        renderManualList();
      }
    }

    function scheduleRefresh() {
      if (refreshTimer) clearInterval(refreshTimer);
      if (settings.refreshMinutes > 0) {
        refreshTimer = setInterval(refresh, settings.refreshMinutes * 60 * 1000);
      }
    }

    function openSettingsDialog() {
      document.getElementById("setHost").value = settings.host;
      document.getElementById("setPort").value = settings.port;
      document.getElementById("setSecret").value = settings.secret;
      document.getElementById("setUnits").value = settings.units;
      document.getElementById("setLow").value = settings.low;
      document.getElementById("setHigh").value = settings.high;
      document.getElementById("setLookback").value = settings.lookbackHours;
      document.getElementById("setPeakWindow").value = settings.peakWindowMinutes;
      document.getElementById("setRefresh").value = settings.refreshMinutes;
      document.getElementById("settingsDialog").showModal();
    }

    document.getElementById("btnSettings").addEventListener("click", openSettingsDialog);
    document.getElementById("settingsCancel").addEventListener("click", () => {
      document.getElementById("settingsDialog").close();
    });
    document.getElementById("settingsForm").addEventListener("submit", (ev) => {
      ev.preventDefault();
      settings = {
        host: document.getElementById("setHost").value.trim() || DEFAULT_SETTINGS.host,
        port: Number(document.getElementById("setPort").value) || DEFAULT_SETTINGS.port,
        secret: document.getElementById("setSecret").value,
        units: document.getElementById("setUnits").value,
        low: Number(document.getElementById("setLow").value) || DEFAULT_SETTINGS.low,
        high: Number(document.getElementById("setHigh").value) || DEFAULT_SETTINGS.high,
        lookbackHours: Number(document.getElementById("setLookback").value) || DEFAULT_SETTINGS.lookbackHours,
        peakWindowMinutes: Number(document.getElementById("setPeakWindow").value) || DEFAULT_SETTINGS.peakWindowMinutes,
        refreshMinutes: Number(document.getElementById("setRefresh").value),
      };
      saveSettings(settings);
      document.getElementById("settingsDialog").close();
      scheduleRefresh();
      refresh();
    });

    function openMealDialog() {
      const now = new Date();
      now.setSeconds(0, 0);
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      document.getElementById("mealTime").value = now.toISOString().slice(0, 16);
      document.getElementById("mealLabel").value = "";
      document.getElementById("mealCarbs").value = "";
      document.getElementById("mealDialog").showModal();
    }

    document.getElementById("btnAddMeal").addEventListener("click", openMealDialog);
    document.getElementById("mealCancel").addEventListener("click", () => {
      document.getElementById("mealDialog").close();
    });
    document.getElementById("mealForm").addEventListener("submit", (ev) => {
      ev.preventDefault();
      const localValue = document.getElementById("mealTime").value;
      const time = new Date(localValue).getTime();
      const label = document.getElementById("mealLabel").value.trim();
      const carbs = Number(document.getElementById("mealCarbs").value) || null;
      meals.push({ id: Date.now(), time, label, carbs });
      saveMeals(meals);
      document.getElementById("mealDialog").close();
      renderMeals();
      renderHourly();
    });

    function openManualDialog() {
      const now = new Date();
      now.setSeconds(0, 0);
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      document.getElementById("manualTime").value = now.toISOString().slice(0, 16);
      document.getElementById("manualValue").value = "";
      document.getElementById("manualValueLabel").firstChild.textContent =
        settings.units === "mmol" ? "Valor de glicose (mmol/L)" : "Valor de glicose (mg/dL)";
      document.getElementById("manualDialog").showModal();
    }

    document.getElementById("btnAddManual").addEventListener("click", openManualDialog);
    document.getElementById("manualCancel").addEventListener("click", () => {
      document.getElementById("manualDialog").close();
    });
    document.getElementById("manualForm").addEventListener("submit", (ev) => {
      ev.preventDefault();
      const localValue = document.getElementById("manualTime").value;
      const date = new Date(localValue).getTime();
      const rawValue = Number(document.getElementById("manualValue").value);
      const sgv = settings.units === "mmol" ? mmolToMgdl(rawValue) : rawValue;
      manualReadings.push({ id: Date.now(), date, sgv });
      saveManualReadings(manualReadings);
      latestEntries = mergeEntries(liveEntries, manualReadings);
      document.getElementById("manualDialog").close();
      renderManualList();
      renderSummary();
      renderHourly();
      renderMeals();
    });

    scheduleRefresh();
    refresh();
  }

  // Export pure functions for the Node-based test harness.
  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      groupByHour,
      analyzeMeal,
      classify,
      formatValue,
      mgdlToMmol,
      mmolToMgdl,
      trendArrow,
      buildSgvUrl,
      mergeEntries,
    };
  }
})();
