/* ============================================================
   HACKATHON TIMER — js/timer.js

   SPEED-DATING FORMAT
   ───────────────────
   Every team visits EVERY judge. 16 teams × 3 judges.

   In round r (1-based), judge j sees:
     teamIndex = (judgeOffsets[j] + r - 1) % numTeams   (0-based)

   totalRounds = numTeams  (16 rounds so every team sees every judge)

   The offset staggers the starting position:
     Round 1:  J1=Iris(0), J2=QuadS(5), J3=LEC Girlies(10)
     Round 7:  J1=Royal Hogs, J2=Team Subharambha, J3=Iris
     Round 16: every judge sees their last remaining team
   ============================================================ */

// ── Config ───────────────────────────────────────────────────────────────────
const config = {
  numJudges:     3,
  numTeams:      16,
  pitchDuration: 240,
  shiftDuration: 10,
  judgeNames:    ['Judge 1', 'Judge 2', 'Judge 3'],
  judgeOffsets:  [0, 5, 10],   // 0-based start index per judge
};

// ── State ────────────────────────────────────────────────────────────────────
const state = {
  phase:       'pitch',
  timeLeft:    240,
  round:       1,
  totalRounds: 16,   // always = numTeams
  running:     false,
};

let _intervalId = null;

// ── Pure helper: which team (0-based idx) is at judge j in round r ────────────
function teamAtJudge(j, r) {
  return (config.judgeOffsets[j] + r - 1) % config.numTeams;
}

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
        _stopInterval();
        UI.showDone();
        return;
      }
      state.phase    = 'shift';
      state.timeLeft = config.shiftDuration;
      SoundEngine.startTransition();
    } else {
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
  const btn       = document.getElementById('startBtn');
  btn.disabled    = false;
  btn.textContent = 'RESUME';
}

function resetTimer() {
  _stopInterval();
  SoundEngine.stopTransition();
  state.phase       = 'pitch';
  state.timeLeft    = config.pitchDuration;
  state.round       = 1;
  state.totalRounds = config.numTeams;
  const btn       = document.getElementById('startBtn');
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
  if (state.round >= state.totalRounds) { UI.showDone(); return; }
  state.round++;
  state.phase    = 'pitch';
  state.timeLeft = config.pitchDuration;
  const btn       = document.getElementById('startBtn');
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
  const btn       = document.getElementById('startBtn');
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

  config.numJudges     = judges;
  config.numTeams      = teams;
  config.pitchDuration = pitch;
  config.shiftDuration = shift;
  config.judgeNames    = judgeNames;
  config.judgeOffsets  = judgeOffsets;

  while (teamNames.length < teams) teamNames.push(`Team ${teamNames.length + 1}`);
  teamNames.splice(teams);

  document.getElementById('settingJudgeNames').value   = judgeNames.join(', ');
  document.getElementById('settingJudgeOffsets').value = judgeOffsets.join(', ');

  SettingsPanel.close();
  resetTimer();
  UI.showToast('✓ SETTINGS APPLIED', 'ok');
}
