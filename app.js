(function () {
  "use strict";

  const STORAGE_KEY = "quitpath_data_v1";
  const DAY_MS = 24 * 60 * 60 * 1000;

  /* ---------- persistence ---------- */

  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  let state = loadData();

  /* ---------- helpers ---------- */

  function toLocalDateStr(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function todayStr() {
    return toLocalDateStr(new Date());
  }

  function daysBetween(a, b) {
    const d1 = new Date(a + "T00:00:00");
    const d2 = new Date(b + "T00:00:00");
    return Math.round((d2 - d1) / DAY_MS);
  }

  function fmtMoney(n) {
    return "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function fmtNum(n) {
    return Math.round(n).toLocaleString();
  }

  /* profile derived numbers: cigsPerDay (equivalent), costPerCig */
  function derivedProfile(p) {
    if (p.type === "cigarette") {
      const cigsPerDay = p.cigPerDay;
      const costPerCig = p.cigPackCost / p.cigPerPack;
      return { cigsPerDay, costPerCig };
    } else {
      const cigsPerDay = p.hrPerDay;
      const gramsPerDay = p.hrPerDay * p.hrGramsPerCig;
      const costPerGram = p.hrPouchCost / p.hrPouchSize;
      const costPerCig = costPerGram * p.hrGramsPerCig;
      return { cigsPerDay, costPerCig, gramsPerDay };
    }
  }

  /* build a taper schedule from today (baseline) down to 0 on quitDate */
  function buildTaperSchedule(baselinePerDay, startDateStr, quitDateStr) {
    const totalDays = Math.max(daysBetween(startDateStr, quitDateStr), 1);
    const schedule = [];
    for (let i = 0; i <= totalDays; i++) {
      const d = new Date(startDateStr + "T00:00:00");
      d.setDate(d.getDate() + i);
      const dateStr = toLocalDateStr(d);
      const target = i === totalDays
        ? 0
        : Math.max(0, Math.round(baselinePerDay * (1 - i / totalDays)));
      schedule.push({ date: dateStr, target });
    }
    return schedule;
  }

  const QUOTES = [
    "Every cigarette you don't smoke is doing you good.",
    "The craving lasts a few minutes. The pride lasts a lot longer.",
    "You don't have to see the whole staircase, just take the first step.",
    "Quitting is a process, not a moment — every hour counts.",
    "Your lungs are already starting to heal. Keep going.",
    "One day at a time beats one cigarette at a time.",
    "The urge to smoke will pass whether you smoke or not.",
    "You're not giving anything up. You're taking your life back.",
    "Progress, not perfection. A slip isn't a failure, it's data.",
    "Future you is already thanking you for this.",
    "Discomfort now is the price of freedom later.",
    "You've quit before you even realize how strong that makes you.",
    "Smokers who quit before 40 cut their risk of dying from smoking-related disease by about 90%.",
    "Cravings are temporary. Regret lasts longer than a craving ever will.",
    "You are stronger than a urge that lasts three minutes.",
    "Every hour smoke-free is a small rebellion against the habit.",
    "Money saved today is a trip, a gift, or a rainy-day fund tomorrow.",
    "Breathing easier isn't a coincidence — it's the plan working.",
    "Nobody said it would be easy. They said it would be worth it.",
    "You don't need a perfect streak, you need to keep showing up.",
  ];

  function quoteOfTheDay() {
    const d = new Date();
    const seed = d.getFullYear() * 1000 + dayOfYear(d);
    return QUOTES[seed % QUOTES.length];
  }

  function dayOfYear(d) {
    const start = new Date(d.getFullYear(), 0, 0);
    return Math.floor((d - start) / DAY_MS);
  }

  function randomQuote(excluding) {
    let q = excluding;
    while (q === excluding && QUOTES.length > 1) {
      q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
    }
    return q;
  }

  /* ---------- trigger tracking ---------- */

  // group order defines cutting priority: automatic first, then ritual, then emotional last.
  // "other" is a catch-all with no cutting-priority recommendation of its own.
  const TRIGGERS = [
    { id: "stress", label: "Stress", emoji: "😣", group: "emotional" },
    { id: "anxiety", label: "Anxiety / Panic", emoji: "😰", group: "emotional" },
    { id: "anger", label: "Anger", emoji: "😠", group: "emotional" },
    { id: "sadness", label: "Sadness", emoji: "😢", group: "emotional" },
    { id: "boredom", label: "Boredom", emoji: "🥱", group: "automatic" },
    { id: "meal", label: "After meal", emoji: "🍽️", group: "ritual" },
    { id: "coffee", label: "Coffee / tea", emoji: "☕", group: "ritual" },
    { id: "workbreak", label: "Work break", emoji: "💼", group: "ritual" },
    { id: "alcohol", label: "Social / alcohol", emoji: "🍻", group: "ritual" },
    { id: "argument", label: "After argument", emoji: "💥", group: "emotional" },
    { id: "waking", label: "Morning / after waking", emoji: "🌅", group: "ritual" },
    { id: "sleep", label: "Before sleep", emoji: "🌙", group: "ritual" },
    { id: "habit", label: "Habit / automatic", emoji: "🔁", group: "automatic" },
    { id: "loneliness", label: "Loneliness", emoji: "🥀", group: "emotional" },
    { id: "other", label: "Other", emoji: "❓", group: "other" },
  ];
  const TRIGGER_BY_ID = Object.fromEntries(TRIGGERS.map((t) => [t.id, t]));
  const TRIGGER_GROUPS = ["automatic", "ritual", "emotional", "other"];

  const GROUP_INFO = {
    automatic: { label: "Automatic", desc: "Low-awareness, habit-based cigarettes — smoking on autopilot, out of boredom, or while scrolling your phone. Usually the easiest to cut first." },
    ritual: { label: "Ritual", desc: "Tied to routines like food, coffee, work breaks, waking up, or before sleep — cut these once automatic ones are down." },
    emotional: { label: "Emotional", desc: "Stress, panic, anger, sadness, arguments, or loneliness — keep these for later, and replace with coping actions." },
    other: { label: "Other", desc: "Doesn't fit a clear pattern yet — keep logging and a pattern will show up." },
  };

  function triggerGroup(triggerId) {
    const t = TRIGGER_BY_ID[triggerId];
    return t ? t.group : "other";
  }

  const COPING_SUGGESTIONS = {
    emotional: [
      "Drink a glass of water",
      "Step outside without smoking",
      "Slow breathing for 1 minute",
      "Walk for 5 minutes",
      "Hold something in your hand",
      "Write one sentence about what triggered this",
    ],
    automatic: [
      "Do a 5-minute task",
      "Take a short walk",
      "Chew gum",
      "Call or message someone",
      "Do something with your hands",
    ],
    ritual: [
      "Change location",
      "Brush your teeth",
      "Drink water",
      "Wait 10 minutes",
      "Use gum or mint",
    ],
    other: [
      "Notice what's going on right now",
      "Drink water",
      "Take a short walk",
      "Do something with your hands",
    ],
  };

  const NON_SHAMING_MESSAGES = {
    smoked: [
      "Logged. This is data, not failure.",
      "A slip does not restart your progress.",
      "Notice the trigger and continue.",
      "A logged cigarette is still progress because it gives you information.",
    ],
    resisted: [
      "Notice the trigger and continue.",
      "Logged. This is data, not failure.",
      "You're learning your pattern.",
    ],
    delayed: [
      "You delayed it — that still counts as progress.",
      "Notice the trigger and continue.",
      "You're learning your pattern.",
    ],
  };
  function nonShamingMessage(outcome) {
    const pool = NON_SHAMING_MESSAGES[outcome] || NON_SHAMING_MESSAGES.smoked;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /* ---------- log field helpers (read new + legacy field shapes transparently) ---------- */

  function getTriggerId(l) {
    return l.triggerId || l.trigger || null;
  }
  function getTriggerLabel(l) {
    if (l.triggerLabel) return l.triggerLabel;
    const id = getTriggerId(l);
    return id && TRIGGER_BY_ID[id] ? TRIGGER_BY_ID[id].label : null;
  }
  function getTriggerGroupOf(l) {
    if (l.triggerGroup) return l.triggerGroup;
    const id = getTriggerId(l);
    return id ? triggerGroup(id) : null;
  }
  function getIntensity(l) {
    if (typeof l.cravingIntensity === "number") return l.cravingIntensity;
    if (typeof l.intensity === "number") return l.intensity;
    return null;
  }

  const DELAY_OPTIONS = [
    { value: 0, label: "Smoked immediately" },
    { value: 5, label: "Delayed 5 min" },
    { value: 10, label: "Delayed 10 min" },
    { value: 20, label: "Delayed 20 min" },
  ];

  const DELAY_LENGTHS = [
    { value: 5, label: "5 min" },
    { value: 10, label: "10 min" },
    { value: 20, label: "20 min" },
  ];

  function makeLogId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function last7DaysLogs(logs) {
    const cutoff = Date.now() - 7 * DAY_MS;
    return logs.filter((l) => new Date(l.date).getTime() >= cutoff);
  }

  function prevWeekLogs(logs) {
    const cutoff2 = Date.now() - 14 * DAY_MS;
    const cutoff1 = Date.now() - 7 * DAY_MS;
    return logs.filter((l) => {
      const t = new Date(l.date).getTime();
      return t >= cutoff2 && t < cutoff1;
    });
  }

  function isDelayedOutcome(l) {
    return l.outcome === "delayed" || (l.outcome == null && !l.smoked && typeof l.delayMinutes === "number" && l.delayMinutes > 0);
  }

  /* returns { mostCommon: triggerId|null, counts: {id: count} } for smoked entries in a set of logs */
  function triggerCountsOf(entries) {
    const counts = {};
    entries.forEach((l) => {
      const id = getTriggerId(l);
      if (!id) return;
      counts[id] = (counts[id] || 0) + 1;
    });
    let mostCommon = null;
    let mostCommonCount = 0;
    Object.entries(counts).forEach(([id, count]) => {
      if (count > mostCommonCount) { mostCommonCount = count; mostCommon = id; }
    });
    return { mostCommon, counts };
  }

  function computeWeeklyAnalytics(logs) {
    const week = last7DaysLogs(logs);
    const prevWeek = prevWeekLogs(logs);
    const today = todayStr();
    const todayLogs = logs.filter((l) => toLocalDateStr(new Date(l.date)) === today);

    const smoked = week.filter((l) => l.smoked && getTriggerId(l));
    const resisted = week.filter((l) => !l.smoked);
    const delayed = week.filter(isDelayedOutcome);
    const smokedToday = todayLogs.filter((l) => l.smoked && getTriggerId(l));

    const intensityValues = week.filter((l) => typeof getIntensity(l) === "number").map((l) => getIntensity(l));
    const avgIntensity = intensityValues.length
      ? intensityValues.reduce((sum, n) => sum + n, 0) / intensityValues.length
      : null;

    const { mostCommon: mostCommonTrigger, counts: triggerCounts } = triggerCountsOf(smoked);
    const { mostCommon: mostCommonTriggerToday } = triggerCountsOf(smokedToday);

    const triggerIntensitySum = {};
    const triggerIntensityCount = {};
    smoked.forEach((l) => {
      const id = getTriggerId(l);
      const intensity = getIntensity(l);
      if (typeof intensity === "number") {
        triggerIntensitySum[id] = (triggerIntensitySum[id] || 0) + intensity;
        triggerIntensityCount[id] = (triggerIntensityCount[id] || 0) + 1;
      }
    });

    let strongestTrigger = null;
    let strongestAvg = -1;
    Object.keys(triggerIntensityCount).forEach((id) => {
      const avg = triggerIntensitySum[id] / triggerIntensityCount[id];
      if (avg > strongestAvg) { strongestAvg = avg; strongestTrigger = id; }
    });

    const delaysSmoked = smoked.filter((l) => typeof l.delayMinutes === "number");
    const avgDelay = delaysSmoked.length
      ? delaysSmoked.reduce((sum, l) => sum + l.delayMinutes, 0) / delaysSmoked.length
      : null;

    const automaticThisWeek = smoked.filter((l) => getTriggerGroupOf(l) === "automatic").length;
    const automaticPrevWeek = prevWeek.filter((l) => l.smoked && getTriggerId(l) && getTriggerGroupOf(l) === "automatic").length;
    const automaticReduced = automaticPrevWeek > 0 ? Math.max(automaticPrevWeek - automaticThisWeek, 0) : null;

    // best smoke-free window: bucket smoked cigs into 4 parts of day, find the quietest
    const buckets = [
      { label: "Night (12am–6am)", from: 0, to: 6, count: 0 },
      { label: "Morning (6am–12pm)", from: 6, to: 12, count: 0 },
      { label: "Afternoon (12pm–6pm)", from: 12, to: 18, count: 0 },
      { label: "Evening (6pm–12am)", from: 18, to: 24, count: 0 },
    ];
    smoked.forEach((l) => {
      const h = new Date(l.date).getHours();
      const b = buckets.find((b) => h >= b.from && h < b.to);
      if (b) b.count++;
    });
    const bestWindow = smoked.length ? buckets.reduce((a, b) => (b.count < a.count ? b : a)) : null;

    const groupCounts = { automatic: 0, ritual: 0, emotional: 0, other: 0 };
    smoked.forEach((l) => { groupCounts[getTriggerGroupOf(l)]++; });
    const groupTotal = smoked.length;

    // top triggers for the chart: top 4 individual triggers + a rolled-up "other triggers" bucket for the rest
    const sortedTriggers = Object.entries(triggerCounts).sort((a, b) => b[1] - a[1]);
    const total = smoked.length;
    const topN = sortedTriggers.slice(0, 4);
    const restCount = sortedTriggers.slice(4).reduce((s, [, c]) => s + c, 0);
    const triggerBreakdown = topN.map(([id, count]) => ({
      id, label: TRIGGER_BY_ID[id] ? TRIGGER_BY_ID[id].label : "Other", count, pct: total ? Math.round((count / total) * 100) : 0,
    }));
    if (restCount > 0) {
      triggerBreakdown.push({ id: "__rest__", label: "Other triggers", count: restCount, pct: total ? Math.round((restCount / total) * 100) : 0 });
    }

    return {
      totalSmoked: smoked.length,
      totalResisted: resisted.length,
      totalDelayed: delayed.length,
      avgIntensity,
      mostCommonTrigger,
      mostCommonTriggerToday,
      strongestTrigger,
      strongestAvg: strongestTrigger ? strongestAvg : null,
      avgDelay,
      automaticReduced,
      bestWindow,
      groupCounts,
      groupTotal,
      triggerBreakdown,
      hasData: smoked.length > 0 || resisted.length > 0 || delayed.length > 0,
    };
  }

  /* recommend which trigger group to focus reducing next, based on plan stage and logged data */
  function recommendedFocusGroup(state) {
    const today = todayStr();
    const isTapering = state.quitDate > today;
    const week = last7DaysLogs(state.logs).filter((l) => l.smoked && getTriggerId(l));
    const groupCounts = { automatic: 0, ritual: 0, emotional: 0, other: 0 };
    week.forEach((l) => groupCounts[getTriggerGroupOf(l)]++);

    if (!isTapering) return "emotional"; // post-quit: focus on replacing emotional smoking with coping

    const elapsedDays = Math.max(daysBetween(state.startDate, today), 0);
    const totalDays = Math.max(daysBetween(state.startDate, state.quitDate), 1);
    const progress = elapsedDays / totalDays;

    if (groupCounts.automatic > 0 && progress < 0.4) return "automatic";
    if (groupCounts.ritual > 0 && progress < 0.75) return "ritual";
    return "emotional";
  }

  const MILESTONES = [
    { hours: 0.33, label: "Heart rate and blood pressure begin to drop" },
    { hours: 12, label: "Carbon monoxide in your blood drops to normal" },
    { hours: 24, label: "Heart attack risk begins to decrease" },
    { hours: 48, label: "Nerve endings start to regrow; sense of smell and taste improve" },
    { hours: 72, label: "Nicotine fully out of your body; breathing feels easier" },
    { hours: 24 * 14, label: "Circulation and lung function improve" },
    { hours: 24 * 30, label: "Coughing and shortness of breath decrease" },
    { hours: 24 * 30 * 9, label: "Cilia regrow in lungs; less infection risk" },
    { hours: 24 * 365, label: "Risk of coronary heart disease is about half that of a smoker" },
    { hours: 24 * 365 * 5, label: "Stroke risk reduced to close to a non-smoker's" },
    { hours: 24 * 365 * 10, label: "Lung cancer death rate about half that of a smoker" },
    { hours: 24 * 365 * 15, label: "Risk of heart disease similar to a non-smoker's" },
  ];

  /* ---------- quick-log modal ---------- */

  const modalRoot = document.getElementById("modalRoot");

  function closeModal() {
    modalRoot.innerHTML = "";
  }

  function chipGrid(items, dataAttr) {
    return `<div class="chip-grid">${items.map((it) =>
      `<button class="chip" data-${dataAttr}="${it.value}">${it.emoji ? `<span class="chip-emoji">${it.emoji}</span>` : ""}${it.label}</button>`
    ).join("")}</div>`;
  }

  /* draft holds in-progress answers across the modal steps. kind: 'smoked' | 'resisted' | 'delayed' */
  function openQuickLog(kind) {
    const draft = { kind, trigger: null, intensity: null, delayMinutes: kind === "resisted" ? null : 0, smokedAfterDelay: null, note: "" };
    renderQuickLogStep(draft, "trigger");
  }

  const QUICK_LOG_TITLES = {
    smoked: "You smoked one",
    resisted: "You resisted a craving",
    delayed: "You delayed a craving",
  };

  function renderQuickLogStep(draft, step) {
    const title = QUICK_LOG_TITLES[draft.kind] || "Log this";
    let body = "";

    if (step === "trigger") {
      body = `
        <p class="lead">What's going on right now?</p>
        ${chipGrid(TRIGGERS.map((t) => ({ value: t.id, label: t.label, emoji: t.emoji })), "trigger")}
      `;
    } else if (step === "intensity") {
      body = `
        <p class="lead">How strong is/was the urge? (1 = mild, 10 = overwhelming)</p>
        <div class="chip-grid intensity-grid">
          ${Array.from({ length: 10 }, (_, i) => i + 1).map((n) =>
            `<button class="chip chip-num" data-intensity="${n}">${n}</button>`
          ).join("")}
        </div>
      `;
    } else if (step === "delay") {
      body = `
        <p class="lead">Did you delay at all before smoking?</p>
        ${chipGrid(DELAY_OPTIONS.map((d) => ({ value: d.value, label: d.label })), "delay")}
      `;
    } else if (step === "delayLength") {
      body = `
        <p class="lead">How long did you delay it?</p>
        ${chipGrid(DELAY_LENGTHS.map((d) => ({ value: d.value, label: d.label })), "delay")}
      `;
    } else if (step === "smokedAfter") {
      body = `
        <p class="lead">Did you end up smoking after delaying?</p>
        <div class="row">
          <button class="btn ghost" id="smokedAfterYes">Yes</button>
          <button class="btn primary" id="smokedAfterNo">No — it worked</button>
        </div>
      `;
    } else if (step === "note") {
      body = `
        <p class="lead">Anything worth noting? (optional)</p>
        <textarea class="note-input" id="quickLogNote" rows="2" placeholder="Optional note..."></textarea>
        <div class="row">
          <button class="btn ghost" id="skipNoteBtn">Skip</button>
          <button class="btn primary" id="saveNoteBtn">Save</button>
        </div>
      `;
    }

    modalRoot.innerHTML = `
      <div class="modal-overlay" id="modalOverlay">
        <div class="modal-card">
          <div class="modal-header">
            <h2>${title}</h2>
            <button class="modal-close" id="modalCloseBtn" aria-label="Close">&times;</button>
          </div>
          ${body}
        </div>
      </div>
    `;

    document.getElementById("modalCloseBtn").addEventListener("click", closeModal);
    document.getElementById("modalOverlay").addEventListener("click", (e) => {
      if (e.target.id === "modalOverlay") closeModal();
    });

    if (step === "trigger") {
      modalRoot.querySelectorAll("[data-trigger]").forEach((btn) => {
        btn.addEventListener("click", () => {
          draft.trigger = btn.dataset.trigger;
          renderQuickLogStep(draft, "intensity");
        });
      });
    } else if (step === "intensity") {
      modalRoot.querySelectorAll("[data-intensity]").forEach((btn) => {
        btn.addEventListener("click", () => {
          draft.intensity = Number(btn.dataset.intensity);
          if (draft.kind === "smoked") {
            renderQuickLogStep(draft, "delay");
          } else if (draft.kind === "delayed") {
            renderQuickLogStep(draft, "delayLength");
          } else {
            renderQuickLogStep(draft, "note");
          }
        });
      });
    } else if (step === "delay") {
      modalRoot.querySelectorAll("[data-delay]").forEach((btn) => {
        btn.addEventListener("click", () => {
          draft.delayMinutes = Number(btn.dataset.delay);
          renderQuickLogStep(draft, "note");
        });
      });
    } else if (step === "delayLength") {
      modalRoot.querySelectorAll("[data-delay]").forEach((btn) => {
        btn.addEventListener("click", () => {
          draft.delayMinutes = Number(btn.dataset.delay);
          renderQuickLogStep(draft, "smokedAfter");
        });
      });
    } else if (step === "smokedAfter") {
      document.getElementById("smokedAfterYes").addEventListener("click", () => {
        draft.smokedAfterDelay = true;
        renderQuickLogStep(draft, "note");
      });
      document.getElementById("smokedAfterNo").addEventListener("click", () => {
        draft.smokedAfterDelay = false;
        renderQuickLogStep(draft, "note");
      });
    } else if (step === "note") {
      document.getElementById("skipNoteBtn").addEventListener("click", () => finishQuickLog(draft, ""));
      document.getElementById("saveNoteBtn").addEventListener("click", () => {
        finishQuickLog(draft, document.getElementById("quickLogNote").value.trim());
      });
    }
  }

  function finishQuickLog(draft, note) {
    const smoked = draft.kind === "smoked" ? true : draft.kind === "delayed" ? !!draft.smokedAfterDelay : false;
    const entry = {
      id: makeLogId(),
      date: new Date().toISOString(),
      type: smoked ? "cigarette" : "resisted",
      outcome: draft.kind,
      smoked,
      triggerId: draft.trigger,
      triggerLabel: draft.trigger ? TRIGGER_BY_ID[draft.trigger].label : null,
      triggerGroup: draft.trigger ? triggerGroup(draft.trigger) : null,
      cravingIntensity: draft.intensity,
      delayMinutes: draft.kind === "resisted" ? null : draft.delayMinutes,
      note: note || "",
    };
    state.logs.push(entry);
    saveData(state);
    closeModal();
    renderDashboard();
    showPostLogMessage(entry);
  }

  function showPostLogMessage(entry) {
    const group = getTriggerGroupOf(entry);
    const message = nonShamingMessage(entry.outcome || (entry.smoked ? "smoked" : "resisted"));
    let suggestion = "";
    if (group && COPING_SUGGESTIONS[group]) {
      const tip = COPING_SUGGESTIONS[group][Math.floor(Math.random() * COPING_SUGGESTIONS[group].length)];
      suggestion = `Next time this trigger comes up, try: <strong>${tip}</strong>.`;
    }

    modalRoot.innerHTML = `
      <div class="modal-overlay" id="modalOverlay">
        <div class="modal-card toast-card">
          <p class="toast-message">${message}</p>
          ${suggestion ? `<p class="lead">${suggestion}</p>` : ""}
          <button class="btn primary" id="toastCloseBtn">Got it</button>
        </div>
      </div>
    `;
    document.getElementById("toastCloseBtn").addEventListener("click", closeModal);
    document.getElementById("modalOverlay").addEventListener("click", (e) => {
      if (e.target.id === "modalOverlay") closeModal();
    });
  }

  /* ---------- urge delay timer ---------- */

  function startUrgeDelay(minutes) {
    state.activeDelay = { startedAt: new Date().toISOString(), minutes, trigger: null };
    saveData(state);
    renderDashboard();
  }

  function cancelUrgeDelay() {
    state.activeDelay = null;
    saveData(state);
    renderDashboard();
  }

  function urgeDelayRemainingMs() {
    if (!state.activeDelay) return null;
    const elapsed = Date.now() - new Date(state.activeDelay.startedAt).getTime();
    return state.activeDelay.minutes * 60 * 1000 - elapsed;
  }

  function endUrgeDelayEarly(kind) {
    const elapsedMinutes = state.activeDelay
      ? Math.round((Date.now() - new Date(state.activeDelay.startedAt).getTime()) / 60000)
      : 0;
    state.activeDelay = null;
    saveData(state);
    openUrgeFollowUp(kind === "smoked", elapsedMinutes);
  }

  function openUrgeFollowUp(stillSmoked, elapsedMinutes) {
    renderUrgeFollowUpStep({ stillSmoked, elapsedMinutes, cravingReduced: null, trigger: null, intensity: null }, "reduced");
  }

  function renderUrgeFollowUpStep(draft, step) {
    let body = "";
    if (step === "reduced") {
      body = `
        <p class="lead">Did the craving reduce during the delay?</p>
        <div class="row">
          <button class="btn primary" id="reducedYes">Yes</button>
          <button class="btn ghost" id="reducedNo">No</button>
        </div>
      `;
    } else if (step === "trigger") {
      body = `
        <p class="lead">What triggered this urge?</p>
        ${chipGrid(TRIGGERS.map((t) => ({ value: t.id, label: t.label, emoji: t.emoji })), "trigger")}
      `;
    } else if (step === "helped") {
      const group = draft.trigger ? triggerGroup(draft.trigger) : "automatic";
      const tips = COPING_SUGGESTIONS[group] || [];
      body = `
        <p class="lead">What helped (optional)?</p>
        ${chipGrid(tips.map((t) => ({ value: t, label: t })), "help")}
        <div class="row"><button class="btn ghost" id="skipHelpBtn">Skip</button></div>
      `;
    }

    modalRoot.innerHTML = `
      <div class="modal-overlay" id="modalOverlay">
        <div class="modal-card">
          <div class="modal-header">
            <h2>${draft.stillSmoked ? "You smoked after delaying" : "You delayed the urge"}</h2>
            <button class="modal-close" id="modalCloseBtn" aria-label="Close">&times;</button>
          </div>
          ${body}
        </div>
      </div>
    `;
    document.getElementById("modalCloseBtn").addEventListener("click", () => finishUrgeFollowUp(draft));
    document.getElementById("modalOverlay").addEventListener("click", (e) => {
      if (e.target.id === "modalOverlay") finishUrgeFollowUp(draft);
    });

    if (step === "reduced") {
      document.getElementById("reducedYes").addEventListener("click", () => {
        draft.cravingReduced = true;
        renderUrgeFollowUpStep(draft, "trigger");
      });
      document.getElementById("reducedNo").addEventListener("click", () => {
        draft.cravingReduced = false;
        renderUrgeFollowUpStep(draft, "trigger");
      });
    } else if (step === "trigger") {
      modalRoot.querySelectorAll("[data-trigger]").forEach((btn) => {
        btn.addEventListener("click", () => {
          draft.trigger = btn.dataset.trigger;
          renderUrgeFollowUpStep(draft, "helped");
        });
      });
    } else if (step === "helped") {
      modalRoot.querySelectorAll("[data-help]").forEach((btn) => {
        btn.addEventListener("click", () => {
          draft.whatHelped = btn.dataset.help;
          finishUrgeFollowUp(draft);
        });
      });
      document.getElementById("skipHelpBtn").addEventListener("click", () => finishUrgeFollowUp(draft));
    }
  }

  function finishUrgeFollowUp(draft) {
    const entry = {
      id: makeLogId(),
      date: new Date().toISOString(),
      type: draft.stillSmoked ? "cigarette" : "resisted",
      outcome: "delayed",
      smoked: draft.stillSmoked,
      triggerId: draft.trigger,
      triggerLabel: draft.trigger ? TRIGGER_BY_ID[draft.trigger].label : null,
      triggerGroup: draft.trigger ? triggerGroup(draft.trigger) : null,
      cravingIntensity: draft.intensity,
      delayMinutes: draft.elapsedMinutes,
      note: draft.whatHelped ? `Helped: ${draft.whatHelped}` : "",
      cravingReduced: draft.cravingReduced,
    };
    state.logs.push(entry);
    saveData(state);
    closeModal();
    renderDashboard();
    showPostLogMessage(entry);
  }

  function tickUrgeDelay() {
    const el = document.getElementById("urgeDelayCountdown");
    if (!el || !state.activeDelay) return;
    const remaining = urgeDelayRemainingMs();
    if (remaining <= 0) {
      openUrgeFollowUp(false, state.activeDelay.minutes);
      state.activeDelay = null;
      saveData(state);
      return;
    }
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    el.textContent = `${mins}:${String(secs).padStart(2, "0")} remaining`;
  }
  setInterval(tickUrgeDelay, 1000);

  /* ---------- view management ---------- */

  const views = {
    onboarding: document.getElementById("view-onboarding"),
    dashboard: document.getElementById("view-dashboard"),
    info: document.getElementById("view-info"),
    settings: document.getElementById("view-settings"),
  };
  const navBtns = {
    dashboard: document.getElementById("navDashboard"),
    info: document.getElementById("navInfo"),
    settings: document.getElementById("navSettings"),
  };

  function showView(name) {
    Object.entries(views).forEach(([k, el]) => (el.hidden = k !== name));
    Object.entries(navBtns).forEach(([k, el]) => el.classList.toggle("active", k === name));
    if (name === "dashboard") renderDashboard();
  }

  Object.entries(navBtns).forEach(([name, btn]) => {
    btn.addEventListener("click", () => showView(name));
  });

  /* ---------- onboarding wizard ---------- */

  const wizard = document.getElementById("wizard");
  let smokerType = null;
  let quitMode = null;
  let stepStack = ["0"];

  function goToStep(stepId) {
    wizard.querySelectorAll(".step").forEach((s) => (s.hidden = s.dataset.step !== stepId));
  }

  function currentStepId() {
    return stepStack[stepStack.length - 1];
  }

  wizard.addEventListener("click", (e) => {
    const nextBtn = e.target.closest("[data-next]");
    const backBtn = e.target.closest("[data-back]");
    const typeBtn = e.target.closest("[data-type]");
    const quitModeBtn = e.target.closest("[data-quitmode]");

    if (typeBtn) {
      smokerType = typeBtn.dataset.type;
      wizard.querySelectorAll("[data-type]").forEach((b) => b.classList.toggle("selected", b === typeBtn));
      stepStack.push("2-" + smokerType);
      goToStep(currentStepId());
      return;
    }

    if (quitModeBtn) {
      quitMode = quitModeBtn.dataset.quitmode;
      wizard.querySelectorAll("[data-quitmode]").forEach((b) => b.classList.toggle("selected", b === quitModeBtn));
      const dateField = document.getElementById("quitDateField");
      const finishBtn = document.getElementById("finishOnboarding");
      if (quitMode === "future") {
        dateField.hidden = false;
        const dInput = document.getElementById("quitDateInput");
        const min = toLocalDateStr(new Date(Date.now() + DAY_MS));
        dInput.min = min;
        if (!dInput.value) dInput.value = min;
      } else {
        dateField.hidden = true;
      }
      finishBtn.hidden = false;
      return;
    }

    if (nextBtn) {
      const id = currentStepId();
      if (id === "0") stepStack.push("1");
      else if (id === "1") return; // handled by typeBtn
      else if (id.startsWith("2-")) stepStack.push("3");
      else if (id === "3") stepStack.push("4");
      goToStep(currentStepId());
      return;
    }

    if (backBtn) {
      if (stepStack.length > 1) stepStack.pop();
      goToStep(currentStepId());
      return;
    }
  });

  document.getElementById("finishOnboarding").addEventListener("click", () => {
    const profile = { type: smokerType };

    if (smokerType === "cigarette") {
      profile.cigPerDay = Number(document.getElementById("cigPerDay").value) || 1;
      profile.cigPerPack = Number(document.getElementById("cigPerPack").value) || 20;
      profile.cigPackCost = Number(document.getElementById("cigPackCost").value) || 0;
    } else {
      profile.hrPerDay = Number(document.getElementById("hrPerDay").value) || 1;
      profile.hrGramsPerCig = Number(document.getElementById("hrGramsPerCig").value) || 0.7;
      profile.hrPouchSize = Number(document.getElementById("hrPouchSize").value) || 30;
      profile.hrPouchCost = Number(document.getElementById("hrPouchCost").value) || 0;
    }
    profile.yearsSmoking = Number(document.getElementById("yearsSmoking").value) || 0;

    const today = todayStr();
    const quitDate = quitMode === "today" ? today : document.getElementById("quitDateInput").value;
    const { cigsPerDay } = derivedProfile(profile);

    const schedule = quitDate > today ? buildTaperSchedule(cigsPerDay, today, quitDate) : null;

    state = {
      profile,
      startDate: today,
      quitDate,
      schedule,
      logs: [], // { date, type: 'craving'|'slip'|'resisted' }
    };
    saveData(state);
    showView("dashboard");
  });

  /* ---------- dashboard ---------- */

  function renderDashboard() {
    const el = document.getElementById("dashboardContent");
    if (!state) {
      showView("onboarding");
      return;
    }

    const { profile, startDate, quitDate, logs } = state;
    const { cigsPerDay, costPerCig } = derivedProfile(profile);
    const today = todayStr();
    const isTapering = quitDate > today;
    const daysSinceQuit = Math.max(daysBetween(quitDate, today), 0);
    const hoursSinceQuit = isTapering ? 0 : daysSinceQuit * 24 + (new Date().getHours());

    const isCigLog = (l) => l.type === "cigarette" || l.type === "slip";
    const cigsLoggedToday = logs.filter((l) => isCigLog(l) && toLocalDateStr(new Date(l.date)) === today).length;
    const quitDateStart = new Date(quitDate + "T00:00:00");
    const cigsLoggedSinceQuit = logs.filter((l) => isCigLog(l) && new Date(l.date) >= quitDateStart).length;

    const analytics = computeWeeklyAnalytics(logs);
    const focusGroup = recommendedFocusGroup(state);

    let html = "";

    html += `
      <div class="card quote-card">
        <div class="quote-text" id="quoteText">"${quoteOfTheDay()}"</div>
        <button class="btn ghost quote-btn" id="newQuoteBtn">New quote</button>
      </div>
    `;

    if (isTapering) {
      const daysToGo = daysBetween(today, quitDate);
      const todayEntry = (state.schedule || []).find((s) => s.date === today) ||
        state.schedule[state.schedule.length - 1];
      const baseline = cigsPerDay;
      const target = todayEntry ? todayEntry.target : 0;
      const reducedSoFar = Math.max(baseline - target, 0);
      const totalDays = state.schedule.length - 1;
      const elapsedDays = Math.min(daysBetween(startDate, today), totalDays);
      const pct = totalDays > 0 ? Math.round((elapsedDays / totalDays) * 100) : 100;

      html += `
        <div class="card">
          <span class="badge">Taper plan</span>
          <h1>${daysToGo} day${daysToGo === 1 ? "" : "s"} until your quit date</h1>
          <p class="lead">Quit date: <strong>${quitDate}</strong>. Today's target: cut down to <strong>${target}</strong> (from a baseline of ${baseline}).</p>
          <div class="progress-bar"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
          <p class="lead" style="margin-top:4px">${pct}% of the way through your step-down plan.</p>
          ${focusGroupCard(focusGroup)}
        </div>

        ${urgeDelayCard()}

        <div class="card">
          <h2>Log what you smoke</h2>
          <p class="lead">Every cigarette counts toward today's tally, whether you're on target or not — logging honestly is what makes the plan work.</p>
          <div class="today-tally ${cigsLoggedToday > target ? "over" : ""}">
            <span class="tally-count">${cigsLoggedToday}</span>
            <span class="tally-of">of ${target} target today</span>
          </div>
          <div class="craving-actions">
            <button class="btn primary" id="logCigarette">Log smoke 🚬</button>
            <button class="btn ghost" id="logCraving">Log resisted craving 💪</button>
          </div>
          <button class="btn ghost delay-btn" id="logDelayed">Log delayed craving ⏳</button>
          <button class="btn ghost delay-btn" id="startDelayBtn">Start 10-min delay ▶</button>
          <div class="log-list" id="recentLogs"></div>
        </div>

        ${analyticsCard(analytics)}

        <div class="card">
          <h2>Your step-down schedule</h2>
          <table class="taper-table">
            <thead><tr><th>Date</th><th>Target / day</th></tr></thead>
            <tbody>
              ${state.schedule.map((s) => {
                const rowClass = s.date === today ? "today-row" : (s.date < today ? "past-row" : "");
                return `<tr class="${rowClass}"><td>${s.date}</td><td>${s.target}</td></tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>
      `;
    } else {
      const cigsAvoided = Math.max(daysSinceQuit * cigsPerDay - cigsLoggedSinceQuit, 0);
      const moneySaved = cigsAvoided * costPerCig;
      const minutesSaved = cigsAvoided * 6; // ~6 min per cigarette incl. breaks
      const hoursSaved = minutesSaved / 60;

      html += `
        <div class="card">
          <span class="badge">Smoke-free</span>
          <h1>${daysSinceQuit} day${daysSinceQuit === 1 ? "" : "s"} smoke-free</h1>
          <p class="lead">Since ${quitDate}. Every day compounds — keep going.</p>
          <div class="stat-grid">
            <div class="stat"><div class="value success-value">${fmtMoney(moneySaved)}</div><div class="label">Money saved</div></div>
            <div class="stat"><div class="value">${fmtNum(cigsAvoided)}</div><div class="label">Cigarettes avoided</div></div>
            <div class="stat"><div class="value">${fmtNum(hoursSaved)}</div><div class="label">Hours reclaimed</div></div>
            <div class="stat"><div class="value">${daysSinceQuit}</div><div class="label">Days smoke-free</div></div>
          </div>
          ${cigsLoggedSinceQuit > 0 ? `<p class="lead" style="margin:12px 0 0">You've logged ${cigsLoggedSinceQuit} cigarette${cigsLoggedSinceQuit === 1 ? "" : "s"} since your quit date. That's not a restart — keep logging honestly and keep going.</p>` : ""}
          ${focusGroupCard(focusGroup)}
        </div>

        ${urgeDelayCard()}

        <div class="card">
          <h2>How you're feeling right now</h2>
          <div class="today-tally ${cigsLoggedToday > 0 ? "over" : ""}">
            <span class="tally-count">${cigsLoggedToday}</span>
            <span class="tally-of">smoked today</span>
          </div>
          <div class="craving-actions">
            <button class="btn primary" id="logCraving">Log resisted craving 💪</button>
            <button class="btn ghost" id="logCigarette">Log smoke 🚬</button>
          </div>
          <button class="btn ghost delay-btn" id="logDelayed">Log delayed craving ⏳</button>
          <button class="btn ghost delay-btn" id="startDelayBtn">Start 10-min delay ▶</button>
          <div class="log-list" id="recentLogs"></div>
        </div>

        ${analyticsCard(analytics)}

        <div class="card">
          <h2>Health recovery milestones</h2>
          <ul class="milestone-list">
            ${MILESTONES.map((m) => {
              const done = hoursSinceQuit >= m.hours;
              return `<li class="${done ? "done" : ""}">
                <span class="milestone-check">${done ? "✓" : ""}</span>
                <span class="milestone-time">${milestoneTimeLabel(m.hours)}</span>
                <span class="milestone-label">${m.label}</span>
              </li>`;
            }).join("")}
          </ul>
        </div>
      `;
    }

    el.innerHTML = html;

    const newQuoteBtn = document.getElementById("newQuoteBtn");
    if (newQuoteBtn) {
      newQuoteBtn.addEventListener("click", () => {
        const quoteText = document.getElementById("quoteText");
        quoteText.textContent = `"${randomQuote(quoteText.textContent)}"`;
      });
    }

    const cravingBtn = document.getElementById("logCraving");
    const cigaretteBtn = document.getElementById("logCigarette");
    const delayedBtn = document.getElementById("logDelayed");
    if (cravingBtn) cravingBtn.addEventListener("click", () => openQuickLog("resisted"));
    if (cigaretteBtn) cigaretteBtn.addEventListener("click", () => openQuickLog("smoked"));
    if (delayedBtn) delayedBtn.addEventListener("click", () => openQuickLog("delayed"));

    const startDelayBtn = document.getElementById("startDelayBtn");
    if (startDelayBtn) startDelayBtn.addEventListener("click", () => startUrgeDelay(10));

    const smokedAnywayBtn = document.getElementById("delaySmokedBtn");
    if (smokedAnywayBtn) smokedAnywayBtn.addEventListener("click", () => endUrgeDelayEarly("smoked"));
    const cravingPassedBtn = document.getElementById("delayResistedBtn");
    if (cravingPassedBtn) cravingPassedBtn.addEventListener("click", () => endUrgeDelayEarly("resisted"));
    const cancelDelayBtn = document.getElementById("cancelDelayBtn");
    if (cancelDelayBtn) cancelDelayBtn.addEventListener("click", cancelUrgeDelay);

    renderRecentLogs();
  }

  function urgeDelayCard() {
    if (!state.activeDelay) return "";
    return `
      <div class="card delay-banner">
        <h2>⏳ Delaying the urge</h2>
        <p class="lead" id="urgeDelayCountdown">Calculating…</p>
        <div class="row">
          <button class="btn primary" id="delayResistedBtn">Craving passed 🎉</button>
          <button class="btn ghost" id="delaySmokedBtn">I smoked anyway</button>
        </div>
        <button class="btn ghost" id="cancelDelayBtn" style="margin-top:8px">Cancel</button>
      </div>
    `;
  }

  function focusGroupCard(group) {
    const info = GROUP_INFO[group];
    if (!info) return "";
    return `
      <div class="focus-note">
        <span class="focus-label">Focus next: ${info.label} cigarettes</span>
        <p class="lead" style="margin:4px 0 0">${info.desc}</p>
      </div>
    `;
  }

  /* non-shaming coaching line, stable for the day so it doesn't flicker between re-renders */
  function patternMessage(a) {
    const base = NON_SHAMING_MESSAGES.smoked[dayOfYear(new Date()) % NON_SHAMING_MESSAGES.smoked.length];
    if (!a.groupTotal) return base;

    let dominant = null;
    let max = 0;
    TRIGGER_GROUPS.forEach((g) => {
      if (a.groupCounts[g] > max) { max = a.groupCounts[g]; dominant = g; }
    });
    if (!dominant) return base;

    if (dominant === "emotional") {
      const label = a.mostCommonTrigger && TRIGGER_BY_ID[a.mostCommonTrigger] ? TRIGGER_BY_ID[a.mostCommonTrigger].label.toLowerCase() : "emotional";
      return `Most of your cigarettes this week were ${label}-related. Don't attack these first — start by reducing automatic cigarettes and use delay/coping tools for ${label} smokes. ${base}`;
    }
    if (dominant === "automatic") {
      return `Most of your cigarettes this week were automatic — good news, these are usually the easiest to cut first. ${base}`;
    }
    if (dominant === "ritual") {
      return `Most of your cigarettes this week were tied to routines like meals, coffee, or breaks. Once automatic ones are down, these are next. ${base}`;
    }
    return base;
  }

  function analyticsCard(a) {
    if (!a.hasData) return "";
    const groupRows = TRIGGER_GROUPS.map((g) => {
      const count = a.groupCounts[g];
      const pct = a.groupTotal ? Math.round((count / a.groupTotal) * 100) : 0;
      return { g, count, pct };
    });

    return `
      <div class="card">
        <h2>Your smoking patterns</h2>
        <p class="lead">${patternMessage(a)}</p>
        <div class="insight-grid">
          <div class="insight"><div class="insight-value">${a.mostCommonTriggerToday ? TRIGGER_BY_ID[a.mostCommonTriggerToday].label : "—"}</div><div class="insight-label">Top trigger today</div></div>
          <div class="insight"><div class="insight-value">${a.mostCommonTrigger ? TRIGGER_BY_ID[a.mostCommonTrigger].label : "—"}</div><div class="insight-label">Top trigger this week</div></div>
          <div class="insight"><div class="insight-value">${a.strongestTrigger ? TRIGGER_BY_ID[a.strongestTrigger].label : "—"}</div><div class="insight-label">Strongest craving trigger</div></div>
          <div class="insight"><div class="insight-value">${a.groupCounts.emotional}</div><div class="insight-label">Emotional cigarettes</div></div>
          <div class="insight"><div class="insight-value">${a.groupCounts.ritual}</div><div class="insight-label">Ritual cigarettes</div></div>
          <div class="insight"><div class="insight-value">${a.groupCounts.automatic}</div><div class="insight-label">Automatic cigarettes</div></div>
          <div class="insight"><div class="insight-value">${a.totalResisted}</div><div class="insight-label">Cravings resisted</div></div>
          <div class="insight"><div class="insight-value">${a.totalDelayed}</div><div class="insight-label">Cravings delayed</div></div>
          <div class="insight"><div class="insight-value">${a.avgIntensity !== null ? a.avgIntensity.toFixed(1) + "/10" : "—"}</div><div class="insight-label">Average craving intensity</div></div>
          <div class="insight"><div class="insight-value">${a.avgDelay !== null ? Math.round(a.avgDelay) + " min" : "—"}</div><div class="insight-label">Avg. delay before smoking</div></div>
          <div class="insight"><div class="insight-value">${a.automaticReduced !== null ? a.automaticReduced : "—"}</div><div class="insight-label">Automatic cigs reduced vs last week</div></div>
          <div class="insight"><div class="insight-value">${a.bestWindow ? a.bestWindow.label : "—"}</div><div class="insight-label">Best smoke-free window</div></div>
        </div>

        ${a.triggerBreakdown.length ? `
          <h2 style="margin-top:20px">Your top smoking triggers this week</h2>
          <div class="trigger-bars">
            ${a.triggerBreakdown.map((tb, i) => `
                <div class="trigger-bar-row">
                  <span class="trigger-bar-label">${tb.label}</span>
                  <div class="trigger-bar-track"><div class="trigger-bar-fill series-${i + 1}" style="width:${tb.pct}%"></div></div>
                  <span class="trigger-bar-pct">${tb.pct}%</span>
                </div>
              `).join("")}
          </div>
        ` : ""}

        ${a.groupTotal ? `
          <h2 style="margin-top:20px">Progress by cigarette type</h2>
          <div class="group-bar">
            ${groupRows.map((r) => r.pct > 0 ? `<div class="group-bar-seg group-${r.g}" style="width:${r.pct}%" title="${GROUP_INFO[r.g].label}: ${r.pct}%"></div>` : "").join("")}
          </div>
          <div class="group-legend">
            ${groupRows.filter((r) => r.count > 0).map((r) => `<span class="group-legend-item"><span class="group-swatch group-${r.g}"></span>${GROUP_INFO[r.g].label} ${r.pct}%</span>`).join("")}
          </div>
        ` : ""}
      </div>
    `;
  }

  function milestoneTimeLabel(hours) {
    if (hours < 1) return Math.round(hours * 60) + " min";
    if (hours < 24) return Math.round(hours) + " hr";
    if (hours < 24 * 30) return Math.round(hours / 24) + " days";
    if (hours < 24 * 365) return Math.round(hours / (24 * 30)) + " mo";
    return Math.round(hours / (24 * 365)) + " yr";
  }

  const RECENT_LOG_VERBS = {
    smoked: "🚬 Smoked",
    resisted: "💪 Resisted",
    delayed: "⏳ Delayed",
  };

  function renderRecentLogs() {
    const box = document.getElementById("recentLogs");
    if (!box || !state.logs.length) return;
    const recent = state.logs.slice(-5).reverse();
    box.innerHTML = "Recent: " + recent.map((l) => {
      const t = new Date(l.date);
      const outcome = l.outcome || (l.smoked ? "smoked" : "resisted");
      const verb = RECENT_LOG_VERBS[outcome] || (l.smoked ? RECENT_LOG_VERBS.smoked : RECENT_LOG_VERBS.resisted);
      const triggerLabel = getTriggerLabel(l);
      const intensity = getIntensity(l);
      const parts = [verb];
      if (triggerLabel) parts.push(triggerLabel);
      if (typeof intensity === "number") parts.push(`intensity ${intensity}/10`);
      parts.push(t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      return parts.join(" — ");
    }).join(" · ");
  }

  /* ---------- reminders ---------- */

  function reminderSettings() {
    if (!state) return null;
    if (!state.reminder) state.reminder = { enabled: false, time: "09:00", lastSentDate: null };
    return state.reminder;
  }

  function renderReminderStatus() {
    const statusEl = document.getElementById("reminderStatus");
    if (!statusEl) return;
    const r = reminderSettings();
    if (!r) return;
    const timeInput = document.getElementById("reminderTime");
    timeInput.value = r.time;
    if (!("Notification" in window)) {
      statusEl.textContent = "This browser doesn't support notifications.";
    } else if (r.enabled && Notification.permission === "granted") {
      statusEl.textContent = `On — you'll get a reminder around ${r.time} each day this app is open.`;
    } else if (r.enabled && Notification.permission === "denied") {
      statusEl.textContent = "Notifications are blocked in your browser settings — enable them for this site to receive reminders.";
    } else {
      statusEl.textContent = "Off.";
    }
  }

  function checkReminderDue() {
    if (!state) return;
    const r = reminderSettings();
    if (!r || !r.enabled) return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    const now = new Date();
    const today = todayStr();
    if (r.lastSentDate === today) return;

    const [h, m] = r.time.split(":").map(Number);
    const target = new Date(now);
    target.setHours(h, m, 0, 0);
    if (now < target) return;

    const quitDate = state.quitDate;
    const isTapering = quitDate > today;
    let body;
    if (isTapering) {
      const daysToGo = daysBetween(today, quitDate);
      body = `${daysToGo} day${daysToGo === 1 ? "" : "s"} until your quit date. ${quoteOfTheDay()}`;
    } else {
      const daysSinceQuit = Math.max(daysBetween(quitDate, today), 0);
      body = `${daysSinceQuit} day${daysSinceQuit === 1 ? "" : "s"} smoke-free. ${quoteOfTheDay()}`;
    }

    try {
      new Notification("QuitPath", { body, icon: undefined, tag: "quitpath-daily" });
    } catch (e) {
      /* Notification constructor can throw on some mobile browsers; ignore */
    }

    r.lastSentDate = today;
    saveData(state);
  }

  setInterval(checkReminderDue, 60 * 1000);
  checkReminderDue();

  document.getElementById("enableReminderBtn").addEventListener("click", () => {
    if (!state) return;
    const r = reminderSettings();
    r.time = document.getElementById("reminderTime").value || "09:00";
    if (!("Notification" in window)) {
      renderReminderStatus();
      return;
    }
    Notification.requestPermission().then((perm) => {
      r.enabled = perm === "granted";
      saveData(state);
      renderReminderStatus();
      checkReminderDue();
    });
  });

  document.getElementById("disableReminderBtn").addEventListener("click", () => {
    if (!state) return;
    const r = reminderSettings();
    r.enabled = false;
    saveData(state);
    renderReminderStatus();
  });

  navBtns.settings.addEventListener("click", renderReminderStatus);

  /* ---------- settings ---------- */

  document.getElementById("resetBtn").addEventListener("click", () => {
    if (confirm("This clears all your saved progress on this device. Continue?")) {
      localStorage.removeItem(STORAGE_KEY);
      state = null;
      location.reload();
    }
  });

  document.getElementById("editProfileBtn").addEventListener("click", () => {
    if (confirm("This will restart the setup wizard. Your history of logs will be kept, but the plan will be recalculated. Continue?")) {
      showView("onboarding");
      stepStack = ["0"];
      goToStep("0");
    }
  });

  /* ---------- service worker ---------- */

  function showUpdateBanner() {
    if (document.getElementById("swUpdateBanner")) return;
    const banner = document.createElement("div");
    banner.id = "swUpdateBanner";
    banner.className = "update-banner";
    banner.innerHTML = `
      <span>New version available</span>
      <button class="btn primary" id="swReloadBtn">Reload</button>
    `;
    document.body.appendChild(banner);
    document.getElementById("swReloadBtn").addEventListener("click", () => location.reload());
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").then((reg) => {
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          // If something is already controlling this page when the new worker is found, this is
          // a genuine update to an existing install — not the very first ever service-worker install.
          const isRealUpdate = !!navigator.serviceWorker.controller;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "activated" && isRealUpdate) showUpdateBanner();
          });
        });
      }).catch(() => {});
    });
  }

  /* ---------- boot ---------- */

  if (state && state.profile) {
    showView("dashboard");
  } else {
    showView("onboarding");
  }
})();
