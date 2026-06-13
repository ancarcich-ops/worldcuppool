/* World Cup Pool dashboard UI */
(() => {
  if (typeof TEAMS === "undefined" || typeof POOL === "undefined" || typeof PoolEngine === "undefined") {
    const b = document.getElementById("banners");
    if (b) b.innerHTML = '<div class="banner">⚠️ Data failed to load. Hard refresh (Ctrl/Cmd+Shift+R) to retry.</div>';
    return;
  }
  const REFRESH_MS = 120_000;
  const $ = (sel, el = document) => el.querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let live = { updatedAt: null, source: "seed", matches: [] };
  let overrides = { matches: [], groupOrder: {} };
  let state = null;
  let firstRender = true;
  let confettiFired = false;

  // ── full-time announcer state ───────────────────────────────────
  const SEEN_KEY = "wc26-seen-results";
  let seenResults = loadSeen();
  let ftQueue = [];
  let ftPlaying = false;
  function loadSeen() { try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY)) || []); } catch { return new Set(); } }
  function saveSeen() { try { localStorage.setItem(SEEN_KEY, JSON.stringify([...seenResults])); } catch {} }

  const rand = (arr) => arr[(Math.random() * arr.length) | 0];
  const WIN_LINES = [
    "absolutely demolished", "put on a clinic against", "sent {loser} home crying past",
    "bullied", "made a mockery of", "ran riot over", "left skid marks on",
    "danced all over", "took the lunch money of", "dismantled", "curb-stomped",
    "turned {loser} into a traffic cone against", "treated {loser} like a training drill in",
    "speedran", "made {loser} file a police report after",
  ];
  const WIN_PRAISE = [
    "Pure class. {wOwner} is eating like a king tonight. 👑🍖",
    "Somebody do a welfare check on {lOwner} — that was a public execution. 💀",
    "{winner} look like they actually want this. {wOwner} is insufferable now. 😎",
    "Frame it, hang it, charge admission. {wOwner} owns this league. 🖼️",
    "{wOwner} banked the points AND your dignity. Venmo request incoming. 💸",
    "That's a statement. The rest of the group chat just went quiet. 🔇",
    "{wOwner}'s phone is already typing the trash talk. Brace yourselves. 📲",
    "Clinical. {winner} didn't come to play, they came to humiliate. 🔪",
  ];
  const LOSE_ROAST = [
    "{loser} showed up in body, not in spirit. {lOwner}, no refunds. 🧾",
    "{loser} defended like a screen door on a submarine. 🚪🌊",
    "Start packing, {lOwner} — {loser} won't need cleats where they're going. 🧳",
    "That wasn't a game plan, it was a hostage video from {loser}. 📼",
    "{lOwner} drafted {loser} and somehow finished with less than zero. 🥲",
    "{loser} treated the ball like it had a restraining order. ⚽🚫",
    "Quietly, {lOwner} is leaving the group chat and changing their name. 📵",
    "{loser} brought a spoon to a gunfight. {lOwner} brought the spoon. 🥄",
    "{loser} played 90 minutes of 'after you, no after you.' Embarrassing. 🙇",
    "{lOwner}, that wasn't a loss, that was a crime scene. Tape it off. 🚧",
    "{loser} got their pockets picked in front of the whole world. 👖💨",
  ];
  const DRAW_JOKES = [
    "A draw. It's like kissing your hot half-sister — technically something happened, but nobody's proud of it. 💋",
    "Stalemate. Like kissing your hot half-sister: a little exciting, deeply wrong, zero bragging rights. 😳",
    "Honors even — the footballing equivalent of kissing your hot half-sister. Felt good, can't tell anyone. 🤐",
    "Nobody wins. Like making out with your hot half-sister: you'll think about it, you'll never speak of it. 🫣",
    "A point each. Like your hot half-sister: thrilling for a second, then a lifetime of 'why did I do that.' 😬",
  ];

  function commentaryFor(m) {
    const draw = m.homeScore === m.awayScore && !m.winner;
    if (draw) {
      return { kind: "draw", joke: rand(DRAW_JOKES) };
    }
    const winner = m.winner || (m.homeScore > m.awayScore ? m.home : m.away);
    const loser = winner === m.home ? m.away : m.home;
    const fill = (s) => s
      .replaceAll("{winner}", teamName(winner)).replaceAll("{loser}", teamName(loser))
      .replaceAll("{wOwner}", state.owners[winner] || "Nobody").replaceAll("{lOwner}", state.owners[loser] || "Nobody");
    return {
      kind: "result", winner, loser,
      headline: `${teamName(winner)} ${fill(rand(WIN_LINES))} ${teamName(loser)}`,
      praise: fill(rand(WIN_PRAISE)),
      roast: fill(rand(LOSE_ROAST)),
    };
  }

  // ── helpers ─────────────────────────────────────────────────────
  const flag = (code, size = "w80") => {
    const t = TEAMS[code];
    if (!t) return `<span class="flag flag-unknown">?</span>`;
    return `<img class="flag" loading="lazy" src="https://flagcdn.com/${size}/${t.iso}.png"
      srcset="https://flagcdn.com/${size === "w80" ? "w160" : "w320"}/${t.iso}.png 2x"
      alt="${esc(t.name)} flag">`;
  };
  const teamName = (code) => TEAMS[code]?.name || code;
  const grad = (code, deg = 135) => {
    const c = TEAMS[code]?.colors || ["#444", "#222"];
    return `linear-gradient(${deg}deg, ${c[0]}, ${c[1]})`;
  };
  const ordinal = (n) => n + (["th", "st", "nd", "rd"][(n % 100 > 10 && n % 100 < 14) ? 0 : Math.min(n % 10, 4)] || "th");
  const fmtDate = (iso) => {
    if (!iso) return "TBD";
    const d = new Date(iso);
    return d.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  };

  function statusBadge(t) {
    if (t.status === "champion") return `<span class="badge badge-champ">🏆 Champions</span>`;
    if (t.status === "out") return `<span class="badge badge-out">${esc(t.statusLabel)}</span>`;
    return `<span class="badge badge-alive">${esc(t.statusLabel)}</span>`;
  }

  // ── data loading ────────────────────────────────────────────────
  async function loadJSON(path) {
    const res = await fetch(`${path}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`${path}: ${res.status}`);
    return res.json();
  }

  async function refresh(initial = false) {
    try {
      const [liveData, ovData] = await Promise.all([
        loadJSON("data/live.json"),
        loadJSON("data/overrides.json").catch(() => overrides),
      ]);
      live = liveData;
      overrides = ovData;
    } catch (e) {
      if (initial) console.warn("Live data unavailable (file:// mode?) — rendering with seed data.", e);
    }
    recompute();
    renderAll(initial);
  }

  function recompute() {
    state = PoolEngine.compute({
      teams: TEAMS, groups: GROUPS, matches: live.matches || [],
      scoring: SCORING, pool: POOL, overrides,
    });
  }

  // ── validation banner ───────────────────────────────────────────
  function validatePool() {
    const seen = new Map(), problems = [];
    for (const p of POOL.players) {
      for (const code of p.teams) {
        if (!TEAMS[code]) problems.push(`Unknown team code "${code}" (${p.name})`);
        else if (seen.has(code)) problems.push(`${teamName(code)} picked by both ${seen.get(code)} and ${p.name}`);
        seen.set(code, p.name);
      }
    }
    // Only flag unowned teams as a problem when the pool expects everyone covered.
    // Pools with fewer players than fit 48 teams (e.g. 10×4) leave leftovers on purpose.
    if (!POOL.settings.allowUnowned) {
      const unowned = Object.keys(TEAMS).filter((c) => !seen.has(c));
      if (unowned.length && unowned.length < 48) problems.push(`Unowned teams: ${unowned.map(teamName).join(", ")}`);
    }
    return problems;
  }

  // ── leaderboard ─────────────────────────────────────────────────
  function renderLeaderboard() {
    const el = $("#view-leaderboard");
    const prevPos = new Map();
    const wasOpen = new Set();
    el.querySelectorAll(".player-card").forEach((c) => {
      prevPos.set(c.dataset.player, c.getBoundingClientRect().top);
      if (c.classList.contains("open")) wasOpen.add(c.dataset.player);
    });

    const medals = ["🥇", "🥈", "🥉"];
    el.innerHTML = state.players.map((p, i) => {
      const medal = p.rank <= 3 ? medals[p.rank - 1] : "";
      const leader = p.rank === 1 ? "leader" : "";
      return `
      <div class="player-card ${leader}" data-player="${esc(p.name)}" style="animation-delay:${i * 45}ms">
        <button class="player-head" aria-expanded="false">
          <span class="rank">${medal || ordinal(p.rank)}</span>
          <span class="avatar">${p.avatar}</span>
          <span class="player-name">${esc(p.name)}</span>
          <span class="alive-dots" title="${p.alive} of ${p.teams.length} teams still alive">
            ${p.teams.map((t) => `<i class="dot ${t.status === "out" ? "dead" : t.status === "champion" ? "champ" : ""}"></i>`).join("")}
          </span>
          <span class="mini-flags">${p.teams.map((t) => `<span class="mini-flag ${t.status === "out" ? "faded" : ""}">${flag(t.code, "w40")}</span>`).join("")}</span>
          <span class="points" data-count="${p.total}">${firstRender ? 0 : p.total}</span>
          <span class="chev">▾</span>
        </button>
        <div class="player-detail">
          ${p.teams.map((t) => `
            <div class="team-row ${t.status}">
              <div class="team-stripe" style="background:${grad(t.code)}"></div>
              ${flag(t.code)}
              <div class="team-info">
                <div class="team-name">${esc(teamName(t.code))} <span class="grp">Grp ${TEAMS[t.code]?.group || "?"}</span></div>
                ${statusBadge(t)}
              </div>
              <div class="team-breakdown">
                ${t.breakdown.length ? t.breakdown.map((b) => `<span class="bd">${esc(b.label)} <b>+${b.pts}</b></span>`).join("") : `<span class="bd muted">No points yet</span>`}
              </div>
              <div class="team-pts">${t.total}</div>
            </div>`).join("")}
        </div>
      </div>`;
    }).join("");

    // restore cards that were expanded before the refresh
    el.querySelectorAll(".player-card").forEach((c) => {
      if (wasOpen.has(c.dataset.player)) c.classList.add("open");
    });

    // expand/collapse
    el.querySelectorAll(".player-head").forEach((btn) => {
      btn.addEventListener("click", () => {
        const card = btn.closest(".player-card");
        const open = card.classList.toggle("open");
        btn.setAttribute("aria-expanded", open);
      });
    });

    // FLIP slide animation on rank change
    if (!firstRender) {
      el.querySelectorAll(".player-card").forEach((c) => {
        const prev = prevPos.get(c.dataset.player);
        if (prev == null) return;
        const delta = prev - c.getBoundingClientRect().top;
        if (Math.abs(delta) > 2) {
          c.animate([{ transform: `translateY(${delta}px)` }, { transform: "translateY(0)" }], { duration: 500, easing: "cubic-bezier(.2,.8,.2,1)" });
        }
      });
    }
    if (firstRender) countUpAll(el);
  }

  function countUpAll(scope) {
    scope.querySelectorAll(".points[data-count]").forEach((el) => {
      const target = +el.dataset.count;
      if (!target) { el.textContent = "0"; return; }
      const t0 = performance.now(), dur = 900;
      const tick = (t) => {
        const k = Math.min(1, (t - t0) / dur);
        el.textContent = Math.round(target * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  // ── groups ──────────────────────────────────────────────────────
  function renderGroups() {
    $("#view-groups").innerHTML = GROUPS.map((g) => {
      const rows = state.tables[g];
      const started = rows.some((r) => r.P > 0);
      return `
      <div class="group-card">
        <div class="group-title">Group ${g}</div>
        <table class="group-table">
          <thead><tr><th></th><th class="tl">Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr></thead>
          <tbody>
          ${rows.map((r, i) => {
            const owner = state.owners[r.code];
            const leftover = !owner && POOL.settings.allowUnowned;
            const qualClass = `${started && i < 2 ? "q-auto" : started && i === 2 ? "q-maybe" : ""}${leftover ? " leftover" : ""}`;
            return `<tr class="${qualClass.trim()}">
              <td class="pos">${i + 1}</td>
              <td class="tl team-cell">${flag(r.code, "w40")} <span>${esc(teamName(r.code))}</span>
                ${owner ? `<span class="owner-tag">${esc(owner)}</span>` : leftover ? `<span class="owner-tag out-tag">out of play</span>` : ""}</td>
              <td>${r.P}</td><td>${r.W}</td><td>${r.D}</td><td>${r.L}</td>
              <td class="${r.GD > 0 ? "pos-gd" : r.GD < 0 ? "neg-gd" : ""}">${r.GD > 0 ? "+" : ""}${r.GD}</td>
              <td class="pts-cell">${r.Pts}</td></tr>`;
          }).join("")}
          </tbody>
        </table>
      </div>`;
    }).join("");
  }

  // ── matches ─────────────────────────────────────────────────────
  function matchCard(m) {
    const ownerH = state.owners[m.home], ownerA = state.owners[m.away];
    const liveNow = m.status === "LIVE" || m.status === "IN_PLAY" || m.status === "PAUSED";
    const done = m.status === "FINISHED";
    const score = done || liveNow ? `${m.homeScore ?? "–"} : ${m.awayScore ?? "–"}` : fmtDate(m.utcDate).split(",").pop().trim();
    const pens = done && m.winner && m.homeScore === m.awayScore ? `<div class="pens">${esc(teamName(m.winner))} win on penalties</div>` : "";
    return `
    <div class="match-card ${liveNow ? "live" : ""} ${done ? "done" : ""}">
      <div class="match-stage">${PoolEngine.STAGE_LABELS[m.stage] || m.stage}${m.group ? ` · Group ${m.group}` : ""}
        ${liveNow ? `<span class="live-pip">● LIVE</span>` : `<span class="match-date">${fmtDate(m.utcDate)}</span>`}</div>
      <div class="match-teams">
        <div class="mt home ${done && m.winner === m.home ? "won" : ""}">${flag(m.home, "w40")}<span>${esc(teamName(m.home))}</span>${ownerH ? `<span class="owner-tag">${esc(ownerH)}</span>` : ""}</div>
        <div class="score">${score}</div>
        <div class="mt away ${done && m.winner === m.away ? "won" : ""}">${ownerA ? `<span class="owner-tag">${esc(ownerA)}</span>` : ""}<span>${esc(teamName(m.away))}</span>${flag(m.away, "w40")}</div>
      </div>
      ${pens}
    </div>`;
  }

  function renderMatches() {
    const el = $("#view-matches");
    const ms = [...state.matches].sort((a, b) => new Date(a.utcDate || 0) - new Date(b.utcDate || 0));
    if (!ms.length) {
      el.innerHTML = `<div class="empty">⚽ No match data yet — the live feed will populate this automatically once the sync runs.</div>`;
      return;
    }
    const today = new Date().toDateString();
    const sections = [
      { title: "🔴 Live & Today", items: ms.filter((m) => m.status === "LIVE" || m.status === "IN_PLAY" || m.status === "PAUSED" || new Date(m.utcDate).toDateString() === today) },
      { title: "📅 Upcoming", items: ms.filter((m) => m.status !== "FINISHED" && new Date(m.utcDate).toDateString() !== today).slice(0, 12) },
      { title: "✅ Results", items: ms.filter((m) => m.status === "FINISHED" && new Date(m.utcDate).toDateString() !== today).reverse() },
    ];
    el.innerHTML = sections.filter((s) => s.items.length).map((s) =>
      `<h3 class="section-title">${s.title}</h3><div class="match-grid">${s.items.map(matchCard).join("")}</div>`
    ).join("");
  }

  // ── bracket ─────────────────────────────────────────────────────
  function renderBracket() {
    const el = $("#view-bracket");
    const ko = state.matches.filter((m) => m.stage !== "GROUP");
    if (!ko.length) {
      el.innerHTML = `<div class="empty">🔒 The knockout bracket unlocks when the group stage wraps up (32 teams advance: 12 group winners, 12 runners-up, 8 best third-place teams).</div>`;
      return;
    }
    const cols = ["R32", "R16", "QF", "SF", "FINAL", "THIRD"];
    el.innerHTML = `<div class="bracket">` + cols.map((stage) => {
      const items = ko.filter((m) => m.stage === stage).sort((a, b) => new Date(a.utcDate || 0) - new Date(b.utcDate || 0));
      if (!items.length) return "";
      return `<div class="bracket-col"><h3 class="section-title">${PoolEngine.STAGE_LABELS[stage]}</h3>${items.map(matchCard).join("")}</div>`;
    }).join("") + `</div>`;
  }

  // ── wooden spoon ────────────────────────────────────────────────
  function renderSpoon() {
    const el = $("#view-spoon");
    const ranking = state.spoonRank.slice(0, 6);
    const locked = state.allGroupsDone;
    el.innerHTML = `
      <div class="spoon-hero">
        <div class="spoon-emoji">🥄</div>
        <h2>The Wooden Spoon</h2>
        <p>The owner of the tournament's <b>worst team</b> bags a <b>+${SCORING.woodenSpoon} point</b> consolation bonus.<br>
        Ranked by fewest group points → worst goal differential → fewest goals scored.</p>
        <div class="spoon-status ${locked ? "locked" : ""}">${locked
          ? `🏅 Awarded to <b>${esc(state.owners[state.spoonCode] || "—")}</b> for ${esc(teamName(state.spoonCode))}`
          : "⏳ Live projection — locks in when the group stage ends"}</div>
      </div>
      <div class="spoon-list">
        ${ranking.map((r, i) => `
          <div class="spoon-row ${i === 0 ? "spoon-leader" : ""}">
            <span class="spoon-rank">${i === 0 ? "🥄" : "#" + (i + 1)}</span>
            ${flag(r.code, "w40")}
            <span class="spoon-team">${esc(teamName(r.code))}</span>
            ${state.owners[r.code] ? `<span class="owner-tag">${esc(state.owners[r.code])}</span>` : ""}
            <span class="spoon-stats">${r.W}W-${r.D}D-${r.L}L · GD ${r.GD > 0 ? "+" : ""}${r.GD} · ${r.Pts} pts</span>
          </div>`).join("")}
      </div>`;
  }

  // ── scoring reference ───────────────────────────────────────────
  function renderRules() {
    const rows = [
      ["Group-stage win", SCORING.groupWin], ["Group-stage draw", SCORING.groupDraw],
      ["Finish 1st in group", SCORING.groupFirst], ["Finish 2nd in group", SCORING.groupSecond],
      ["3rd place that advances", SCORING.groupThirdAdvance],
      ["Win Round of 32 game", SCORING.r32Win], ["Win Round of 16 game", SCORING.r16Win],
      ["Win Quarter-final", SCORING.qfWin], ["Win Semi-final", SCORING.sfWin],
      ["Win Third-place match", SCORING.thirdPlaceWin], ["Win the Final 🏆", SCORING.finalWin],
      ["Wooden Spoon (worst team) 🥄", SCORING.woodenSpoon],
    ];
    $("#rules-table").innerHTML = rows.map(([l, p]) => `<div class="rule"><span>${l}</span><b>+${p}</b></div>`).join("");
  }

  // ── header / hero ───────────────────────────────────────────────
  function renderHero() {
    $("#pool-name").textContent = POOL.settings.poolName;
    const finished = state.matches.filter((m) => m.status === "FINISHED").length;
    const TOURNAMENT_MATCHES = 104; // total matches in the 48-team World Cup
    const matchesLeft = Math.max(0, TOURNAMENT_MATCHES - finished);
    const liveCount = state.matches.filter((m) => ["LIVE", "IN_PLAY", "PAUSED"].includes(m.status)).length;
    $("#hero-stats").innerHTML = `
      <div class="stat"><b>${finished}</b><span>matches played</span></div>
      <div class="stat"><b>${state.players.length}</b><span>players</span></div>
      <div class="stat"><b>${Object.values(state.scores).filter((s) => s.status !== "out").length}</b><span>teams alive</span></div>
      <div class="stat"><b>${matchesLeft}</b><span>matches left</span></div>
      ${liveCount ? `<div class="stat stat-live"><b>${liveCount}</b><span>LIVE now</span></div>` : ""}`;
    $("#updated-at").textContent = live.updatedAt
      ? `Live feed updated ${new Date(live.updatedAt).toLocaleString()}`
      : "Waiting for first live sync…";

    const banners = [];
    if (POOL.settings.sampleDraft) banners.push(`🎲 <b>SAMPLE DRAFT</b> — these team assignments are placeholders until the real draft is entered.`);
    if (POOL.settings.allowUnowned && state.unowned?.length) {
      banners.push(`🚫 <b>Out of play:</b> ${state.unowned.map(teamName).map(esc).join(", ")} — undrafted, can't score.`);
    }
    validatePool().forEach((p) => banners.push(`⚠️ ${esc(p)}`));
    $("#banners").innerHTML = banners.map((b) => `<div class="banner">${b}</div>`).join("");

    // champion celebration
    const champ = Object.values(state.scores).find((s) => s.status === "champion");
    if (champ && !confettiFired) { confettiFired = true; confetti(); }
  }

  // ── confetti (tiny, dependency-free) ────────────────────────────
  function confetti() {
    const cv = document.createElement("canvas");
    cv.className = "confetti";
    document.body.appendChild(cv);
    const ctx = cv.getContext("2d");
    cv.width = innerWidth; cv.height = innerHeight;
    const colors = ["#FFD700", "#FF4D6D", "#4DCCFF", "#7CFC00", "#FF9F1C", "#C77DFF"];
    const parts = Array.from({ length: 180 }, () => ({
      x: Math.random() * cv.width, y: -20 - Math.random() * cv.height * 0.5,
      r: 4 + Math.random() * 6, c: colors[(Math.random() * colors.length) | 0],
      vy: 2 + Math.random() * 3.5, vx: -1.5 + Math.random() * 3, rot: Math.random() * Math.PI, vr: -0.1 + Math.random() * 0.2,
    }));
    const t0 = performance.now();
    (function tick(t) {
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (const p of parts) {
        p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.c; ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
        ctx.restore();
      }
      if (t - t0 < 6000) requestAnimationFrame(tick); else cv.remove();
    })(t0);
  }

  // ── full-time announcer ─────────────────────────────────────────
  function checkNewResults(initial) {
    const finished = (state.matches || []).filter((m) => m.status === "FINISHED");
    if (initial && seenResults.size === 0) {
      // first ever visit: seed silently so we don't replay the whole tournament
      finished.forEach((m) => seenResults.add(m.id));
      saveSeen();
      return;
    }
    const fresh = finished.filter((m) => !seenResults.has(m.id));
    fresh.sort((a, b) => new Date(a.utcDate || 0) - new Date(b.utcDate || 0));
    for (const m of fresh) {
      seenResults.add(m.id);
      ftQueue.push(m);
    }
    if (fresh.length) saveSeen();
    if (ftQueue.length && !ftPlaying) playNextFT();
  }

  function playNextFT() {
    // hold while the splash screen is still up
    if (document.getElementById("splash")) { ftPlaying = true; setTimeout(playNextFT, 500); return; }
    const m = ftQueue.shift();
    if (!m) { ftPlaying = false; return; }
    ftPlaying = true;
    const c = commentaryFor(m);
    const stage = $("#ft-stage");
    const winSide = (code) => c.kind === "result" && c.winner === code;
    const loseSide = (code) => c.kind === "result" && c.loser === code;

    stage.className = `ft-stage ft-${c.kind}`;
    stage.innerHTML = `
      <div class="ft-card">
        <button class="ft-close" aria-label="Dismiss">✕</button>
        <div class="ft-tag">⏱️ FULL TIME${m.group ? ` · Group ${m.group}` : ""}</div>
        <div class="ft-teams">
          <div class="ft-team ${winSide(m.home) ? "ft-win" : loseSide(m.home) ? "ft-lose" : ""}">
            <div class="ft-flagwrap" style="--g:${grad(m.home)}">${flag(m.home)}</div>
            <div class="ft-name">${esc(teamName(m.home))}</div>
            <div class="ft-owner">${esc(state.owners[m.home] || "—")}</div>
          </div>
          <div class="ft-score"><span class="ft-h">0</span><i>:</i><span class="ft-a">0</span></div>
          <div class="ft-team ${winSide(m.away) ? "ft-win" : loseSide(m.away) ? "ft-lose" : ""}">
            <div class="ft-flagwrap" style="--g:${grad(m.away)}">${flag(m.away)}</div>
            <div class="ft-name">${esc(teamName(m.away))}</div>
            <div class="ft-owner">${esc(state.owners[m.away] || "—")}</div>
          </div>
        </div>
        ${c.kind === "draw"
          ? `<div class="ft-headline">🤝 Honors Even</div><div class="ft-commentary">${esc(c.joke)}</div>`
          : `<div class="ft-headline">${esc(c.headline)}</div>
             <div class="ft-commentary ft-praise">🏆 ${esc(c.praise)}</div>
             <div class="ft-commentary ft-roast">🔥 ${esc(c.roast)}</div>`}
        <div class="ft-progress"><i></i></div>
      </div>`;
    stage.classList.remove("hidden");
    requestAnimationFrame(() => stage.classList.add("ft-show"));

    // animate the scoreline counting up
    countUpScore(stage.querySelector(".ft-h"), m.homeScore ?? 0);
    countUpScore(stage.querySelector(".ft-a"), m.awayScore ?? 0);

    if (c.kind !== "draw") setTimeout(confetti, 350);

    const dismiss = () => closeFT();
    stage.querySelector(".ft-close").onclick = dismiss;
    stage.onclick = (e) => { if (e.target === stage) dismiss(); };
    clearTimeout(stage._timer);
    stage._timer = setTimeout(dismiss, 7000);
  }

  function closeFT() {
    const stage = $("#ft-stage");
    clearTimeout(stage._timer);
    stage.classList.remove("ft-show");
    setTimeout(() => {
      stage.classList.add("hidden");
      stage.innerHTML = "";
      if (ftQueue.length) playNextFT(); else ftPlaying = false;
    }, 420);
  }

  function countUpScore(el, target) {
    if (!el) return;
    const t0 = performance.now(), dur = 700;
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      el.textContent = Math.round(target * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(tick); else el.textContent = target;
    };
    requestAnimationFrame(tick);
  }

  // ── tabs & boot ─────────────────────────────────────────────────
  function renderAll(initial) {
    renderHero(); renderLeaderboard(); renderGroups(); renderMatches(); renderBracket(); renderSpoon(); renderRules();
    firstRender = false;
    checkNewResults(initial);
  }

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t === tab));
      document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${tab.dataset.view}` || (tab.dataset.view === "leaderboard" && v.id === "view-leaderboard")));
    });
  });

  // Demo hook: ?demo=usa replays the USA 4-1 Paraguay full-time card.
  // Add &loop=1 to keep replaying it.
  function maybeDemo() {
    const params = new URLSearchParams(location.search);
    if (!params.has("demo")) return;
    const demos = {
      usa: { id: "demo-usa", stage: "GROUP", group: "D", utcDate: new Date().toISOString(), status: "FINISHED", home: "USA", away: "PAR", homeScore: 4, awayScore: 1, winner: "USA" },
      draw: { id: "demo-draw", stage: "GROUP", group: "B", utcDate: new Date().toISOString(), status: "FINISHED", home: "CAN", away: "BIH", homeScore: 1, awayScore: 1, winner: null },
    };
    const m = demos[params.get("demo")] || demos.usa;
    const fire = () => { ftQueue.push({ ...m }); if (!ftPlaying) playNextFT(); };
    fire();
    if (params.get("loop")) setInterval(fire, 9000);
  }

  refresh(true).then(maybeDemo);
  setInterval(refresh, REFRESH_MS);
})();
