/* ============================================================
   HACKATHON TIMER — js/ui.js
   DOM rendering helpers

   Queue logic
   ────────────
   For judge j in round r (1-based):
     • laneStart  = config.judgeOffsets[j]          (0-based team index)
     • laneSize   = scheduleMeta.queueSizes[j]
     • posInLane  = r - 1                            (0-based position)

   Teams in the lane are indices: laneStart, laneStart+1, … laneStart+laneSize-1
   (NO modulo — these are straight indices into teamNames[])

   Already pitched  = positions 0 … posInLane-1   → count = posInLane
   Pitching NOW     = position posInLane           (if posInLane < laneSize)
   On deck          = position posInLane + 1       (if exists)
   Waiting          = positions posInLane+2 …      (if any)
   Done / idle      = posInLane >= laneSize
   ============================================================ */

const UI = (() => {

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function fmtTime(s) {
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  function teamLabel(zeroBasedIdx) {
    if (zeroBasedIdx === null || zeroBasedIdx === undefined) return '—';
    const name = teamNames[zeroBasedIdx];
    return (name && name.trim()) ? name : `Team ${zeroBasedIdx + 1}`;
  }

  // ── Timer display ─────────────────────────────────────────────────────────────
  function renderTimer() {
    const isPitch  = state.phase === 'pitch';
    const totalSec = isPitch ? config.pitchDuration : config.shiftDuration;
    const pct      = Math.max(0, (state.timeLeft / totalSec) * 100);
    const color    = isPitch ? 'var(--blue)' : 'var(--shift-color)';

    document.getElementById('timerDisplay').textContent = fmtTime(state.timeLeft);
    document.getElementById('timerDisplay').className   = 'timer-display ' + state.phase;
    document.getElementById('phaseLabel').textContent   = isPitch ? '● PITCHING' : '▶ TRANSITIONING';
    document.getElementById('phaseLabel').style.color   = color;
    document.getElementById('progressFill').style.width      = pct + '%';
    document.getElementById('progressFill').style.background = color;
    document.getElementById('roundCurrent').textContent = state.round;

    renderJudgeCards();
    renderScheduleDots();
  }

  // ── Per-card hide/show ────────────────────────────────────────────────────────
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

  // ── Queue data for one judge ──────────────────────────────────────────────────
  function getJudgeQueue(j) {
    const laneStart  = config.judgeOffsets[j];             // 0-based index into teamNames
    const laneSize   = scheduleMeta.queueSizes[j];         // teams assigned to this judge
    const posInLane  = state.round - 1;                    // 0-based: how many have gone already

    // Build indices of remaining teams in this lane (forward-only, no wrap)
    const remainingIdxs = [];
    for (let p = posInLane; p < laneSize; p++) {
      remainingIdxs.push(laneStart + p);   // straight index into teamNames[]
    }

    return {
      pitching:   remainingIdxs.length > 0 ? remainingIdxs[0] : null,
      onDeck:     remainingIdxs.length > 1 ? remainingIdxs[1] : null,
      waiting:    remainingIdxs.slice(2),   // positions 2+ in remaining
      doneSoFar:  Math.min(posInLane, laneSize),
      laneSize,
      isIdle:     posInLane >= laneSize,    // true when this judge's queue is exhausted
    };
  }

  // ── Judge cards ───────────────────────────────────────────────────────────────
  function renderJudgeCards() {
    const container = document.getElementById('judgeCards');
    const isShift   = state.phase === 'shift';

    container.innerHTML = config.judgeNames.map((name, j) => {
      const isHidden = !!hiddenCards[j];
      const q        = getJudgeQueue(j);

      // Header badge
      const badge = q.isIdle
        ? `<span class="done-count done-count--finished">✓ All done</span>`
        : `<span class="done-count">${q.doneSoFar}/${q.laneSize} done</span>`;

      // Waiting list rows
      let waitRows = '';
      if (q.isIdle) {
        waitRows = `<div class="queue-empty queue-all-done">🎉 All ${q.laneSize} teams have pitched here</div>`;
      } else if (q.waiting.length === 0 && q.onDeck === null) {
        waitRows = `<div class="queue-empty">This is the last team</div>`;
      } else if (q.waiting.length === 0) {
        waitRows = `<div class="queue-empty">No more teams after next</div>`;
      } else {
        waitRows = q.waiting.map((idx, i) => `
          <div class="queue-item">
            <span class="queue-pos">${i + 3}</span>
            <span class="queue-name">${teamLabel(idx)}</span>
          </div>`).join('');
      }

      // Card inner content
      const inner = q.isIdle
        ? `<div class="judge-idle-msg">🎉 All ${q.laneSize} teams have pitched here</div>`
        : `
          <div class="team-slot">
            <span class="slot-label">NOW</span>
            <span class="status-dot active"></span>
            <span class="team-tag active">${teamLabel(q.pitching)}</span>
          </div>
          <div class="team-slot" style="margin-bottom:10px">
            <span class="slot-label">NEXT</span>
            <span class="status-dot on-deck"></span>
            <span class="team-tag on-deck">${q.onDeck !== null ? teamLabel(q.onDeck) : '— last one —'}</span>
          </div>
          <div class="queue-divider"></div>
          <div class="queue-label">Waiting in line</div>
          <div class="queue-list">${waitRows}</div>
        `;

      return `
        <div class="judge-card ${isShift ? 'shift' : ''} ${q.isIdle ? 'judge-idle' : ''}"
             id="judge-card-${j}">
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
      const r    = i + 1;
      const done = r < state.round;
      const cur  = r === state.round;
      const cls  = `sched-dot${done ? ' completed' : cur ? ' current' : ''}`;
      const attr = cur ? '' : `onclick="jumpToRound(${r})" title="Jump to round ${r}"`;
      return `<div class="${cls}" ${attr}>${r}</div>`;
    }).join('');
  }

  // ── Full re-render ────────────────────────────────────────────────────────────
  function renderAll() {
    document.getElementById('roundTotal').textContent  = state.totalRounds;
    document.getElementById('skipRoundInput').max      = state.totalRounds;
    document.getElementById('doneTeams').textContent   = config.numTeams;
    renderTimer();
  }

  // ── Toast ─────────────────────────────────────────────────────────────────────
  let _toastTimer;
  function showToast(msg, type = '') {
    const el    = document.getElementById('toast');
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
