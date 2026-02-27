/* ============================================================
   HACKATHON TIMER — js/timer.js
   Core state machine: pitch → shift → pitch → ... → done

   KEY CONCEPTS
   ─────────────
   judgeOffsets[j]  = 0-based index into teamNames[] of the FIRST
                      team that judge j sees in Round 1.

   Each judge owns a contiguous "lane" of teams:
     Judge 0 → teams at indices [offsets[0], offsets[1])
     Judge 1 → teams at indices [offsets[1], offsets[2])
     Judge 2 → teams at indices [offsets[2], numTeams)   (wraps to cover rest)

   queueSize[j]  = number of teams in that lane.
   totalRounds   = max(queueSizes)   ← session ends here, NOT at numTeams.

   In each round r (0-based):
     • Judge j pitches team at laneOffset + r  (if r < queueSize[j], else idle)

   The "waiting" list for judge j in round r shows ONLY teams at
   positions r+1, r+2, … queueSize[j]-1 — never teams already done.
   ============================================================ */

// ── Config ───────────────────────────────────────────────────────────────────
const config = {
  numJudges:     3,
  numTeams:      16,
  pitchDuration: 240,   // 4 minutes default
  shiftDuration: 10,
  judgeNames:    ['Judge 1', 'Judge 2', 'Judge 3'],
  // 0-based start index in teamNames[] for each judge
  // Judge 1 → Iris (idx 0), Judge 2 → QuadS (idx 5), Judge 3 → LEC Girlies (idx 10)
  judgeOffsets:  [0, 5, 10],
};

// ── State ────────────────────────────────────────────────────────────────────
const state = {
  phase:       'pitch',   // 'pitch' | 'shift'
  timeLeft:    240,
  round:       1,         // 1-based, goes up to totalRounds
  totalRounds: 1,         // set properly after first generateSchedule()
  running:     false,
};

let _intervalId = null;

// ── Schedule ──────────────────────────────────────────────────────────────────
// Returns { queueSizes[], totalRounds }
// schedule[][] is NOT stored — the queue is computed live in ui.js from
// config.judgeOffsets + queueSizes + state.round.
function buildScheduleMeta(numTeams, numJudges, judgeOffsets) {
  const offsets = (judgeOffsets && judgeOffsets.length === numJudges)
    ? judgeOffsets.slice()
    : Array.from({ length: numJudges }, (_, j) => Math.round(j * numTeams / numJudges));

  // Lane size = distance between consecutive offsets (last judge wraps to end)
  const queueSizes = offsets.map((off, j) => {
    if (j < numJudges - 1) {
      // distance to next judge's start
      return offsets[j + 1] - off;
    } else {
      // last judge takes the remaining teams
      return numTeams - off;
    }
  });

  // Validate: sizes must all be > 0 and sum to numTeams
  const valid = queueSizes.every(s => s > 0) && queueSizes.reduce((a, b) => a + b, 0) === numTeams;
  if (!valid) {
    // Fallback: equal distribution
    const base = Math.floor(numTeams / numJudges);
    return {
      queueSizes: Array.from({ length: numJudges }, (_, j) =>
        j < numTeams % numJudges ? base + 1 : base),
      totalRounds: Math.ceil(numTeams / numJudges),
    };
  }

  return { queueSizes, totalRounds: Math.max(...queueSizes) };
}

// Live schedule metadata — updated whenever settings change
let scheduleMeta = buildScheduleMeta(config.numTeams, config.numJudges, config.judgeOffsets);
state.totalRounds = scheduleMeta.totalRounds;

// ── Tick ─────────────────────────────────────────────────────────────────────
function tick() {
  state.timeLeft--;

  if (state.phase === 'pitch' && state.timeLeft === 60) {
    SoundEngine.playOneMinWarning();
  }

  if (state.timeLeft <= 0) {
    if (state.phase === 'pitch') {
      SoundEngine.playPitchEnd();

      if (state.round >= state.totalRounds) {
        // ── ALL ROUNDS DONE ──
        _stopInterval();
        UI.showDone();
        return;
      }

      // Start transition period
      state.phase    = 'shift';
      state.timeLeft = config.shiftDuration;
      SoundEngine.startTransition();

    } else {
      // Transition over → next pitch round
      SoundEngine.stopTransition();
      state.round++;
      state.phase    = 'pitch';
      state.timeLeft = config.pitchDuration;
    }
  }

  UI.renderTimer();
}

// ── Controls ─────────────────────────────────────────────────────────────────
function startTimer() {
  if (state.running) return;
  SoundEngine.unlock();
  state.running = true;
  document.getElementById('startBtn').disabled = true;
  document.getElementById('pauseBtn').disabled = false;
  _intervalId = setInterval(tick, 1000);
}

function pauseTimer() {
  if (!state.running) return;
  _stopInterval();
  if (state.phase === 'shift') SoundEngine.stopTransition();
  const btn = document.getElementById('startBtn');
  btn.disabled    = false;
  btn.textContent = 'RESUME';
}

function resetTimer() {
  _stopInterval();
  SoundEngine.stopTransition();
  state.phase       = 'pitch';
  state.timeLeft    = config.pitchDuration;
  state.round       = 1;
  state.totalRounds = scheduleMeta.totalRounds;
  const btn = document.getElementById('startBtn');
  btn.disabled    = false;
  btn.textContent = 'START';
  UI.renderAll();
}

function _stopInterval() {
  clearInterval(_intervalId);
  _intervalId   = null;
  state.running = false;
  document.getElementById('pauseBtn').disabled = true;
}

// ── Skip / Jump ───────────────────────────────────────────────────────────────
function skipToNextRound() {
  const wasRunning = state.running;
  _stopInterval();
  SoundEngine.stopTransition();

  if (state.round >= state.totalRounds) {
    UI.showDone();
    return;
  }

  state.round++;
  state.phase    = 'pitch';
  state.timeLeft = config.pitchDuration;
  const btn = document.getElementById('startBtn');
  btn.disabled    = false;
  btn.textContent = 'START';
  UI.renderAll();
  UI.showToast(`⏭ ROUND ${state.round}`, 'warn');
  if (wasRunning) startTimer();
}

function jumpToRound(targetRound) {
  if (targetRound < 1 || targetRound > state.totalRounds) {
    UI.showToast(`⚠ ENTER 1 – ${state.totalRounds}`, 'warn');
    return;
  }
  _stopInterval();
  SoundEngine.stopTransition();
  state.round    = targetRound;
  state.phase    = 'pitch';
  state.timeLeft = config.pitchDuration;
  const btn = document.getElementById('startBtn');
  btn.disabled    = false;
  btn.textContent = 'START';
  UI.renderAll();
  UI.showToast(`⚡ JUMPED TO ROUND ${targetRound}`, 'warn');
}

// ── Apply Settings ────────────────────────────────────────────────────────────
function applyGeneralSettings() {
  const judges = parseInt(document.getElementById('settingJudges').value) || 3;
  const teams  = parseInt(document.getElementById('settingTeams').value)  || 16;
  const pitch  = parseInt(document.getElementById('settingPitch').value)  || 240;
  const shift  = parseInt(document.getElementById('settingShift').value)  || 10;

  const rawNames   = document.getElementById('settingJudgeNames').value
    .split(',').map(s => s.trim()).filter(Boolean);
  const judgeNames = Array.from({ length: judges }, (_, i) => rawNames[i] || `Judge ${i + 1}`);

  const rawOffsets   = document.getElementById('settingJudgeOffsets').value
    .split(',').map(s => parseInt(s.trim()));
  const judgeOffsets = Array.from({ length: judges }, (_, i) => {
    const v = rawOffsets[i];
    return (!isNaN(v) && v >= 0 && v < teams) ? v : Math.round(i * teams / judges);
  });

  // Apply to config
  config.numJudges     = judges;
  config.numTeams      = teams;
  config.pitchDuration = pitch;
  config.shiftDuration = shift;
  config.judgeNames    = judgeNames;
  config.judgeOffsets  = judgeOffsets;

  // Recompute schedule metadata
  scheduleMeta = buildScheduleMeta(teams, judges, judgeOffsets);

  // Resize teamNames preserving existing names
  while (teamNames.length < teams) teamNames.push(`Team ${teamNames.length + 1}`);
  teamNames.splice(teams);

  // Sync UI inputs
  document.getElementById('settingJudgeNames').value   = judgeNames.join(', ');
  document.getElementById('settingJudgeOffsets').value = judgeOffsets.join(', ');

  SettingsPanel.close();
  resetTimer();
  UI.showToast('✓ SETTINGS APPLIED', 'ok');
}
