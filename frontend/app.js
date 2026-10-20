/**
 * AICTE ICMD - Frontend Client Application
 * Self-contained, resilient to CDN blocking, supports both desktop and smartphone views.
 */

// Application State
const state = {
  currentRole: 'admin',
  activeTab: 'dashboard',
  cases: [],
  filteredCases: [],
  stats: {},
  overlaps: [],
  institutions: [],
  selectedCaseId: null,
  linkTargetCasePair: null,
  charts: {
    bureau: null,
    category: null,
    ageing: null
  },
  searchDebounceTimer: null,
  overlapDebounceTimer: null
};

// Official Role Profiles
const ROLES = {
  admin: {
    name: 'Dr. Mamidala Jagadesh',
    bureau: 'AICTE Headquarters',
    desc: 'Full Administrative Oversight across Regulation Bureau (RB), PGRC, and Regional Offices',
    filterBureau: 'All'
  },
  rb: {
    name: 'Dr. R. K. Sharma',
    bureau: 'Regulation Bureau (RB)',
    desc: 'Authorized Officer: Institution Approvals, Infrastructure Norms & Regulatory Scrutiny',
    filterBureau: 'Regulation'
  },
  pgrc: {
    name: 'Prof. Ananya Sen',
    bureau: 'Public Grievance Redressal Cell (PGRC)',
    desc: 'Authorized Officer: Student Grievances, Faculty Welfare & Fee Disputes',
    filterBureau: 'Grievance'
  },
  ro: {
    name: 'Er. M. Venkatesh',
    bureau: 'Regional Office (RO-South)',
    desc: 'Authorized Officer: On-ground Scrutiny, Regional Coordination & Physical Inspections',
    filterBureau: 'Regional'
  }
};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadInitialData();
  setupRoleInterface();
});

async function loadInitialData() {
  try {
    await Promise.all([
      fetchStats(),
      fetchCases(),
      fetchOverlaps(),
      fetchInstitutions()
    ]);
  } catch (err) {
    console.error('Error loading initial data:', err);
    showToast('Notice: Live data loaded with offline fallback', 'warning');
  }
}

// Fetch APIs
async function fetchStats() {
  try {
    const res = await fetch('/api/stats');
    state.stats = await res.json();
    renderStats();
    renderCharts();
  } catch (e) {
    console.warn('Stats fetch error:', e);
  }
}

async function fetchCases() {
  try {
    const res = await fetch('/api/cases');
    state.cases = await res.json();
    applyFilters();
  } catch (e) {
    console.warn('Cases fetch error:', e);
  }
}

async function fetchOverlaps() {
  try {
    const res = await fetch('/api/overlaps');
    state.overlaps = await res.json();
    renderOverlaps();
    updateAlertTicker();
  } catch (e) {
    console.warn('Overlaps fetch error:', e);
  }
}

async function fetchInstitutions() {
  try {
    const res = await fetch('/api/institutions');
    state.institutions = await res.json();
    populateInstitutionDropdown();
  } catch (e) {
    console.warn('Institutions fetch error:', e);
  }
}

// Tab Switching
function switchTab(tabName) {
  state.activeTab = tabName;
  
  // Hide all tab panes
  document.querySelectorAll('.tab-pane').forEach(el => {
    el.style.display = 'none';
  });
  
  // Show target tab
  const target = document.getElementById(`tab-${tabName}`);
  if (target) target.style.display = 'block';

  // Desktop tab button active state
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  const activeBtn = document.getElementById(`nav-tab-${tabName}`);
  if (activeBtn) activeBtn.classList.add('active');

  // Mobile bottom nav active state
  document.querySelectorAll('.mobile-nav-item').forEach(btn => {
    btn.classList.remove('active');
  });
  const mobBtn = document.getElementById(`mob-nav-${tabName}`);
  if (mobBtn) mobBtn.classList.add('active');

  if (tabName === 'dashboard') {
    renderCharts();
  } else if (tabName === 'sla') {
    renderSLAMonitor();
  } else if (tabName === 'reports') {
    renderReportsView();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// RBAC Role Change
function changeUserRole(roleKey) {
  state.currentRole = roleKey;
  setupRoleInterface();
  showToast(`Switched profile to ${ROLES[roleKey].name}`);
}

function setupRoleInterface() {
  const role = ROLES[state.currentRole];
  document.getElementById('active-user-name').innerText = role.name;
  document.getElementById('active-bureau-badge').innerText = role.bureau;
  document.getElementById('active-user-desc').innerText = role.desc;

  const officerInput = document.getElementById('intake-officer');
  if (officerInput) officerInput.value = role.name;

  const bureauSelect = document.getElementById('filter-bureau');
  if (bureauSelect) {
    bureauSelect.value = role.filterBureau;
    applyFilters();
  }
}

// Render Stats & Badges
function renderStats() {
  const s = state.stats;
  document.getElementById('stat-total').innerText = s.total_cases || 0;
  document.getElementById('stat-pending').innerText = s.pending_cases || 0;
  document.getElementById('stat-overdue').innerText = s.overdue_cases || 0;
  document.getElementById('stat-disposed').innerText = s.disposed_cases || 0;
  document.getElementById('stat-overlaps').innerText = s.unresolved_overlaps || 0;

  document.getElementById('badge-total-cases').innerText = s.total_cases || 0;

  const overlapCount = s.unresolved_overlaps || 0;
  document.getElementById('badge-overlap-count').innerText = overlapCount;

  const overdueCount = s.overdue_cases || 0;
  document.getElementById('badge-overdue-count').innerText = overdueCount;

  const bannerBox = document.getElementById('overlap-banner-box');
  if (overlapCount > 0) {
    bannerBox.style.display = 'flex';
  } else {
    bannerBox.style.display = 'none';
  }
}

// Alert Ticker in Topbar
function updateAlertTicker() {
  const ticker = document.getElementById('ticker-text');
  const activeOverlaps = state.overlaps.filter(o => !o.is_coordinated);
  if (activeOverlaps.length > 0) {
    const first = activeOverlaps[0];
    ticker.innerHTML = `⚠️ Coordination Alert: <strong>${first.institution_name}</strong> active across ${first.bureau_1} & ${first.bureau_2}`;
  } else {
    ticker.innerHTML = `All cross-bureau institutional cases synchronized`;
  }
}

// Render Charts with Fallback
function renderCharts() {
  const s = state.stats;
  if (!s.bureau_breakdown) return;

  // Check if Chart.js is available
  if (typeof Chart === 'undefined' || window.chartJsUnavailable) {
    renderCanvasFallbackCharts(s);
    return;
  }

  try {
    // 1. Bureau Caseload Donut
    const bureauCtx = document.getElementById('bureauChart')?.getContext('2d');
    if (bureauCtx) {
      if (state.charts.bureau) state.charts.bureau.destroy();
      const bLabels = Object.keys(s.bureau_breakdown);
      const bValues = Object.values(s.bureau_breakdown);
      state.charts.bureau = new Chart(bureauCtx, {
        type: 'doughnut',
        data: {
          labels: bLabels.map(l => l.replace('Regulation Bureau', 'RB').replace('Public Grievance Redressal Cell', 'PGRC')),
          datasets: [{
            data: bValues,
            backgroundColor: ['#134074', '#f58220', '#107c41', '#8b5cf6', '#0284c7'],
            borderWidth: 2,
            borderColor: '#ffffff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } }
          },
          cutout: '65%'
        }
      });
    }

    // 2. Category Horizontal Bar
    const catCtx = document.getElementById('categoryChart')?.getContext('2d');
    if (catCtx) {
      if (state.charts.category) state.charts.category.destroy();
      const cLabels = Object.keys(s.category_breakdown || {});
      const cValues = Object.values(s.category_breakdown || {});
      state.charts.category = new Chart(catCtx, {
        type: 'bar',
        data: {
          labels: cLabels.map(c => c.length > 16 ? c.substring(0, 16) + '...' : c),
          datasets: [{
            label: 'Complaints',
            data: cValues,
            backgroundColor: '#134074',
            borderRadius: 4
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { stepSize: 1, font: { size: 9 } } },
            y: { ticks: { font: { size: 9 } } }
          }
        }
      });
    }

    // 3. Ageing Profile Bar
    const ageingCtx = document.getElementById('ageingChart')?.getContext('2d');
    if (ageingCtx) {
      if (state.charts.ageing) state.charts.ageing.destroy();
      const aLabels = Object.keys(s.ageing_breakdown || {});
      const aValues = Object.values(s.ageing_breakdown || {});
      state.charts.ageing = new Chart(ageingCtx, {
        type: 'bar',
        data: {
          labels: aLabels,
          datasets: [{
            label: 'Active Cases',
            data: aValues,
            backgroundColor: ['#107c41', '#3b82f6', '#f59e0b', '#dc2626'],
            borderRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { ticks: { stepSize: 1, font: { size: 9 } } },
            x: { ticks: { font: { size: 9 } } }
          }
        }
      });
    }
  } catch (err) {
    console.warn('Chart.js render error, using canvas fallback:', err);
    renderCanvasFallbackCharts(s);
  }
}

// Fallback HTML5 Canvas Chart Drawer (Zero dependencies)
function renderCanvasFallbackCharts(s) {
  function drawBarChart(canvasId, labels, values, colors) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.parentElement.clientWidth || 300;
    canvas.height = 200;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const maxVal = Math.max(...values, 1);
    const barWidth = Math.min(40, (canvas.width - 60) / values.length);
    const chartHeight = canvas.height - 40;

    values.forEach((val, i) => {
      const h = (val / maxVal) * (chartHeight - 20);
      const x = 40 + i * (barWidth + 15);
      const y = chartHeight - h;

      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(x, y, barWidth, h);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(val, x + barWidth / 2, y - 5);

      ctx.fillStyle = '#64748b';
      ctx.font = '10px sans-serif';
      const label = labels[i]?.substring(0, 8) || '';
      ctx.fillText(label, x + barWidth / 2, chartHeight + 15);
    });
  }

  if (s.bureau_breakdown) {
    drawBarChart('bureauChart', Object.keys(s.bureau_breakdown), Object.values(s.bureau_breakdown), ['#134074', '#f58220', '#107c41', '#8b5cf6']);
  }
  if (s.category_breakdown) {
    drawBarChart('categoryChart', Object.keys(s.category_breakdown), Object.values(s.category_breakdown), ['#134074', '#2563eb', '#f59e0b', '#dc2626']);
  }
  if (s.ageing_breakdown) {
    drawBarChart('ageingChart', Object.keys(s.ageing_breakdown), Object.values(s.ageing_breakdown), ['#107c41', '#3b82f6', '#f59e0b', '#dc2626']);
  }
}

// Search & Filter
function handleSearchDebounce() {
  clearTimeout(state.searchDebounceTimer);
  state.searchDebounceTimer = setTimeout(() => {
    applyFilters();
  }, 250);
}

function applyFilters() {
  const searchTerm = (document.getElementById('case-search-input')?.value || '').toLowerCase().trim();
  const bureauFilter = document.getElementById('filter-bureau')?.value || 'All';
  const statusFilter = document.getElementById('filter-status')?.value || 'All';
  const overlapFilter = document.getElementById('filter-overlap')?.value || 'All';
  const slaFilter = document.getElementById('filter-sla')?.value || 'All';

  state.filteredCases = state.cases.filter(c => {
    if (searchTerm) {
      const haystack = `${c.case_id} ${c.aicte_permanent_id} ${c.institution_name} ${c.city} ${c.assigned_officer} ${c.subject}`.toLowerCase();
      if (!haystack.includes(searchTerm)) return false;
    }

    if (bureauFilter !== 'All') {
      if (!c.bureau.toLowerCase().includes(bureauFilter.toLowerCase())) return false;
    }

    if (statusFilter !== 'All') {
      if (statusFilter === 'Overdue' && c.sla_condition !== 'Breached') return false;
      else if (statusFilter !== 'Overdue' && c.status !== statusFilter) return false;
    }

    if (overlapFilter === 'OverlapOnly' && !c.has_overlap) return false;

    if (slaFilter !== 'All' && c.sla_condition !== slaFilter) return false;

    return true;
  });

  renderDesktopTable();
  renderMobileCards();
}

// Render Desktop Data Table
function renderDesktopTable() {
  const tbody = document.getElementById('case-table-body');
  if (!tbody) return;

  if (state.filteredCases.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 30px; color: var(--text-muted);">
          No complaints match the selected filter criteria.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = state.filteredCases.map(c => {
    let statusPillClass = 'pill-pending';
    if (c.status === 'Under Review') statusPillClass = 'pill-review';
    else if (c.status === 'Disposed') statusPillClass = 'pill-disposed';
    else if (c.status === 'Transferred') statusPillClass = 'pill-transferred';

    let slaClass = 'pill-healthy';
    let slaText = `${c.sla_days_left}d left`;
    if (c.status === 'Disposed') {
      slaClass = 'pill-disposed';
      slaText = 'Resolved';
    } else if (c.sla_condition === 'Breached') {
      slaClass = 'pill-breached';
      slaText = `Breached (${Math.abs(c.sla_days_left)}d)`;
    } else if (c.sla_condition === 'Due Soon') {
      slaClass = 'pill-pending';
      slaText = `Due in ${c.sla_days_left}d`;
    }

    let overlapPill = '<span style="color: var(--text-light);">—</span>';
    if (c.has_overlap) {
      if (c.linked_case_id) {
        overlapPill = `
          <span class="pill pill-overlap-linked">
            🔗 Linked (${c.linked_case_id})
          </span>
        `;
      } else {
        overlapPill = `
          <button onclick="switchTab('overlaps')" class="pill pill-overlap-alert">
            ⚡ Action Required
          </button>
        `;
      }
    }

    let bureauShort = 'RO';
    if (c.bureau.includes('Regulation')) bureauShort = 'RB';
    else if (c.bureau.includes('Grievance')) bureauShort = 'PGRC';

    return `
      <tr>
        <td style="white-space: nowrap;">
          <a href="javascript:void(0)" onclick="openCaseDetail('${c.case_id}')" style="font-weight: 800; font-family: monospace; color: var(--primary-light); text-decoration: none;">
            ${c.case_id} ↗
          </a>
          <div style="font-size: 11px; color: var(--text-muted);">${c.filing_date.split(' ')[0]}</div>
        </td>
        <td>
          <div style="font-weight: 700; color: var(--text-main);">${c.institution_name}</div>
          <div style="font-size: 11px; color: var(--text-muted); font-family: monospace;">PID: ${c.aicte_permanent_id} • ${c.city}, ${c.state}</div>
        </td>
        <td style="white-space: nowrap;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="background: #eff6ff; color: #1e40af; font-size: 10px; font-weight: 800; padding: 1px 5px; border-radius: 4px; border: 1px solid #bfdbfe;">${bureauShort}</span>
            <strong style="font-size: 12px;">${c.assigned_officer}</strong>
          </div>
          <div style="font-size: 11px; color: var(--text-muted);">${c.officer_designation}</div>
        </td>
        <td style="max-width: 240px;">
          <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 600;" title="${c.subject}">${c.subject}</div>
          <div style="font-size: 11px; color: var(--text-muted);">${c.category} • ${c.complainant_type}</div>
        </td>
        <td style="text-align: center; white-space: nowrap;">
          <span class="pill ${statusPillClass}">${c.status}</span>
        </td>
        <td style="text-align: center; white-space: nowrap;">
          <span class="pill ${slaClass}">${slaText}</span>
        </td>
        <td style="text-align: center; white-space: nowrap;">
          ${overlapPill}
        </td>
        <td style="text-align: right; white-space: nowrap;">
          <button onclick="openCaseDetail('${c.case_id}')" class="btn-secondary" style="font-size: 11px; padding: 4px 8px;">
            Inspect
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// Render Mobile Cards (optimized for phones)
function renderMobileCards() {
  const container = document.getElementById('case-mobile-cards');
  if (!container) return;

  if (state.filteredCases.length === 0) {
    container.innerHTML = `
      <div class="mobile-case-card" style="text-align: center; color: var(--text-muted); padding: 24px;">
        No cases match your filter criteria.
      </div>
    `;
    return;
  }

  container.innerHTML = state.filteredCases.map(c => {
    let statusPillClass = 'pill-pending';
    if (c.status === 'Under Review') statusPillClass = 'pill-review';
    else if (c.status === 'Disposed') statusPillClass = 'pill-disposed';

    let slaClass = 'pill-healthy';
    let slaText = `${c.sla_days_left}d left`;
    if (c.status === 'Disposed') {
      slaClass = 'pill-disposed';
      slaText = 'Resolved';
    } else if (c.sla_condition === 'Breached') {
      slaClass = 'pill-breached';
      slaText = `Breached (${Math.abs(c.sla_days_left)}d)`;
    }

    return `
      <div class="mobile-case-card" onclick="openCaseDetail('${c.case_id}')">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 6px; margin-bottom: 8px;">
          <span style="font-family: monospace; font-weight: 800; color: var(--primary-light);">${c.case_id}</span>
          <div style="display: flex; gap: 4px;">
            <span class="pill ${statusPillClass}">${c.status}</span>
            <span class="pill ${slaClass}">${slaText}</span>
          </div>
        </div>

        <div style="font-weight: 800; font-size: 14px; color: var(--text-main);">${c.institution_name}</div>
        <div style="font-size: 11px; color: var(--text-muted); font-family: monospace; margin-top: 2px;">PID: ${c.aicte_permanent_id} • ${c.city}</div>

        <div style="background-color: #f8fafc; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 8px; margin: 8px 0; font-size: 12px; color: var(--text-main);">
          ${c.subject}
        </div>

        ${c.has_overlap ? `
          <div style="background-color: var(--red-bg); border: 1px solid #fecaca; color: var(--red); padding: 6px 8px; border-radius: var(--radius-sm); font-size: 11px; font-weight: 800; display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span>⚠️ Potential Cross-Bureau Overlap</span>
            <span>Review &rarr;</span>
          </div>
        ` : ''}

        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: var(--text-muted); border-top: 1px solid var(--border); padding-top: 6px;">
          <span>${c.bureau.split('(')[0].trim()} • ${c.assigned_officer}</span>
          <span style="color: var(--primary-light); font-weight: 700;">Details &rarr;</span>
        </div>
      </div>
    `;
  }).join('');
}

// Render Overlap Coordination Center (TAB 3)
function renderOverlaps() {
  const container = document.getElementById('overlap-comparison-container');
  const countBadge = document.getElementById('coordination-count-badge');
  const dashboardOverlapList = document.getElementById('dashboard-overlap-list');
  if (!container) return;

  const pendingOverlaps = state.overlaps.filter(o => !o.is_coordinated);
  if (countBadge) countBadge.innerText = `${pendingOverlaps.length} Action Required`;

  // Render on Dashboard feed too
  if (dashboardOverlapList) {
    if (state.overlaps.length === 0) {
      dashboardOverlapList.innerHTML = `<div style="padding: 16px; font-size: 12px; color: var(--text-muted);">No active overlaps detected across bureaus.</div>`;
    } else {
      dashboardOverlapList.innerHTML = state.overlaps.slice(0, 3).map(o => `
        <div style="padding: 12px 16px; border-bottom: 1px solid var(--border); display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 36px; height: 36px; border-radius: var(--radius-full); background: ${o.is_coordinated ? '#eff6ff' : 'var(--red-bg)'}; color: ${o.is_coordinated ? 'var(--blue)' : 'var(--red)'}; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 11px;">
              ${o.overlap_score?.toFixed(0) || 95}%
            </div>
            <div>
              <div style="font-weight: 800; font-size: 13px;">${o.institution_name}</div>
              <div style="font-size: 11px; color: var(--text-muted); font-family: monospace;">PID: ${o.pid} • Concurrent: ${o.bureau_1} & ${o.bureau_2}</div>
            </div>
          </div>
          <div>
            ${o.is_coordinated ? `
              <span class="pill pill-healthy">🔗 Coordinated Joint Action</span>
            ` : `
              <button onclick="openLinkOverlapModal('${o.case_id_1}', '${o.case_id_2}')" class="btn-primary" style="font-size: 11px; padding: 4px 10px;">
                Coordinate Joint Action
              </button>
            `}
          </div>
        </div>
      `).join('');
    }
  }

  // Render Overlap Tab Comparison Cards
  if (state.overlaps.length === 0) {
    container.innerHTML = `
      <div style="background-color: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 36px; text-align: center;">
        <div style="font-size: 32px; margin-bottom: 8px;">✅</div>
        <h4 style="font-weight: 800; font-size: 16px; color: var(--text-main);">All Offices in Sync</h4>
        <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">No concurrent or conflicting institutional complaints detected across AICTE bureaus.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = state.overlaps.map(o => `
    <div class="overlap-card ${o.is_coordinated ? 'is-coordinated' : ''}">
      
      <div class="overlap-card-header">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span class="overlap-score-pill">
            ${o.overlap_score ? o.overlap_score.toFixed(1) + '%' : '96.5%'} MATCH CONFIDENCE
          </span>
          <div>
            <h4 style="font-weight: 900; font-size: 15px; color: var(--text-main);">${o.institution_name}</h4>
            <div style="font-size: 11px; color: var(--text-muted); font-family: monospace;">AICTE Permanent ID: <strong>${o.pid}</strong></div>
          </div>
        </div>

        <div style="display: flex; gap: 8px; align-items: center;">
          ${o.is_coordinated ? `
            <span class="pill pill-healthy" style="padding: 6px 12px; font-size: 12px;">
              ✅ Lead Bureau: ${o.lead_bureau || 'Regulation Bureau (RB)'}
            </span>
          ` : `
            <button onclick="openLinkOverlapModal('${o.case_id_1}', '${o.case_id_2}')" class="btn-primary" style="font-size: 12px;">
              🔗 Link Cases & Agree Strategy
            </button>
            <button onclick="dismissOverlapAlert('${o.case_id_1}', '${o.case_id_2}')" class="btn-secondary" style="font-size: 12px;">
              Dismiss (Distinct)
            </button>
          `}
        </div>
      </div>

      <div class="overlap-reasons-bar">
        <strong style="color: var(--text-main);">Detection Criteria:</strong>
        ${(o.reasons || ['Identical AICTE Permanent ID', 'Concurrent Cross-Bureau Jurisdiction']).map(r => `
          <span class="overlap-reason-tag">🏷️ ${r}</span>
        `).join('')}
      </div>

      <div class="overlap-comparison-split">
        
        <!-- Office 1 -->
        <div class="comparison-pane">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-family: monospace; font-weight: 800; font-size: 14px; color: var(--primary);">${o.case_id_1}</span>
            <span class="pill pill-review">${o.bureau_1}</span>
          </div>
          <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 6px;">Assigned Officer: <strong>${o.officer_1}</strong></div>
          <div style="background-color: #ffffff; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px; font-size: 12px; margin-bottom: 8px;">
            <div style="font-weight: 700; color: var(--text-muted); font-size: 11px; margin-bottom: 2px;">Subject / Allegation:</div>
            ${o.subject_1}
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px;">
            <span>Status: <strong>${o.status_1}</strong></span>
            <button onclick="openCaseDetail('${o.case_id_1}')" style="background: none; border: none; color: var(--primary-light); font-weight: 700; cursor: pointer;">Inspect Case 1 &rarr;</button>
          </div>
        </div>

        <!-- Office 2 -->
        <div class="comparison-pane">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-family: monospace; font-weight: 800; font-size: 14px; color: var(--primary);">${o.case_id_2}</span>
            <span class="pill pill-pending">${o.bureau_2}</span>
          </div>
          <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 6px;">Assigned Officer: <strong>${o.officer_2}</strong></div>
          <div style="background-color: #ffffff; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px; font-size: 12px; margin-bottom: 8px;">
            <div style="font-weight: 700; color: var(--text-muted); font-size: 11px; margin-bottom: 2px;">Subject / Allegation:</div>
            ${o.subject_2}
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px;">
            <span>Status: <strong>${o.status_2}</strong></span>
            <button onclick="openCaseDetail('${o.case_id_2}')" style="background: none; border: none; color: var(--primary-light); font-weight: 700; cursor: pointer;">Inspect Case 2 &rarr;</button>
          </div>
        </div>

      </div>

    </div>
  `).join('');
}

// Render SLA Monitor (TAB 4)
function renderSLAMonitor() {
  const container = document.getElementById('overdue-cases-list');
  if (!container) return;

  const overdueCases = state.cases.filter(c => c.sla_condition === 'Breached' || c.sla_condition === 'Due Soon');
  
  if (overdueCases.length === 0) {
    container.innerHTML = `
      <div style="padding: 30px; text-align: center; color: var(--text-muted);">
        All institutional complaints are within statutory 30-day timeline.
      </div>
    `;
    return;
  }

  container.innerHTML = overdueCases.map(c => `
    <div style="padding: 14px 16px; border-bottom: 1px solid #fee2e2; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 10px;">
      <div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-family: monospace; font-weight: 800; font-size: 13px;">${c.case_id}</span>
          <span class="pill ${c.sla_condition === 'Breached' ? 'pill-breached' : 'pill-pending'}">
            ${c.sla_condition === 'Breached' ? `BREACHED (${Math.abs(c.sla_days_left)} DAYS OVERDUE)` : `DUE IN ${c.sla_days_left} DAYS`}
          </span>
          <span style="font-size: 11px; color: var(--text-muted);">${c.bureau}</span>
        </div>
        <div style="font-weight: 800; font-size: 14px; margin-top: 4px;">${c.institution_name}</div>
        <div style="font-size: 12px; color: #475569; margin-top: 2px;">${c.subject}</div>
        <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Assigned: ${c.assigned_officer} • Statutory Deadline: ${c.due_date}</div>
      </div>
      <div style="display: flex; gap: 8px;">
        <button onclick="openCaseDetail('${c.case_id}')" class="btn-secondary" style="font-size: 12px;">Audit Trail</button>
        <button onclick="openRecordActionModalWithCase('${c.case_id}')" class="btn-danger">Urgent Action</button>
      </div>
    </div>
  `).join('');
}

// Render Reports View (TAB 5)
function renderReportsView() {
  const table = document.getElementById('report-overlap-table');
  const genDate = document.getElementById('report-gen-date');
  if (genDate) genDate.innerText = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  document.getElementById('report-stat-total').innerText = state.stats.total_cases || 0;
  document.getElementById('report-stat-active').innerText = state.stats.pending_cases || 0;
  document.getElementById('report-stat-overlaps').innerText = state.overlaps.length || 0;
  const rate = state.stats.total_cases ? Math.round((state.stats.disposed_cases / state.stats.total_cases) * 100) : 0;
  document.getElementById('report-stat-rate').innerText = `${rate}%`;

  if (table) {
    table.innerHTML = state.overlaps.map(o => `
      <tr>
        <td style="font-family: monospace; font-weight: 800;">${o.pid}</td>
        <td style="font-weight: 800;">${o.institution_name}</td>
        <td>${o.bureau_1} &amp; ${o.bureau_2}</td>
        <td style="font-weight: 700; color: var(--primary);">${o.lead_bureau || 'Pending Determination'}</td>
        <td>
          <span class="pill ${o.is_coordinated ? 'pill-healthy' : 'pill-breached'}">
            ${o.is_coordinated ? 'Coordinated' : 'Coordination Required'}
          </span>
        </td>
      </tr>
    `).join('');
  }
}

// Case Detail Modal
async function openCaseDetail(caseId) {
  state.selectedCaseId = caseId;
  try {
    const res = await fetch(`/api/cases/${caseId}`);
    if (!res.ok) throw new Error('Case not found');
    const c = await res.json();

    document.getElementById('detail-case-id').innerText = c.case_id;
    document.getElementById('detail-inst-name').innerText = c.institution_name;
    document.getElementById('detail-inst-meta').innerText = `AICTE PID: ${c.aicte_permanent_id} • ${c.city}, ${c.state} • Filed: ${c.filing_date}`;
    document.getElementById('detail-bureau').innerText = c.bureau;
    document.getElementById('detail-officer').innerText = `${c.assigned_officer} (${c.officer_designation})`;
    document.getElementById('detail-complainant').innerText = `${c.complainant_name} (${c.complainant_type})`;
    document.getElementById('detail-subject').innerText = c.subject;
    document.getElementById('detail-description').innerText = c.description;

    const statusPill = document.getElementById('detail-status-pill');
    statusPill.innerText = c.status;
    statusPill.className = `pill ${c.status === 'Disposed' ? 'pill-disposed' : 'pill-review'}`;

    const slaPill = document.getElementById('detail-sla-pill');
    slaPill.innerText = c.sla_condition === 'Breached' ? `SLA Breached (${Math.abs(c.sla_days_left)}d overdue)` : `${c.sla_days_left} Days Left`;
    slaPill.className = `pill ${c.sla_condition === 'Breached' ? 'pill-breached' : 'pill-healthy'}`;

    const alertBox = document.getElementById('detail-overlap-alert');
    const alertBtn = document.getElementById('detail-resolve-overlap-btn');
    if (c.has_overlap && c.potential_overlaps && c.potential_overlaps.length > 0) {
      alertBox.style.display = 'block';
      const topMatch = c.potential_overlaps[0];
      document.getElementById('detail-overlap-text').innerHTML = `
        Potential Overlap with Case <strong>${topMatch.candidate_case_id}</strong> (${topMatch.bureau}). 
        Similarity score: <strong>${topMatch.overlap_score}%</strong>. Reasons: ${topMatch.reasons.join(', ')}
      `;
      alertBtn.onclick = () => {
        closeCaseDetailModal();
        openLinkOverlapModal(c.case_id, topMatch.candidate_case_id);
      };
    } else {
      alertBox.style.display = 'none';
    }

    const timelineContainer = document.getElementById('detail-timeline-container');
    if (c.timeline && c.timeline.length > 0) {
      timelineContainer.innerHTML = c.timeline.map(step => `
        <div class="timeline-stem-item">
          <div class="timeline-dot"></div>
          <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted); margin-bottom: 2px;">
            <strong style="color: var(--text-main); font-size: 12px;">${step.action}</strong>
            <span style="font-family: monospace;">${step.timestamp}</span>
          </div>
          <div style="font-size: 12px; color: #334155;">${step.remarks}</div>
          <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px; display: flex; align-items: center; gap: 8px;">
            <span>By: <strong>${step.officer_name}</strong> (${step.bureau})</span>
            ${step.doc_name ? `
              <span style="background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; padding: 1px 6px; border-radius: 4px; font-weight: 700;">
                📎 ${step.doc_name}
              </span>
            ` : ''}
          </div>
        </div>
      `).join('');
    } else {
      timelineContainer.innerHTML = `<div style="color: var(--text-muted); font-size: 12px;">No audit events logged yet.</div>`;
    }

    document.getElementById('modal-case-detail').classList.add('open');
  } catch (err) {
    console.error(err);
    showToast('Failed to load case detail', 'error');
  }
}

function closeCaseDetailModal() {
  document.getElementById('modal-case-detail').classList.remove('open');
}

// Intake Modal & Real-time Overlap Pre-Check
function openIntakeModal() {
  document.getElementById('modal-intake').classList.add('open');
  document.getElementById('intake-overlap-warning').style.display = 'none';
}

function closeIntakeModal() {
  document.getElementById('modal-intake').classList.remove('open');
  document.getElementById('intake-form').reset();
}

function populateInstitutionDropdown() {
  const select = document.getElementById('intake-inst-select');
  if (!select) return;
  select.innerHTML = `<option value="">-- Choose AICTE Approved College --</option>` + 
    state.institutions.map(inst => `
      <option value="${inst.aicte_permanent_id}">${inst.name} (${inst.aicte_permanent_id}) - ${inst.city}</option>
    `).join('');
}

function populateInstitutionData(pid) {
  if (!pid) return;
  const inst = state.institutions.find(i => i.aicte_permanent_id === pid);
  if (inst) {
    document.getElementById('intake-pid').value = inst.aicte_permanent_id;
    document.getElementById('intake-inst-name').value = inst.name;
    document.getElementById('intake-city-state').value = `${inst.city}, ${inst.state}`;
    triggerOverlapCheck();
  }
}

function autoAssignOfficerForBureau(bureau) {
  const officerInput = document.getElementById('intake-officer');
  if (bureau.includes('Regulation')) {
    officerInput.value = 'Dr. R. K. Sharma (Advisor)';
  } else if (bureau.includes('Grievance')) {
    officerInput.value = 'Prof. Ananya Sen (Director)';
  } else {
    officerInput.value = 'Er. M. Venkatesh (Regional Officer)';
  }
}

function triggerOverlapCheckDebounced() {
  clearTimeout(state.overlapDebounceTimer);
  state.overlapDebounceTimer = setTimeout(() => {
    triggerOverlapCheck();
  }, 350);
}

async function triggerOverlapCheck() {
  const pid = document.getElementById('intake-pid')?.value?.trim();
  const name = document.getElementById('intake-inst-name')?.value?.trim();
  const subj = document.getElementById('intake-subject')?.value?.trim();
  const desc = document.getElementById('intake-desc')?.value?.trim();

  if (!pid && !name) return;

  try {
    const res = await fetch('/api/cases/pre-check-overlap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        aicte_permanent_id: pid,
        institution_name: name,
        subject: subj,
        description: desc
      })
    });
    const data = await res.json();
    const warningBox = document.getElementById('intake-overlap-warning');
    const warningDesc = document.getElementById('intake-overlap-desc');

    if (data.has_overlap && data.matches.length > 0) {
      const top = data.matches[0];
      warningDesc.innerHTML = `
        Active case (<strong>${top.candidate_case_id}</strong>) is already in progress by <strong>${top.bureau}</strong> for this institution (Confidence: <strong>${top.overlap_score}%</strong>). 
        Registering this complaint will automatically raise a cross-bureau coordination alert.
      `;
      warningBox.style.display = 'block';
    } else {
      warningBox.style.display = 'none';
    }
  } catch (e) {
    console.error('Error during overlap check:', e);
  }
}

// Submit New Case
async function submitNewCase(e) {
  e.preventDefault();
  const btn = document.getElementById('intake-submit-btn');
  btn.disabled = true;
  btn.innerHTML = `Registering...`;

  const cityState = document.getElementById('intake-city-state').value.split(',');
  const city = cityState[0]?.trim() || '';
  const stateVal = cityState[1]?.trim() || 'India';

  const payload = {
    aicte_permanent_id: document.getElementById('intake-pid').value.trim(),
    institution_name: document.getElementById('intake-inst-name').value.trim(),
    state: stateVal,
    region: 'Central',
    city: city,
    bureau: document.getElementById('intake-bureau').value,
    assigned_officer: document.getElementById('intake-officer').value,
    officer_designation: 'Authorized AICTE Officer',
    officer_email: 'officer@aicte-india.org',
    complainant_name: document.getElementById('intake-complainant-name').value.trim(),
    complainant_type: document.getElementById('intake-complainant-type').value,
    complainant_email: document.getElementById('intake-complainant-contact').value.trim(),
    complainant_phone: '+91 99000 00000',
    subject: document.getElementById('intake-subject').value.trim(),
    description: document.getElementById('intake-desc').value.trim(),
    category: document.getElementById('intake-category').value,
    priority: 'Normal',
    sla_days: 30
  };

  try {
    const res = await fetch('/api/cases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();

    if (result.success) {
      closeIntakeModal();
      await loadInitialData();
      showToast(`Complaint registered as ${result.case_id}!`);
      if (result.has_overlap) {
        showToast('⚠️ Overlap detected with another bureau! Check Overlap Coordination tab.', 'warning');
      }
      switchTab('cases');
    } else {
      throw new Error(result.detail || 'Failed');
    }
  } catch (err) {
    console.error(err);
    showToast('Failed to register complaint', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `Register & Screen Case`;
  }
}

// Action Record Modal
function openRecordActionModal() {
  document.getElementById('modal-record-action').classList.add('open');
}

function openRecordActionModalWithCase(caseId) {
  state.selectedCaseId = caseId;
  openRecordActionModal();
}

function closeRecordActionModal() {
  document.getElementById('modal-record-action').classList.remove('open');
  document.getElementById('action-form').reset();
  document.getElementById('transfer-bureau-row').style.display = 'none';
}

function handleActionTypeChange(action) {
  const transferRow = document.getElementById('transfer-bureau-row');
  if (action === 'Case Transferred') {
    transferRow.style.display = 'block';
  } else {
    transferRow.style.display = 'none';
  }
}

async function submitCaseAction(e) {
  e.preventDefault();
  if (!state.selectedCaseId) return;

  const actionType = document.getElementById('action-type-select').value;
  const remarks = document.getElementById('action-remarks').value;
  const doc = document.getElementById('action-doc').value;
  const userRole = ROLES[state.currentRole];

  let newStatus = null;
  if (actionType === 'Case Disposed') newStatus = 'Disposed';
  else if (actionType === 'Case Transferred') newStatus = 'Transferred';
  else if (actionType === 'Escalated to Member Secretary') newStatus = 'Under Review';

  try {
    const res = await fetch(`/api/cases/${state.selectedCaseId}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: actionType,
        officer_name: userRole.name,
        bureau: userRole.bureau,
        remarks: remarks,
        doc_name: doc || null,
        new_status: newStatus
      })
    });
    const data = await res.json();
    if (data.success) {
      closeRecordActionModal();
      showToast(`Action recorded in audit log.`);
      await loadInitialData();
      await openCaseDetail(state.selectedCaseId);
    }
  } catch (err) {
    console.error(err);
    showToast('Failed to record action', 'error');
  }
}

// Overlap Joint Action Linking
function openLinkOverlapModal(caseA, caseB) {
  state.linkTargetCasePair = { caseA, caseB };
  document.getElementById('link-case-pair-text').innerText = `${caseA} ⟷ ${caseB}`;
  document.getElementById('modal-link-overlap').classList.add('open');
}

function closeLinkOverlapModal() {
  document.getElementById('modal-link-overlap').classList.remove('open');
  document.getElementById('link-overlap-form').reset();
}

async function submitOverlapLink(e) {
  e.preventDefault();
  if (!state.linkTargetCasePair) return;

  const user = ROLES[state.currentRole];
  const payload = {
    case_id_a: state.linkTargetCasePair.caseA,
    case_id_b: state.linkTargetCasePair.caseB,
    lead_bureau: document.getElementById('link-lead-bureau').value,
    strategy_notes: document.getElementById('link-strategy-notes').value,
    officer_name: user.name,
    bureau: user.bureau
  };

  try {
    const res = await fetch('/api/overlaps/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      closeLinkOverlapModal();
      showToast('Cases successfully linked under joint coordination!');
      await loadInitialData();
      renderOverlaps();
    }
  } catch (err) {
    console.error(err);
    showToast('Failed to link cases', 'error');
  }
}

async function dismissOverlapAlert(caseA, caseB) {
  const reason = prompt('Please enter officer justification for dismissing this overlap (for audit trail):', 'Institutions are independent campuses; distinct non-overlapping matters.');
  if (!reason) return;

  try {
    const res = await fetch('/api/overlaps/dismiss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        case_id_a: caseA,
        case_id_b: caseB,
        officer_name: ROLES[state.currentRole].name,
        dismiss_reason: reason
      })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Overlap alert dismissed with audit remarks.');
      await loadInitialData();
    }
  } catch (err) {
    console.error(err);
    showToast('Failed to dismiss overlap', 'error');
  }
}

// CSV Export
function exportCasesCSV() {
  window.open('/api/reports/export', '_blank');
}

// Toast
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toast-message');
  const toastIcon = document.getElementById('toast-icon');

  toastMsg.innerText = message;
  toastIcon.innerText = type === 'error' ? '❌' : (type === 'warning' ? '⚠️' : '✅');

  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}
