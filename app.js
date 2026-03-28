/* ============================================================
   SHARC 淨現值最佳化模擬系統 — 核心邏輯
   ============================================================
   參數來源：個案研究
   目前總量 : 5,000 公噸
   目標總量 : 2,500 公噸
   未來捕撈量 = min(2500, 5000 - Σ各協會明年捕撈量)
   ============================================================ */

// ── 全域常數 ──────────────────────────────────────────────────
const GROUPS = {
  lc: { name: '大型商業漁民協會', abbr: 'LC', current: 2000, min: 400,  max: 2000, coeff: 0.10, color: '#38bdf8' },
  sc: { name: '小型商業漁民協會', abbr: 'SC', current: 1500, min: 300,  max: 1500, coeff: 0.25, color: '#a78bfa' },
  rc: { name: '休閒比賽漁民協會', abbr: 'RC', current: 1000, min: 200,  max: 1000, coeff: 0.70, color: '#34d399' },
  rt: { name: '休閒旅遊漁民協會', abbr: 'RT', current:  500, min: 100,  max:  500, coeff: 0.85, color: '#fb923c' }
};

const TOTAL_CURRENT  = 5000;
const FUTURE_TARGET  = 2500;
const TOTAL_LIMIT    = 2500;  // 總量上限模式的最高允許值

// ── 模式狀態 ─────────────────────────────────────────────────────
let limitMode = false;  // false = 無限制, true = 2500 公噸總量上限

// ── 核心計算函數 ───────────────────────────────────────────────

/** 未來捕撈量 = min(2500, 5000 - 四方總量) */
function calcFutureCatch(catches) {
  const total = catches.lc + catches.sc + catches.rc + catches.rt;
  return Math.min(FUTURE_TARGET, TOTAL_CURRENT - total);
}

/** 單一協會淨現值 NPV = $10,000 × (捕撈量 + 係數 × 未來捕撈量) */
function calcNPV(catchAmt, coeff, futureCatch) {
  return 10000 * (catchAmt + coeff * futureCatch);
}

/** 計算所有協會的 NPV，回傳物件 */
function calcAll(catches) {
  const future = calcFutureCatch(catches);
  const npvs = {};
  for (const [key, g] of Object.entries(GROUPS)) {
    npvs[key] = calcNPV(catches[key], g.coeff, future);
  }
  return { future, npvs, total: Object.values(npvs).reduce((a, b) => a + b, 0) };
}

// ── 讀取目前輸入 ───────────────────────────────────────────────
function getCurrentCatches() {
  return {
    lc: parseInt(document.getElementById('lc-catch').value) || GROUPS.lc.current,
    sc: parseInt(document.getElementById('sc-catch').value) || GROUPS.sc.current,
    rc: parseInt(document.getElementById('rc-catch').value) || GROUPS.rc.current,
    rt: parseInt(document.getElementById('rt-catch').value) || GROUPS.rt.current,
  };
}

// ── 格式化輔助 ─────────────────────────────────────────────────
function fmtNPV(n) {
  if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  return '$' + n.toLocaleString('zh-TW');
}
function fmtTons(n) { return n.toLocaleString('zh-TW') + ' 公噸'; }

// ── 更新 UI ────────────────────────────────────────────────────
function updateUI() {
  const catches = getCurrentCatches();
  const { future, npvs, total } = calcAll(catches);
  const totalCatch = catches.lc + catches.sc + catches.rc + catches.rt;

  // Status bar
  document.getElementById('total-catch-display').textContent = fmtTons(totalCatch);
  document.getElementById('future-catch-display').textContent = fmtTons(future);
  document.getElementById('total-npv-display').textContent = fmtNPV(total);

  // Highlight total-catch red in limit mode if exceeded
  const tcEl = document.getElementById('total-catch-display');
  if (limitMode && totalCatch > TOTAL_LIMIT) {
    tcEl.style.color = '#f87171';
  } else if (limitMode) {
    tcEl.style.color = '#34d399';
  } else {
    tcEl.style.color = '';
  }

  // Future catch colour
  const fcEl = document.getElementById('future-catch-display');
  fcEl.style.color = future >= FUTURE_TARGET ? '#34d399' : '#fbbf24';

  // ── Warning banner (limit mode only) ────────────────────────
  const banner = document.getElementById('warning-banner');
  if (limitMode && totalCatch > TOTAL_LIMIT) {
    const excess = totalCatch - TOTAL_LIMIT;
    // percent of TOTAL_LIMIT exceeded (caps at 100%)
    const pct = Math.min(100, (totalCatch / TOTAL_LIMIT) * 100);
    document.getElementById('warning-detail').textContent =
      `目前協議總量 ${fmtTons(totalCatch)}，超出上限 ${fmtTons(excess)}`;
    document.getElementById('warning-bar-fill').style.width = pct + '%';
    document.getElementById('warning-bar-label').textContent =
      `${totalCatch.toLocaleString('zh-TW')} / 2,500 公噸`;
    banner.style.display = 'flex';
    // Re-trigger slide-in animation
    banner.style.animation = 'none';
    void banner.offsetWidth;
    banner.style.animation = '';
  } else {
    banner.style.display = 'none';
  }

  // Individual NPV & progress bars
  for (const key of ['lc', 'sc', 'rc', 'rt']) {
    const g = GROUPS[key];
    const catchVal = catches[key];
    const npvEl = document.getElementById(`${key}-npv`);
    const prev = npvEl.textContent;
    const next = fmtNPV(npvs[key]);
    if (prev !== next) {
      npvEl.textContent = next;
      triggerPop(npvEl);
    }
    // Summary panel
    document.getElementById(`sum-${key}-npv`).textContent = fmtNPV(npvs[key]);
    document.getElementById(`sum-${key}-catch`).textContent = fmtTons(catchVal);

    // Progress bar — % of allowed range occupied
    const range = g.max - g.min;
    const pct = ((catchVal - g.min) / range) * 100;
    document.getElementById(`${key}-progress`).style.width = Math.max(0, Math.min(100, pct)) + '%';

    // Sync slider ↔ number input (avoid infinite loop)
    sync(`${key}-slider`, `${key}-catch`, catchVal);
  }

  updateCharts(catches, npvs, future);
}

function triggerPop(el) {
  el.classList.remove('pop');
  void el.offsetWidth; // reflow
  el.classList.add('pop');
}

// Keep slider and number-input in sync without recursion
const _syncing = {};
function sync(sliderId, inputId, value) {
  if (_syncing[sliderId]) return;
  _syncing[sliderId] = true;
  const slider = document.getElementById(sliderId);
  const input  = document.getElementById(inputId);
  if (slider && Math.abs(parseInt(slider.value) - value) > 0) slider.value = value;
  if (input  && Math.abs(parseInt(input.value) - value) > 0)  input.value  = value;
  _syncing[sliderId] = false;
}

// ── 事件綁定 ────────────────────────────────────────────────────
function bindInputEvents() {
  for (const key of ['lc', 'sc', 'rc', 'rt']) {
    const g = GROUPS[key];

    const slider = document.getElementById(`${key}-slider`);
    const input  = document.getElementById(`${key}-catch`);

    slider.addEventListener('input', () => {
      input.value = slider.value;
      updateSliderBackground(slider, g.color);
      updateUI();
    });

    input.addEventListener('input', () => {
      let v = parseInt(input.value);
      if (isNaN(v)) return;
      v = Math.max(g.min, Math.min(g.max, v));
      input.value  = v;
      slider.value = v;
      updateSliderBackground(slider, g.color);
      updateUI();
    });

    input.addEventListener('blur', () => {
      let v = parseInt(input.value);
      if (isNaN(v) || v < g.min) { input.value = g.min; slider.value = g.min; }
      else if (v > g.max)        { input.value = g.max; slider.value = g.max; }
      updateUI();
    });

    // Initial gradient
    updateSliderBackground(slider, g.color);
  }
}

function updateSliderBackground(slider, color) {
  const min = parseInt(slider.min);
  const max = parseInt(slider.max);
  const val = parseInt(slider.value);
  const pct = ((val - min) / (max - min)) * 100;
  slider.style.background =
    `linear-gradient(to right, ${color} 0%, ${color} ${pct}%, rgba(255,255,255,0.12) ${pct}%, rgba(255,255,255,0.12) 100%)`;
}

// ── 重置為現況 ──────────────────────────────────────────────────
function resetToDefault() {
  for (const key of ['lc', 'sc', 'rc', 'rt']) {
    const g = GROUPS[key];
    document.getElementById(`${key}-catch`).value  = g.current;
    document.getElementById(`${key}-slider`).value = g.current;
    const slider = document.getElementById(`${key}-slider`);
    updateSliderBackground(slider, g.color);
  }
  updateUI();
  document.getElementById('optimization-section').style.display = 'none';
}

// ── 切換總量限制模式 ─────────────────────────────────────────────
function toggleLimitMode() {
  limitMode = !limitMode;
  const btn      = document.getElementById('btn-mode-toggle');
  const icon     = document.getElementById('mode-toggle-icon');
  const text     = document.getElementById('mode-toggle-text');
  const hintOff  = document.getElementById('mode-hint-off');
  const hintOn   = document.getElementById('mode-hint-on');

  if (limitMode) {
    btn.classList.add('active');
    icon.textContent = '🔒';
    text.textContent = '2,500 公噸總量上限（已啟用）';
    hintOff.style.display = 'none';
    hintOn.style.display  = '';
  } else {
    btn.classList.remove('active');
    icon.textContent = '🔓';
    text.textContent = '無總量限制（預設）';
    hintOff.style.display = '';
    hintOn.style.display  = 'none';
    document.getElementById('warning-banner').style.display = 'none';
  }
  updateUI();
}

// ══════════════════════════════════════════════════════════════
// CHART.JS 圖表初始化
// ══════════════════════════════════════════════════════════════
let barChart, currentPieChart, newPieChart, sensitivityChart;
let optCompareChart;

const CHART_DEFAULTS = {
  color: '#8b9cbf',
  borderColor: 'rgba(255,255,255,0.08)',
  font: { family: "'Inter', 'Noto Sans TC', sans-serif", size: 12 }
};

Chart.defaults.color = CHART_DEFAULTS.color;
Chart.defaults.borderColor = CHART_DEFAULTS.borderColor;
Chart.defaults.font = CHART_DEFAULTS.font;

const GROUP_COLORS = ['#38bdf8', '#a78bfa', '#34d399', '#fb923c'];
const GROUP_LABELS = ['LC 大型商業', 'SC 小型商業', 'RC 休閒比賽', 'RT 休閒旅遊'];

function initCharts() {
  // 1. NPV 橫條圖
  barChart = new Chart(document.getElementById('npvBarChart'), {
    type: 'bar',
    data: {
      labels: GROUP_LABELS,
      datasets: [{
        label: '淨現值 (NPV)',
        data: [0, 0, 0, 0],
        backgroundColor: GROUP_COLORS.map(c => c + 'aa'),
        borderColor: GROUP_COLORS,
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ' NPV: ' + fmtNPV(ctx.raw)
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { callback: v => fmtNPV(v) }
        },
        y: { grid: { display: false } }
      }
    }
  });

  // 2. 目前分配圓餅
  const currentData = Object.values(GROUPS).map(g => g.current);
  currentPieChart = new Chart(document.getElementById('catchCurrentPie'), {
    type: 'doughnut',
    data: {
      labels: GROUP_LABELS,
      datasets: [{
        data: currentData,
        backgroundColor: GROUP_COLORS.map(c => c + 'cc'),
        borderColor: 'rgba(0,0,0,0.3)',
        borderWidth: 2,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, padding: 8, font: { size: 11 } } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw} 公噸` } }
      }
    }
  });

  // 3. 明年分配圓餅
  newPieChart = new Chart(document.getElementById('catchNewPie'), {
    type: 'doughnut',
    data: {
      labels: GROUP_LABELS,
      datasets: [{
        data: [2000, 1500, 1000, 500],
        backgroundColor: GROUP_COLORS.map(c => c + 'cc'),
        borderColor: 'rgba(0,0,0,0.3)',
        borderWidth: 2,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, padding: 8, font: { size: 11 } } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw} 公噸` } }
      }
    }
  });

  // 4. 敏感度分析折線圖 — 未來捕撈量 0~2500 各協會 NPV 趨勢
  buildSensitivityChart();
}

function buildSensitivityChart() {
  const futurePts = [];
  for (let f = 0; f <= 2500; f += 50) futurePts.push(f);

  // 使用各方目前捕撈量為基準，只改變未來捕撈量以展示係數影響
  const groupKeys = ['lc', 'sc', 'rc', 'rt'];
  const datasets = groupKeys.map((key, i) => {
    const g = GROUPS[key];
    return {
      label: g.abbr + ' ' + g.name,
      data: futurePts.map(f => 10000 * (g.current + g.coeff * f)),
      borderColor: g.color,
      backgroundColor: g.color + '22',
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.4,
      fill: false
    };
  });

  sensitivityChart = new Chart(document.getElementById('sensitivityChart'), {
    type: 'line',
    data: { labels: futurePts, datasets },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, padding: 10, font: { size: 11 } } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmtNPV(ctx.raw)}` } }
      },
      scales: {
        x: {
          title: { display: true, text: '未來捕撈量 (公噸)', color: '#8b9cbf' },
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { maxTicksLimit: 10 }
        },
        y: {
          title: { display: true, text: 'NPV (USD)', color: '#8b9cbf' },
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { callback: v => fmtNPV(v) }
        }
      }
    }
  });
}

// ── 更新圖表資料 ─────────────────────────────────────────────────
function updateCharts(catches, npvs, future) {
  // Bar chart
  barChart.data.datasets[0].data = [npvs.lc, npvs.sc, npvs.rc, npvs.rt];
  barChart.update('none');  // 'none' = no animation for real-time feel

  // New catch pie
  newPieChart.data.datasets[0].data = [catches.lc, catches.sc, catches.rc, catches.rt];
  newPieChart.update('none');
}

// ══════════════════════════════════════════════════════════════
// 最佳化：窮舉法尋找最大化淨現值總和的合法組合
// 步長 50 公噸以確保速度 (可調整)
// ══════════════════════════════════════════════════════════════
let optimalSolution = null;

function runOptimization() {
  const btn = document.getElementById('btn-optimize');
  btn.textContent = '⏳ 計算中…';
  btn.disabled = true;

  // Snapshot the mode at time of run
  const runningInLimitMode = limitMode;

  // Defer to next tick so UI can update
  setTimeout(() => {
    const STEP = 50; // 步長
    let bestTotal = -Infinity;
    let best = null;

    const lcRange = range(GROUPS.lc.min, GROUPS.lc.max, STEP);
    const scRange = range(GROUPS.sc.min, GROUPS.sc.max, STEP);
    const rcRange = range(GROUPS.rc.min, GROUPS.rc.max, STEP);
    const rtRange = range(GROUPS.rt.min, GROUPS.rt.max, STEP);

    for (const lc of lcRange) {
      for (const sc of scRange) {
        for (const rc of rcRange) {
          for (const rt of rtRange) {
            // ── 總量限制篩選 ──────────────────────────────
            if (runningInLimitMode && (lc + sc + rc + rt) > TOTAL_LIMIT) continue;
            const catches = { lc, sc, rc, rt };
            const { total } = calcAll(catches);
            if (total > bestTotal) {
              bestTotal = total;
              best = { catches, ...calcAll(catches) };
            }
          }
        }
      }
    }

    optimalSolution = best;
    displayOptimization(best, runningInLimitMode);

    btn.textContent = '⚡ 尋找最佳解';
    btn.disabled = false;
  }, 30);
}

function range(min, max, step) {
  const arr = [];
  for (let v = min; v <= max; v += step) arr.push(v);
  if (arr[arr.length - 1] !== max) arr.push(max);
  return arr;
}

function displayOptimization(sol, wasLimitMode) {
  const sec = document.getElementById('optimization-section');
  sec.style.display = 'block';
  sec.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Update mode tag in header
  const tag = document.getElementById('opt-mode-tag');
  const desc = document.getElementById('opt-mode-desc');
  if (wasLimitMode) {
    tag.textContent = '🔒 2,500 公噸總量上限模式';
    tag.className = 'opt-mode-tag';
    desc.textContent = '系統已在總捕撈量 ≤ 2,500 公噸的限制下，搜尋最大化各方淨現值總和的組合';
  } else {
    tag.textContent = '🔓 無總量限制模式';
    tag.className = 'opt-mode-tag free';
    desc.textContent = '系統已透過窮舉法，在所有合法區間搜尋最大化各方淨現值總和的組合';
  }

  const content = document.getElementById('opt-results-content');
  const keys = ['lc', 'sc', 'rc', 'rt'];
  const optTotal = sol.catches.lc + sol.catches.sc + sol.catches.rc + sol.catches.rt;
  let html = '';
  for (const key of keys) {
    const g = GROUPS[key];
    const catchVal = sol.catches[key];
    const reduction = ((g.current - catchVal) / g.current * 100).toFixed(1);
    html += `
      <div class="opt-result-item">
        <div class="opt-result-label" style="color:${g.color}">${g.abbr} ${g.name}</div>
        <div class="opt-result-catch">${fmtTons(catchVal)} <span style="font-size:0.7rem;color:#8b9cbf">(減 ${reduction}%)</span></div>
        <div class="opt-result-npv" style="color:${g.color}">${fmtNPV(sol.npvs[key])}</div>
      </div>`;
  }

  const futureCatch = sol.future;
  const limitNote = wasLimitMode
    ? `<span style="font-size:0.72rem;color:#fb923c;margin-left:6px">（協議總量: ${fmtTons(optTotal)}）</span>`
    : '';
  html += `
    <div class="opt-result-item" style="grid-column:1/-1;background:rgba(56,189,248,0.08);border:1px solid rgba(56,189,248,0.2)">
      <div class="opt-result-label" style="color:#38bdf8">未來捕撈量（計算所得）${limitNote}</div>
      <div class="opt-result-catch" style="color:#38bdf8;font-size:1rem">${fmtTons(futureCatch)}</div>
    </div>
    <div class="opt-total">
      <div class="opt-total-label">🏆 各方淨現值最大總和</div>
      <div class="opt-total-value">${fmtNPV(sol.total)}</div>
    </div>`;

  content.innerHTML = html;

  buildOptCompareChart(sol);
  buildHeatmap(sol);
}

function buildOptCompareChart(sol) {
  if (optCompareChart) { optCompareChart.destroy(); }

  const keys = ['lc', 'sc', 'rc', 'rt'];
  const currentNPVs = keys.map(key => {
    const g = GROUPS[key];
    const currentCatches = { lc: g.current, sc: GROUPS.sc.current, rc: GROUPS.rc.current, rt: GROUPS.rt.current };
    // Recalculate using each group's own current only
    const allCurrent = { lc: GROUPS.lc.current, sc: GROUPS.sc.current, rc: GROUPS.rc.current, rt: GROUPS.rt.current };
    const { future: f } = calcAll(allCurrent);
    return calcNPV(GROUPS[key].current, GROUPS[key].coeff, f);
  });

  const optNPVs = keys.map(key => sol.npvs[key]);

  optCompareChart = new Chart(document.getElementById('optCompareChart'), {
    type: 'bar',
    data: {
      labels: GROUP_LABELS,
      datasets: [
        {
          label: '現況 NPV',
          data: currentNPVs,
          backgroundColor: GROUP_COLORS.map(c => c + '44'),
          borderColor: GROUP_COLORS,
          borderWidth: 2,
          borderRadius: 6,
        },
        {
          label: '最佳解 NPV',
          data: optNPVs,
          backgroundColor: GROUP_COLORS.map(c => c + 'aa'),
          borderColor: GROUP_COLORS,
          borderWidth: 2,
          borderRadius: 6,
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, padding: 10 } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmtNPV(ctx.raw)}` } }
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { callback: v => fmtNPV(v) }
        }
      }
    }
  });
}

// ── 熱圖：LC x SC 組合下的總 NPV（RC、RT 固定為最佳解） ────────────
function buildHeatmap(sol) {
  const rcFixed = sol.catches.rc;
  const rtFixed = sol.catches.rt;

  const STEP = 100;
  const lcVals = range(GROUPS.lc.min, GROUPS.lc.max, STEP);
  const scVals = range(GROUPS.sc.min, GROUPS.sc.max, STEP);

  // Build matrix
  const matrix = lcVals.map(lc =>
    scVals.map(sc => {
      const catches = { lc, sc, rc: rcFixed, rt: rtFixed };
      return calcAll(catches).total;
    })
  );

  const minVal = Math.min(...matrix.flat());
  const maxVal = Math.max(...matrix.flat());

  // Build chart data as scatter points coloured by NPV
  const pointData = [];
  lcVals.forEach((lc, li) => {
    scVals.forEach((sc, si) => {
      const val = matrix[li][si];
      const norm = (val - minVal) / (maxVal - minVal);
      pointData.push({ x: sc, y: lc, v: val, norm });
    });
  });

  const canvas = document.getElementById('heatmapChart');
  canvas.width  = Math.max(500, scVals.length * 30);
  canvas.height = Math.max(300, lcVals.length * 20);

  if (window._heatmapChart) window._heatmapChart.destroy();

  window._heatmapChart = new Chart(canvas, {
    type: 'scatter',
    data: {
      datasets: [{
        label: '總 NPV',
        data: pointData,
        pointRadius: Math.min(14, Math.max(8, 500 / lcVals.length)),
        pointStyle: 'rect',
        backgroundColor: pointData.map(d => heatColor(d.norm)),
        borderWidth: 0,
      }]
    },
    options: {
      responsive: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const d = ctx.raw;
              return [`LC: ${d.y} 公噸`, `SC: ${d.x} 公噸`, `總 NPV: ${fmtNPV(d.v)}`];
            }
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: 'SC 捕撈量 (公噸)', color: '#8b9cbf' },
          grid: { color: 'rgba(255,255,255,0.05)' }
        },
        y: {
          title: { display: true, text: 'LC 捕撈量 (公噸)', color: '#8b9cbf' },
          grid: { color: 'rgba(255,255,255,0.05)' }
        }
      }
    }
  });
}

/** 根據 0-1 標準化值回傳熱圖顏色 */
function heatColor(t) {
  // 深藍 → 青 → 黃 → 橙紅
  if (t < 0.33) {
    const r = Math.round(6 + t / 0.33 * (34 - 6));
    const g = Math.round(11 + t / 0.33 * (211 - 11));
    const b = Math.round(26 + t / 0.33 * (153 - 26));
    return `rgba(${r},${g},${b},0.85)`;
  } else if (t < 0.67) {
    const tt = (t - 0.33) / 0.34;
    const r = Math.round(34 + tt * (251 - 34));
    const g = Math.round(211 + tt * (191 - 211));
    const b = Math.round(153 + tt * (36 - 153));
    return `rgba(${r},${g},${b},0.85)`;
  } else {
    const tt = (t - 0.67) / 0.33;
    const r = Math.round(251 + tt * (239 - 251));
    const g = Math.round(191 - t * 150);
    const b = Math.round(36 - t * 36);
    return `rgba(${Math.min(255,r)},${Math.max(0,g)},${Math.max(0,b)},0.85)`;
  }
}

// ── 套用最佳解到輸入面板 ────────────────────────────────────────
function applyOptimalSolution() {
  if (!optimalSolution) return;
  const sol = optimalSolution;
  for (const key of ['lc', 'sc', 'rc', 'rt']) {
    const val = sol.catches[key];
    document.getElementById(`${key}-catch`).value  = val;
    document.getElementById(`${key}-slider`).value = val;
    updateSliderBackground(document.getElementById(`${key}-slider`), GROUPS[key].color);
  }
  updateUI();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── 初始化 ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  bindInputEvents();
  initCharts();
  updateUI();
});
