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
        </div>

        <div class="card">
          <h2>Log what you smoke</h2>
          <p class="lead">Every cigarette counts toward today's tally, whether you're on target or not — logging honestly is what makes the plan work.</p>
          <div class="today-tally ${cigsLoggedToday > target ? "over" : ""}">
            <span class="tally-count">${cigsLoggedToday}</span>
            <span class="tally-of">of ${target} target today</span>
          </div>
          <div class="craving-actions">
            <button class="btn primary" id="logCigarette">I smoked one 🚬</button>
            <button class="btn ghost" id="logCraving">I had a craving — resisted 💪</button>
          </div>
          <div class="log-list" id="recentLogs"></div>
        </div>

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
        </div>

        <div class="card">
          <h2>How you're feeling right now</h2>
          <div class="today-tally ${cigsLoggedToday > 0 ? "over" : ""}">
            <span class="tally-count">${cigsLoggedToday}</span>
            <span class="tally-of">smoked today</span>
          </div>
          <div class="craving-actions">
            <button class="btn primary" id="logCraving">I had a craving — resisted 💪</button>
            <button class="btn ghost" id="logCigarette">I smoked one</button>
          </div>
          <div class="log-list" id="recentLogs"></div>
        </div>

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
    if (cravingBtn) {
      cravingBtn.addEventListener("click", () => {
        state.logs.push({ date: new Date().toISOString(), type: "resisted" });
        saveData(state);
        renderDashboard();
      });
    }
    if (cigaretteBtn) {
      cigaretteBtn.addEventListener("click", () => {
        state.logs.push({ date: new Date().toISOString(), type: "cigarette" });
        saveData(state);
        renderDashboard();
      });
    }
    renderRecentLogs();
  }

  function milestoneTimeLabel(hours) {
    if (hours < 1) return Math.round(hours * 60) + " min";
    if (hours < 24) return Math.round(hours) + " hr";
    if (hours < 24 * 30) return Math.round(hours / 24) + " days";
    if (hours < 24 * 365) return Math.round(hours / (24 * 30)) + " mo";
    return Math.round(hours / (24 * 365)) + " yr";
  }

  function renderRecentLogs() {
    const box = document.getElementById("recentLogs");
    if (!box || !state.logs.length) return;
    const recent = state.logs.slice(-5).reverse();
    box.innerHTML = "Recent: " + recent.map((l) => {
      const t = new Date(l.date);
      const label = (l.type === "cigarette" || l.type === "slip") ? "smoked one" : "resisted a craving";
      return `${label} at ${t.toLocaleString()}`;
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

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }

  /* ---------- boot ---------- */

  if (state && state.profile) {
    showView("dashboard");
  } else {
    showView("onboarding");
  }
})();
