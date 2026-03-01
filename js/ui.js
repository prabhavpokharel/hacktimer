/* ============================================================
   HACKATHON TIMER — js/ui.js

   QUEUE LOGIC (speed-dating)
   ──────────────────────────
   Judge j sees teams in this order across all 16 rounds:
     round 1:  (offsets[j] + 0) % n
     round 2:  (offsets[j] + 1) % n
     ...
     round 16: (offsets[j] + 15) % n

   In the current round r, the queue for judge j is:
     NOW    = teamAtJudge(j, r)
     NEXT   = teamAtJudge(j, r+1)   if r+1 <= totalRounds
     waiting= teamAtJudge(j, r+2..totalRounds)

   Already seen = rounds 1..r-1  →  shown as a count badge only.
   No team ever appears twice — % n just cycles through all 16.
   ============================================================ */

const UI = (() => {

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function fmtTime(s) {
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  // Accepts 0-based team index
  function teamLabel(idx) {
    if (idx === null || idx === undefined) return '—';
    const name = teamNames[idx];
    return (name && name.trim()) ? name : `Team ${idx + 1}`;
  }

  // ── Timer display ─────────────────────────────────────────────────────────────
  function renderTimer() {
    const isPitch  = state.phase === 'pitch';
    const totalSec = isPitch ? config.pitchDuration : config.shiftDuration;
    const pct      = Math.max(0, (state.timeLeft / totalSec) * 100);
    const color    = isPitch ? 'var(--blue)' : 'var(--shift-color)';

    document.getElementById('timerDisplay').textContent      = fmtTime(state.timeLeft);
    document.getElementById('timerDisplay').className        = 'timer-display ' + state.phase;
    document.getElementById('phaseLabel').textContent        = isPitch ? '● PITCHING' : '▶ TRANSITIONING';
    document.getElementById('phaseLabel').style.color        = color;
    document.getElementById('progressFill').style.width      = pct + '%';
    document.getElementById('progressFill').style.background = color;
    document.getElementById('roundCurrent').textContent      = state.round;

    renderJudgeCards();
    renderScheduleDots();
  }

  // ── Per-card hide / show ──────────────────────────────────────────────────────
  const hiddenCards = {};

  function toggleCardVisibility(j) {
    hiddenCards[j] = !hiddenCards[j];
    const card = document.getElementById(`judge-card-${j}`);
    if (!card) return;
    card.querySelector('.card-reveal').classList.toggle('blurred', !!hiddenCards[j]);
    const eye = card.querySelector('.eye-btn');
    eye.textContent = hiddenCards[j] ? '👁‍🗨' : '👁';
    eye.title       = hiddenCards[j] ? 'Show judge & team' : 'Hide judge & team';
  }

  // ── Queue data for judge j at current state.round ─────────────────────────────
  function getJudgeQueue(j) {
    const r   = state.round;
    const tot = state.totalRounds;

    // NOW — team pitching this round
    const nowIdx  = teamAtJudge(j, r);
    // NEXT — team arriving next round (null if last round)
    const nextIdx = r < tot ? teamAtJudge(j, r + 1) : null;
    // WAITING — teams from r+2 onward
    const waitingIdxs = [];
    for (let future = r + 2; future <= tot; future++) {
      waitingIdxs.push(teamAtJudge(j, future));
    }
    // DONE — how many have already visited this judge
    const doneSoFar = r - 1;

    return { nowIdx, nextIdx, waitingIdxs, doneSoFar, total: tot };
  }

  // ── Judge cards ───────────────────────────────────────────────────────────────
  function renderJudgeCards() {
    const container = document.getElementById('judgeCards');
    const isShift   = state.phase === 'shift';

    container.innerHTML = config.judgeNames.map((name, j) => {
      const isHidden = !!hiddenCards[j];
      const q        = getJudgeQueue(j);

      // Progress badge
      const badge = `<span class="done-count">${q.doneSoFar}/${q.total} done</span>`;

      // Waiting rows — only future rounds, never past
      let waitRows = '';
      if (q.waitingIdxs.length === 0 && q.nextIdx === null) {
        waitRows = `<div class="queue-empty">This is the last team</div>`;
      } else if (q.waitingIdxs.length === 0) {
        waitRows = `<div class="queue-empty">No more teams after next</div>`;
      } else {
        waitRows = q.waitingIdxs.map((idx, i) => `
          <div class="queue-item">
            <span class="queue-pos">${i + 3}</span>
            <span class="queue-name">${teamLabel(idx)}</span>
          </div>`).join('');
      }

      const inner = `
        <div class="team-slot">
          <span class="slot-label">NOW</span>
          <span class="status-dot active"></span>
          <span class="team-tag active">${teamLabel(q.nowIdx)}</span>
        </div>
        <div class="team-slot" style="margin-bottom:10px">
          <span class="slot-label">NEXT</span>
          <span class="status-dot on-deck"></span>
          <span class="team-tag on-deck">${q.nextIdx !== null ? teamLabel(q.nextIdx) : '— last one —'}</span>
        </div>
        <div class="queue-divider"></div>
        <div class="queue-label">Waiting in line</div>
        <div class="queue-list">${waitRows}</div>`;

      return `
        <div class="judge-card ${isShift ? 'shift' : ''}" id="judge-card-${j}">
          <div class="card-header">
            <span class="judge-name">${name}</span>
            <div style="display:flex;gap:6px;align-items:center">
              ${badge}
              <button class="eye-btn"
                      onclick="UI.toggleCardVisibility(${j})"
                      title="${isHidden ? 'Show' : 'Hide'} judge &amp; team">
                ${isHidden ? '👁‍🗨' : '👁'}
              </button>
            </div>
          </div>
          <div class="card-reveal ${isHidden ? 'blurred' : ''}">
            ${inner}
          </div>
        </div>`;
    }).join('');
  }

  // ── Schedule dots ─────────────────────────────────────────────────────────────
  function renderScheduleDots() {
    const container = document.getElementById('scheduleDots');
    container.innerHTML = Array.from({ length: state.totalRounds }, (_, i) => {
      const r   = i + 1;
      const cls = `sched-dot${r < state.round ? ' completed' : r === state.round ? ' current' : ''}`;
      const attr = r === state.round ? '' : `onclick="jumpToRound(${r})" title="Jump to round ${r}"`;
      return `<div class="${cls}" ${attr}>${r}</div>`;
    }).join('');
  }

  // ── Full re-render ────────────────────────────────────────────────────────────
  function renderAll() {
    document.getElementById('roundTotal').textContent = state.totalRounds;
    document.getElementById('skipRoundInput').max     = state.totalRounds;
    document.getElementById('doneTeams').textContent  = config.numTeams;
    renderTimer();
  }

  // ── Toast ─────────────────────────────────────────────────────────────────────
  let _toastTimer;
  function showToast(msg, type = '') {
    const el       = document.getElementById('toast');
    el.textContent = msg;
    el.className   = `toast show${type ? ' ' + type : ''}`;
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => { el.className = 'toast'; }, 2800);
  }

  // ── Done screen ───────────────────────────────────────────────────────────────
  function showDone() {
    document.getElementById('doneTeams').textContent = config.numTeams;
    document.getElementById('doneScreen').classList.add('show');
  }
  function hideDone() {
    document.getElementById('doneScreen').classList.remove('show');
  }

  return {
    renderTimer, renderJudgeCards, renderScheduleDots,
    renderAll, showToast, showDone, hideDone, toggleCardVisibility,
  };
})();
