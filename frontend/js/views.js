// ===== Vues de l'application (Admin & Président : mêmes droits) =====

const Views = (() => {

  const { $, esc, toast, openModal, closeModal, confirm } = UI;

  let REF = null;

  let ROLE = 'admin';
  let PERMS = [];

  function setRef(r) { REF = r; }
  function setRole(r) { ROLE = r; }
  function setPermissions(p = []) { PERMS = Array.isArray(p) ? p : []; }
  function container() { return $('#viewContainer'); }
  function hasPerm(code) {
    return ROLE === 'admin' || ROLE === 'president' || PERMS.includes(code) || (code === 'demandes_view' && PERMS.includes('demandes_edit'));
  }
  function isSaisieOnly() { return ROLE === 'saisie'; }
  function canAccessBE() { return ROLE === 'admin' || ROLE === 'president'; }
  function canViewDemandes() { return hasPerm('demandes_view') || hasPerm('demandes_edit'); }
  function canEditDemandes() { return hasPerm('demandes_edit'); }
  function canAddAdherents() { return ROLE === 'admin' || ROLE === 'president' || hasPerm('adherents_add') || hasPerm('adherents_manage'); }
  function canManageAdherents() { return ROLE === 'admin' || ROLE === 'president' || hasPerm('adherents_manage'); }
  function canViewDocuments() { return ROLE === 'admin' || ROLE === 'president' || hasPerm('documents_view'); }

  function wilayaOptions(sel) {
    return REF.wilayas.map((w) => `<option value="${w.code}" ${w.code === sel ? 'selected' : ''}>${w.code} — ${esc(w.nom)}</option>`).join('');
  }
  function typeOptions(sel) {
    return REF.types.map((t) => `<option value="${t.code}" ${t.code === sel ? 'selected' : ''}>${esc(t.libelle)} (${t.code})</option>`).join('');
  }
  function docTypeOptions(sel) {
    return REF.docTypes.map((d) => `<option value="${d.code}" ${d.code === sel ? 'selected' : ''} data-min="${d.min}" data-max="${d.max}">${esc(d.libelle)}</option>`).join('');
  }
  function niveauOptions(sel) {
    return REF.niveaux.map((n) => `<option ${n === sel ? 'selected' : ''}>${esc(n)}</option>`).join('');
  }
  function paiementLabel(mode) {
    const m = String(mode || '').toLowerCase();
    if (m === 'cheque') return 'Chèque';
    if (m === 'espece') return 'Espèce';
    if (m === 'virement') return 'Virement';
    return '';
  }
  function fmtDate(d) {
    if (!d) return '—';
    const str = String(d);
    if (str.includes('T')) {
      const dateObj = new Date(d);
      if (!isNaN(dateObj)) {
        const yr = dateObj.getFullYear();
        const mo = String(dateObj.getMonth() + 1).padStart(2, '0');
        const da = String(dateObj.getDate()).padStart(2, '0');
        return `${yr}-${mo}-${da}`;
      }
    }
    return str.slice(0, 10);
  }

  const ADH_NOTIF_KEY = 'opa_adhesion_notifications_closed_v1';

  function localDateString(date) {
    const yr = date.getFullYear();
    const mo = String(date.getMonth() + 1).padStart(2, '0');
    const da = String(date.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${da}`;
  }

  function addOneYear(dateStr) {
    if (!dateStr) return null;
    const d = new Date(`${String(dateStr).slice(0, 10)}T00:00:00`);
    if (isNaN(d)) return null;
    d.setFullYear(d.getFullYear() + 1);
    return d;
  }

  function daysBetween(fromDate, toDate) {
    const ms = 24 * 60 * 60 * 1000;
    const start = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
    const end = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
    return Math.round((end - start) / ms);
  }

  function getExpirationInfo(adherent) {
    const expiration = addOneYear(adherent?.date_adhesion);
    if (!expiration) return null;
    const today = new Date();
    const daysLeft = daysBetween(today, expiration);
    return {
      expiration,
      expirationText: localDateString(expiration),
      daysLeft,
      isExpired: daysLeft < 0,
      isSoon: daysLeft >= 0 && daysLeft <= 30,
    };
  }
  
  function loadClosedNotifications() {
    try {
      return JSON.parse(localStorage.getItem(ADH_NOTIF_KEY) || '{}');
    } catch {
      return {};
    }
  }

  function saveClosedNotifications(data) {
    localStorage.setItem(ADH_NOTIF_KEY, JSON.stringify(data || {}));
  }

  function notificationToken(item) {
    return `${item.id || 'x'}::${item.date_expiration || item.expirationText || ''}`;
  }

  function filterActiveNotifications(list = []) {
    const closed = loadClosedNotifications();
    return list.filter((item) => !closed[notificationToken(item)]);
  }

  function closeNotification(item) {
    const closed = loadClosedNotifications();
    closed[notificationToken(item)] = true;
    saveClosedNotifications(closed);
  }

  function collectExpirationAlerts(list = []) {
    return list
      .filter((a) => (a.type_code || '') !== 'BE')
      .map((a) => {
        const info = getExpirationInfo(a);
        if (!info || !info.isSoon) return null;
        return {
          id: a.id,
          nom: a.nom || '',
          prenom: a.prenom || '',
          matricule: a.matricule || '',
          date_expiration: info.expirationText,
          daysLeft: info.daysLeft,
        };
      })
      .filter(Boolean)
      .sort((x, y) => x.daysLeft - y.daysLeft || String(x.prenom).localeCompare(String(y.prenom)));
  }

  function renderAdhesionNotifications(list = [], { showTitle = true } = {}) {
    const active = filterActiveNotifications(list);
    if (!active.length || ROLE !== 'admin') return '';
    return `
      <div class="panel" style="margin-bottom:18px;border:1px solid #fcd34d;background:#fffdf5">
        ${showTitle ? `<div class="panel-head"><h3>🔔 Notifications adhésion</h3></div>` : ''}
        <div style="padding:14px 16px;display:flex;flex-direction:column;gap:10px">
          ${active.map((a) => `
            <div style="display:flex;align-items:flex-start;gap:12px;border:1px solid #fde68a;background:#fffbeb;border-radius:10px;padding:12px 14px">
              <div style="font-size:18px;line-height:1">⏳</div>
              <div style="flex:1">
                <div style="font-weight:700;color:#92400e">${esc(a.nom)} ${esc(a.prenom)}</div>
                <div class="muted" style="margin-top:2px">Matricule : <span class="mono">${esc(a.matricule || '—')}</span></div>
                <div style="margin-top:4px;color:#92400e;font-size:13px">Son adhésion se termine le <b>${esc(a.date_expiration)}</b>${a.daysLeft === 0 ? ' (aujourd’hui)' : ` dans <b>${a.daysLeft}</b> jour${a.daysLeft > 1 ? 's' : ''}` }.</div>
              </div>
              <button type="button" class="btn btn-dark btn-sm" data-close-adh-notif="${esc(notificationToken(a))}">Fermer</button>
            </div>
          `).join('')}
        </div>
      </div>`;
  }

  function bindAdhesionNotifications(list = [], rerender) {
    const active = filterActiveNotifications(list);
    document.querySelectorAll('[data-close-adh-notif]').forEach((btn) => {
      btn.onclick = () => {
        const item = active.find((x) => notificationToken(x) === btn.dataset.closeAdhNotif);
        if (!item) return;
        closeNotification(item);
        rerender && rerender();
      };
    });
  }

  /* ============ DASHBOARD PROFESSIONNEL ============ */

  async function dashboard() {
    const c = container();
    c.innerHTML = '<div class="muted">Chargement du tableau de bord…</div>';

    const s = await API.stats();
    const a = s.adherents;
    const now = new Date();
    const heure = now.getHours();
    const salutation = heure < 12 ? 'Bonjour' : heure < 18 ? 'Bon après-midi' : 'Bonsoir';
    const roleLabel = ROLE === 'president' ? 'Président' : 'Administrateur';

    // Calcul taux de croissance (simulation si pas fourni par l'API)
    const tauxTraitement = s.demandes.tauxTraitement || 0;
    const tauxUrgence = s.demandes.parStatut
      ? (s.demandes.parStatut.find(d => d.statut === 'Urgente')?.c || 0)
      : 0;

    c.innerHTML = `
      <style>
        .dash-header {
          display:flex;align-items:center;justify-content:space-between;
          margin-bottom:28px;padding-bottom:20px;
          border-bottom:1px solid var(--border, #e2e8f0);
        }
        .dash-header h2 { font-size:22px; font-weight:700; color:var(--text); margin:0 0 4px; }
        .dash-header .sub { font-size:13px; color:var(--muted, #94a3b8); }
        .dash-header .role-badge {
          display:inline-flex;align-items:center;gap:6px;
          background:var(--gold, #c8a44e);color:#fff;
          padding:5px 14px;border-radius:20px;font-size:12px;font-weight:600;
          letter-spacing:.3px;text-transform:uppercase;
        }
        .kpi-row {
          display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));
          gap:16px;margin-bottom:28px;
        }
        .kpi {
          background:var(--card, #fff);border:1px solid var(--border, #e2e8f0);
          border-radius:12px;padding:20px;position:relative;overflow:hidden;
          transition:box-shadow .2s;
        }
        .kpi:hover { box-shadow:0 4px 20px rgba(0,0,0,.07); }
        .kpi-accent {
          position:absolute;left:0;top:0;bottom:0;width:4px;border-radius:4px 0 0 4px;
        }
        .kpi .kpi-ico {
          width:40px;height:40px;border-radius:10px;
          display:flex;align-items:center;justify-content:center;
          font-size:18px;margin-bottom:12px;
        }
        .kpi .kpi-val { font-size:28px;font-weight:800;color:var(--text);line-height:1; }
        .kpi .kpi-lbl { font-size:12px;color:var(--muted, #94a3b8);margin-top:6px;font-weight:500;letter-spacing:.2px; }
        .kpi .kpi-sub { font-size:11px;color:var(--muted, #94a3b8);margin-top:4px; }

        .dash-grid { display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:28px; }
        .dash-grid-3 { display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;margin-bottom:28px; }
        .dash-panel {
          background:var(--card, #fff);border:1px solid var(--border, #e2e8f0);
          border-radius:12px;overflow:hidden;
        }
        .dash-panel-head {
          display:flex;align-items:center;justify-content:space-between;
          padding:16px 20px;border-bottom:1px solid var(--border, #e2e8f0);
        }
        .dash-panel-head h3 { font-size:14px;font-weight:700;color:var(--text);margin:0; }
        .dash-panel-body { padding:20px; }

        .quick-actions { display:grid;grid-template-columns:1fr 1fr;gap:10px; }
        .qa-btn {
          display:flex;align-items:center;gap:12px;
          padding:14px 16px;border-radius:10px;border:1px solid var(--border, #e2e8f0);
          background:var(--card, #fff);cursor:pointer;transition:all .15s;
          font-size:13px;font-weight:600;color:var(--text);
        }
        .qa-btn:hover { border-color:var(--gold, #c8a44e);background:rgba(200,164,78,.04); }
        .qa-btn .qa-ico {
          width:38px;height:38px;border-radius:9px;
          display:flex;align-items:center;justify-content:center;font-size:16px;
          flex-shrink:0;
        }

        .mini-table { width:100%;border-collapse:collapse; }
        .mini-table th {
          text-align:left;font-size:11px;font-weight:600;color:var(--muted, #94a3b8);
          padding:8px 10px;border-bottom:1px solid var(--border, #e2e8f0);
          text-transform:uppercase;letter-spacing:.4px;
        }
        .mini-table td { padding:10px;font-size:13px;color:var(--text);border-bottom:1px solid var(--border, #e2e8f0); }
        .mini-table tr:last-child td { border-bottom:none; }

        .progress-bar-wrap {
          height:8px;background:var(--border, #e2e8f0);border-radius:4px;overflow:hidden;
        }
        .progress-bar-fill {
          height:100%;border-radius:4px;transition:width .6s ease;
        }
        .metric-row { display:flex;align-items:center;justify-content:space-between;padding:10px 0; }
        .metric-row + .metric-row { border-top:1px solid var(--border, #e2e8f0); }
        .metric-label { font-size:13px;color:var(--text); }
        .metric-val { font-size:14px;font-weight:700;color:var(--text); }
        .metric-bar { flex:1;margin:0 16px;max-width:200px; }

        .alert-banner {
          display:flex;align-items:center;gap:12px;
          padding:14px 18px;border-radius:10px;margin-bottom:20px;
          font-size:13px;font-weight:500;
        }
        .alert-banner.alert-warn { background:#fef3c7;color:#92400e;border:1px solid #fcd34d; }
        .alert-banner.alert-info { background:#dbeafe;color:#1e40af;border:1px solid #93c5fd; }
        .alert-banner.alert-ok { background:#d1fae5;color:#065f46;border:1px solid #6ee7b7; }

        @media (max-width:900px) {
          .dash-grid, .dash-grid-3 { grid-template-columns:1fr; }
          .kpi-row { grid-template-columns:1fr 1fr; }
        }
        @media (max-width:560px) {
          .kpi-row { grid-template-columns:1fr; }
          .quick-actions { grid-template-columns:1fr; }
        }
      </style>

      <!-- EN-TÊTE -->
      <div class="dash-header">
        <div>
          <h2>${salutation}, ${esc(roleLabel)}</h2>
          <div class="sub">${now.toLocaleDateString('fr-FR', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</div>
        </div>
        <div class="role-badge">⬥ ${esc(roleLabel)}</div>
      </div>

      <!-- ALERTE SI DEMANDES URGENTES -->
      ${tauxUrgence > 0 ? `
        <div class="alert-banner alert-warn">
          <span style="font-size:18px">⚠️</span>
          <span><b>${tauxUrgence} demande${tauxUrgence > 1 ? 's' : ''} urgente${tauxUrgence > 1 ? 's' : ''}</b> nécessite${tauxUrgence === 1 ? '' : 'nt'} votre attention immédiate.</span>
          <button class="btn btn-dark btn-sm" style="margin-left:auto" onclick="Views.demandesList()">Traiter →</button>
        </div>` : ''}

      ${renderAdhesionNotifications(s.adhesionsBientotExpirantes || [], { showTitle: true })}

      <!-- KPI PRINCIPAUX -->
      <div class="kpi-row">
        ${kpiCard('total', '👥', s.totalAdherents, 'Total adhérents', `${s.nouveauxMois} nouveau${s.nouveauxMois > 1 ? 'x' : ''} ce mois`, '#888888')}
        ${kpiCard('ad', '▣', a.AD, 'Adhérents (AD)', `dont ${a.gold} Gold`, '#c49b2e')}
        ${kpiCard('ma', '⬡', a.MA, 'Membres Actifs (MA)', `${a.MA ? ((a.MA/s.totalAdherents)*100).toFixed(1) : 0}% du total`, '#d4873a')}
        ${kpiCard('cr', '◆', a.CR, 'Conseillers (CR)', `${a.CR ? ((a.CR/s.totalAdherents)*100).toFixed(1) : 0}% du total`, '#1a1a1a')}
        ${kpiCard('be', '🏛️', s.totalBureauExecutif || 0, 'Bureau exécutif', 'Rubrique séparée', '#8b5cf6')}
        ${kpiCard('ouvertes', '📨', s.demandes.ouvertes, 'Demandes ouvertes', 'En attente de traitement', '#f59e0b')}
        ${kpiCard('cloturees', '✓', s.demandes.cloturees, 'Demandes clôturées', `Taux : ${tauxTraitement}%`, '#10b981')}
      </div>

      <!-- RANGÉE : RÉPARTITION + TRAITEMENT DEMANDES -->
      <div class="dash-grid">
        <div class="dash-panel">
          <div class="dash-panel-head"><h3>▣ Répartition par type</h3></div>
          <div class="dash-panel-body">
          
          ${Charts.donut([
                { label: 'Adhérent (AD)', value: a.AD, color: '#c49b2e' },
                { label: 'Membre Actif (MA)', value: a.MA, color: '#d4873a' },
                { label: 'Conseiller (CR)', value: a.CR, color: '#1a1a1a' },
            ])}
            <div style="margin-top:14px">
                ${metricBar('Adhérent', a.AD, s.totalAdherents, '#c49b2e')}
                ${metricBar('Membre Actif', a.MA, s.totalAdherents, '#d4873a')}
                ${metricBar('Conseiller', a.CR, s.totalAdherents, '#1a1a1a')}
            </div>
          </div>
        </div>

        <div class="dash-panel">
          <div class="dash-panel-head"><h3>📨 Traitement des demandes</h3></div>
          <div class="dash-panel-body">
            ${Charts.donut(s.demandes.parStatut.map((d) => ({ label: d.statut, value: d.c })))}
            <div style="margin-top:14px">
              <div class="metric-row">
                <span class="metric-label">Taux de traitement</span>
                <div class="metric-bar">
                  <div class="progress-bar-wrap">
                    <div class="progress-bar-fill" style="width:${tauxTraitement}%;background:#10b981"></div>
                  </div>
                </div>
                <span class="metric-val" style="color:#10b981">${tauxTraitement}%</span>
              </div>
              <div class="metric-row">
                <span class="metric-label">Demandes en attente</span>
                <div class="metric-bar">
                  <div class="progress-bar-wrap">
                    <div class="progress-bar-fill" style="width:${s.totalAdherents ? (s.demandes.ouvertes/(s.demandes.ouvertes+s.demandes.cloturees||1))*100 : 0}%;background:#f59e0b"></div>
                  </div>
                </div>
                <span class="metric-val" style="color:#f59e0b">${s.demandes.ouvertes}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- RANGÉE : WILAYAS + ACTIONS RAPIDES -->
      <div class="dash-grid">
        <div class="dash-panel">
          <div class="dash-panel-head"><h3>🗺️ Répartition par wilaya (top 10)</h3></div>
          <div class="dash-panel-body">
            ${s.parWilaya.length ? Charts.bars(s.parWilaya.slice(0, 10).map((w) => ({ label: w.nom, value: w.count }))) : UI.emptyState('🗺️', 'Aucune donnée.')}
          </div>
        </div>

        <div class="dash-panel">
          <div class="dash-panel-head"><h3>⚡ Actions rapides</h3></div>
          <div class="dash-panel-body">
            <div class="quick-actions">
              <button class="qa-btn" id="qaAddAdh">
                <div class="qa-ico" style="background:rgba(99,102,241,.1);color:#6366f1">➕</div>
                <div><div>Nouvel adhérent</div><div style="font-size:11px;color:var(--muted, #94a3b8);font-weight:400">Enregistrer un adhérent</div></div>
              </button>
              <button class="qa-btn" id="qaDemandes">
                <div class="qa-ico" style="background:rgba(245,158,11,.1);color:#f59e0b">📨</div>
                <div><div>Traiter les demandes</div><div style="font-size:11px;color:var(--muted, #94a3b8);font-weight:400">${s.demandes.ouvertes} en attente</div></div>
              </button>
              <button class="qa-btn" id="qaDocuments">
                <div class="qa-ico" style="background:rgba(16,185,129,.1);color:#10b981">📁</div>
                <div><div>Documents</div><div style="font-size:11px;color:var(--muted, #94a3b8);font-weight:400">Gestion documentaire</div></div>
              </button>
              <button class="qa-btn" id="qaBureau">
                <div class="qa-ico" style="background:rgba(139,92,246,.1);color:#8b5cf6">🏛️</div>
                <div><div>Bureau exécutif</div><div style="font-size:11px;color:var(--muted, #94a3b8);font-weight:400">${s.totalBureauExecutif || 0} membre(s)</div></div>
              </button>
              <button class="qa-btn" id="qaComptes">
                <div class="qa-ico" style="background:rgba(124,58,237,.1);color:#7c3aed">👥</div>
                <div><div>Comptes</div><div style="font-size:11px;color:var(--muted, #94a3b8);font-weight:400">Gestion des utilisateurs</div></div>
              </button>
              <button class="qa-btn" id="qaFinances">
                <div class="qa-ico" style="background:rgba(196,155,46,.12);color:#c49b2e">💰</div>
                <div><div>Finances</div><div style="font-size:11px;color:var(--muted, #94a3b8);font-weight:400">Chèques, banques, caisse</div></div>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:20px;margin-bottom:28px">
      <div class="dash-panel" style="margin-bottom:0">
        <div class="dash-panel-head"><h3>⭐ Étoiles (0 à 5)</h3></div>
        <div class="dash-panel-body">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px">
            ${[0,1,2,3,4,5].map((star) => renderDashboardStarGroup(star, s.starGroups?.[star] || [])).join('')}
          </div>
        </div>
      </div>

      <div class="dash-panel" style="margin-bottom:0">
        <div class="dash-panel-head"><h3>⚠️ Notation négative</h3><span class="muted" style="font-size:12px">0 = aucun · 5 = max</span></div>
        <div class="dash-panel-body">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px">
            ${((s.notationGroups || s.malusGroups) ? [0,1,2,3,4,5].map(m => {
              const list = (s.notationGroups || s.malusGroups)[m] || [];
              return `<div style="border:1px solid var(--border,#e2e8f0);border-radius:12px;overflow:hidden;background:var(--card,#fff)">
                <div style="padding:12px 14px;border-bottom:1px solid var(--border,#e2e8f0);display:flex;align-items:center;justify-content:space-between">
                  <div style="font-weight:700;color:${m===0?'#64748b':'#dc2626'}">${m===0 ? 'Aucune notation négative' : m + ' point' + (m>1?'s':'') + ' en moins'}</div>
                  <div>${renderNotationNegative(m)}</div>
                </div>
                <div style="max-height:180px;overflow:auto">
                  ${list.length ? list.slice(0,8).map(a=>`<div style="padding:8px 14px;border-bottom:1px solid var(--border,#e2e8f0);display:flex;align-items:center;justify-content:space-between">
                    <div><div style="font-weight:600;color:var(--text);font-size:13px">${esc((a.nom||'').trim()||'—')} ${esc((a.prenom||'').trim()||'')}</div><div style="font-size:11px;color:var(--muted,#94a3b8)">${esc(a.matricule||'Sans matricule')} · ${esc(a.profession||a.fonction||'—')}</div></div>
                    <button class="btn btn-dark btn-sm" data-star-view="${a.id}">Voir</button>
                  </div>`).join('') + (list.length>8?`<div class="muted" style="padding:8px 14px;font-size:12px">+ ${list.length-8} autre(s)…</div>`:'') : `<div class="muted" style="padding:14px">Aucun adhérent.</div>`}
                </div>
              </div>`;
            }).join('') : '<div class="muted">Chargement…</div>')}
          </div>
        </div>
      </div>
      </div>

      <!-- RANGÉE : STATS WILAYAS TABLEAU + RÉSUMÉ -->
      <div class="dash-grid">
        <div class="dash-panel">
          <div class="dash-panel-head"><h3>📊 Détail par wilaya</h3></div>
          <div class="dash-panel-body" style="padding:0">
            <div style="max-height:300px;overflow-y:auto">
              <table class="mini-table">
                <thead><tr><th>Wilaya</th><th>Adhérents</th><th>Part</th></tr></thead>
                <tbody>
                  ${s.parWilaya.slice(0, 15).map(w => `
                    <tr>
                      <td style="font-weight:600">${esc(w.nom)}</td>
                      <td><span class="mono">${w.count}</span></td>
                      <td>
                        <div style="display:flex;align-items:center;gap:8px">
                          <div class="progress-bar-wrap" style="flex:1;max-width:80px">
                            <div class="progress-bar-fill" style="width:${s.totalAdherents ? (w.count/s.totalAdherents*100) : 0}%;background:#c49b2e"></div>
                          </div>
                          <span style="font-size:11px;color:var(--muted, #94a3b8)">${s.totalAdherents ? (w.count/s.totalAdherents*100).toFixed(1) : 0}%</span>
                        </div>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="dash-panel">
          <div class="dash-panel-head"><h3>📋 Résumé exécutif</h3></div>
          <div class="dash-panel-body">
            <div class="metric-row">
              <span class="metric-label">Total adhérents actifs</span>
              <span class="metric-val">${s.totalAdherents}</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">Adhérents Gold</span>
              <span class="metric-val" style="color:#c8a44e">${a.gold || 0}</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">Nouveaux ce mois</span>
              <span class="metric-val" style="color:#3b82f6">${s.nouveauxMois}</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">Bureau exécutif</span>
              <span class="metric-val" style="color:#8b5cf6">${s.totalBureauExecutif || 0}</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">Demandes en cours</span>
              <span class="metric-val" style="color:#f59e0b">${s.demandes.ouvertes}</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">Demandes clôturées</span>
              <span class="metric-val" style="color:#10b981">${s.demandes.cloturees}</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">Taux de traitement</span>
              <span class="metric-val" style="color:${tauxTraitement >= 75 ? '#10b981' : tauxTraitement >= 50 ? '#f59e0b' : '#ef4444'}">${tauxTraitement}%</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">Wilayas représentées</span>
              <span class="metric-val">${s.parWilaya.length}</span>
            </div>
          </div>
        </div>
      </div>
    `;

    // Bind quick actions
    $('#qaAddAdh').onclick = () => adherentForm(null, adherentsList);
    $('#qaDemandes').onclick = () => demandesList();
    $('#qaDocuments').onclick = () => documentsList();
    $('#qaBureau').onclick = () => bureauExecutifList();
    $('#qaComptes').onclick = () => comptesList();
    if ($('#qaFinances')) $('#qaFinances').onclick = () => finances();
    c.querySelectorAll('[data-star-view]').forEach((el) => el.onclick = () => adherentDetail(el.dataset.starView, adherentsList));
    bindAdhesionNotifications(s.adhesionsBientotExpirantes || [], dashboard);
  }

  function kpiCard(id, ico, val, lbl, sub, color) {
return `<div class="stat-card" style="--kpi-color:${color}">
<div class="stat-ico" style="color:${color};background:${color}18">${ico}</div>
<div class="stat-val">${val}</div>
<div class="stat-lbl">${esc(lbl)}</div>
<div class="muted">${esc(sub)}</div>
</div>`;
}

  function metricBar(label, value, total, color) {
    const pct = total ? (value / total * 100).toFixed(1) : 0;
    return `
      <div class="metric-row">
        <span class="metric-label">${esc(label)}</span>
        <div class="metric-bar">
          <div class="progress-bar-wrap">
            <div class="progress-bar-fill" style="width:${pct}%;background:${color}"></div>
          </div>
        </div>
        <span class="metric-val" style="color:${color}">${value} <small style="font-weight:400;color:var(--muted, #94a3b8);font-size:11px">(${pct}%)</small></span>
      </div>`;
  }
/* ============ LISTE ADHÉRENTS ============ */
/* ============ ADHÉRENTS ============ */

  function renderStars(count = 0) {
    const n = Math.max(0, Math.min(5, Number.parseInt(count, 10) || 0));
    return `<span title="${n} étoile(s) sur 5" style="letter-spacing:1px;color:#d4a017">${'★'.repeat(n)}<span style="color:#cbd5e1">${'☆'.repeat(5 - n)}</span></span>`;
  }

  function renderNotationNegative(count = 0) {
    const n = Math.max(0, Math.min(5, Number.parseInt(count, 10) || 0));
    if (n === 0) return `<span class="tag" style="background:#f1f5f9;color:#64748b;border:1px solid #e2e8f0">— Aucun</span>`;
    return `<span title="${n} point(s) en moins" style="letter-spacing:1px;color:#dc2626">${'▼'.repeat(n)}<span style="color:#e2e8f0">${'▽'.repeat(5 - n)}</span></span>`;
  }

  function renderNotationNegativeCompact(count = 0) {
    const n = Math.max(0, Math.min(5, Number.parseInt(count, 10) || 0));
    if (n === 0) return `<span style="color:#94a3b8;font-size:12px">—</span>`;
    return `<span title="${n} en moins" style="color:#dc2626;font-weight:700;letter-spacing:0.5px">${'●'.repeat(n)}<span style="color:#e2e8f0">${'○'.repeat(5-n)}</span> <small style="color:#dc2626">-${n}</small></span>`;
  }
  // compat alias (ancien nom)
  function renderMalus(count = 0){ return renderNotationNegative(count); }
  function renderMalusCompact(count = 0){ return renderNotationNegativeCompact(count); }

  function renderDashboardStarGroup(star, list = []) {
    return `
      <div style="border:1px solid var(--border, #e2e8f0);border-radius:12px;overflow:hidden;background:var(--card,#fff)">
        <div style="padding:12px 14px;border-bottom:1px solid var(--border, #e2e8f0);display:flex;align-items:center;justify-content:space-between">
          <div style="font-weight:700">Groupe ${star} étoile${star > 1 ? 's' : ''}</div>
          <div>${renderStars(star)}</div>
        </div>
        <div style="max-height:220px;overflow:auto">
          ${list.length ? list.map((a) => `
            <button type="button" data-star-view="${a.id}" style="width:100%;text-align:left;border:none;background:transparent;padding:10px 14px;border-bottom:1px solid var(--border,#e2e8f0);cursor:pointer">
              <div style="font-weight:600;color:var(--text)">${esc((a.nom || '').trim() || '—')} ${esc((a.prenom || '').trim() || '')}</div>
              <div style="font-size:12px;color:var(--muted,#94a3b8)">${esc(a.matricule || 'Sans matricule')}</div>
            </button>
          `).join('') : `<div class="muted" style="padding:14px">Aucun adhérent dans ce groupe.</div>`}
        </div>
      </div>`;
  }

  function specialBadge() {
    return `<span style="font-size:12px;font-weight:700;color:var(--text)">Badge Bureau exécutif</span>`;
  }

  function filteredTypeOptions(includeBE = false) {
    return REF.types
      .filter((t) => includeBE || (t.code !== 'BE' && t.realCode !== 'BE'))
      .map((t) => `<option value="${t.code}">${esc(t.libelle)}</option>`)
      .join('');
  }

  async function adherentsList() {
    return membersListView({ mode: 'adherents' });
  }

  async function bureauExecutifList() {
    const c = container();
    if (isSaisieOnly()) {
      c.innerHTML = UI.emptyState('🔒', "Vous n'avez pas accès au Bureau exécutif.");
      return;
    }
    return membersListView({ mode: 'bureau' });
  }

  async function membersListView({ mode = 'adherents' } = {}) {
    const isBureau = mode === 'bureau';
    const c = container();
    c.innerHTML = `
      <div class="toolbar" style="flex-wrap: wrap; gap: 10px;">
        <input type="search" id="adhSearch" placeholder="${isBureau ? 'Rechercher (nom, matricule, type badge, téléphone, profession)…' : 'Rechercher (nom, matricule, NIN, document, téléphone, profession)…'}" />
        <select id="adhWilaya"><option value="">Toutes wilayas</option>${REF.wilayas.map((w) => `<option value="${w.code}">${w.code} — ${esc(w.nom)}</option>`).join('')}</select>
        ${isBureau ? '' : `<select id="adhType"><option value="">Tous types</option>${filteredTypeOptions(false)}</select>`}
        <select id="adhPaiement">
          <option value="">Tous paiements</option>
          <option value="paye">✓ Payé</option>
          <option value="non_paye">✕ Non payé</option>
          <option value="non_assujetti">⊘ Non assujetti</option>
          <option value="cheque">Chèque</option>
          <option value="espece">Espèce</option>
          <option value="virement">Virement</option>
        </select>
        <select id="adhEtoiles" title="Filtrer par étoiles">
          <option value="">Toutes étoiles</option>
          <option value="0">0 ★</option>
          <option value="1">1 ★</option>
          <option value="2">2 ★</option>
          <option value="3">3 ★</option>
          <option value="4">4 ★</option>
          <option value="5">5 ★</option>
        </select>
        <select id="adhNotationNegative" title="Filtrer par notation négative">
          <option value="">Toutes notations négatives</option>
          <option value="0">0 −</option>
          <option value="1">1 −</option>
          <option value="2">2 −</option>
          <option value="3">3 −</option>
          <option value="4">4 −</option>
          <option value="5">5 −</option>
        </select>
        <button class="btn btn-dark" id="refreshAdhBtn" title="Rafraîchir">⟳ Rafraîchir</button>
        <button class="btn btn-gold" id="addAdhBtn">+ ${isBureau ? 'Nouveau membre BE' : 'Nouvel adhérent'}</button>
        <button class="btn btn-danger" id="bulkDeleteAdhBtn" style="display: none;">✕ Supprimer la sélection (<span id="bulkAdhCount">0</span>)</button>
      </div>
      ${isBureau ? '' : '<div id="adhNotifZone"></div>'}
      <div id="adhTable"><div class="muted">Chargement…</div></div>`;

    async function load() {
      const params = {};
      const q = $('#adhSearch').value.trim(); if (q) params.q = q;
      const w = $('#adhWilaya').value; if (w) params.wilaya = w;
      const p = $('#adhPaiement') ? $('#adhPaiement').value : ''; if (p) params.paiement = p;
      if (isBureau) {
        params.type = 'BE';
      } else {
        const t = $('#adhType').value; if (t) params.type = t;
      }
      let members = await API.adherents(params);
      const etoileFilter = $('#adhEtoiles') ? $('#adhEtoiles').value : '';
      if (etoileFilter !== '') {
        const ef = parseInt(etoileFilter,10);
        members = members.filter(a => (parseInt(a.etoiles,10)||0) === ef);
      }
      const notationFilter = $('#adhNotationNegative') ? $('#adhNotationNegative').value : '';
      if (notationFilter !== '') {
        const nf = parseInt(notationFilter,10);
        members = members.filter(a => (parseInt(a.notation_negative ?? a.malus,10)||0) === nf);
      }
      renderMembersTable(members, { mode, reload: load });
      if (!isBureau && $('#adhNotifZone')) {
        const alerts = collectExpirationAlerts(members);
        $('#adhNotifZone').innerHTML = renderAdhesionNotifications(alerts, { showTitle: true });
        bindAdhesionNotifications(alerts, load);
      }
      updateBulkButton();
    }

    function updateBulkButton() {
      const checkedBoxes = document.querySelectorAll('.adh-checkbox:checked');
      const bulkBtn = $('#bulkDeleteAdhBtn');
      const bulkCount = $('#bulkAdhCount');
      if (checkedBoxes.length > 0) {
        bulkCount.textContent = checkedBoxes.length;
        bulkBtn.style.display = 'inline-block';
      } else {
        bulkBtn.style.display = 'none';
      }
    }

    $('#bulkDeleteAdhBtn').onclick = () => {
      const checkedBoxes = document.querySelectorAll('.adh-checkbox:checked');
      const idsToDelete = Array.from(checkedBoxes).map(cb => cb.value);
      confirm(`Supprimer définitivement ces ${idsToDelete.length} fiche(s) ?`, async () => {
        try {
          await Promise.all(idsToDelete.map(id => API.deleteAdherent(id)));
          toast(`${idsToDelete.length} fiche(s) supprimée(s) avec succès.`);
          load();
        } catch (err) {
          toast('Erreur lors de la suppression groupée : ' + err.message, 'error');
        }
      });
    };

    c.addEventListener('change', (e) => {
      if (e.target.classList.contains('adh-checkbox') || e.target.id === 'selectAllAdh') updateBulkButton();
    });

    let timer;
    $('#adhSearch').oninput = () => { clearTimeout(timer); timer = setTimeout(load, 280); };
    $('#adhWilaya').onchange = load;
    if (!isBureau) $('#adhType').onchange = load;
    if ($('#adhPaiement')) $('#adhPaiement').onchange = load;
    if ($('#adhEtoiles')) $('#adhEtoiles').onchange = load;
    if ($('#adhNotationNegative')) $('#adhNotationNegative').onchange = load;
    // compat old id
    if ($('#adhMalus')) $('#adhMalus').onchange = load;
    $('#refreshAdhBtn').onclick = () => { load(); toast('Liste actualisée.'); };
    $('#addAdhBtn').onclick = () => adherentForm(isBureau ? { type_code: 'BE', niveau: 'Bureau exécutif' } : null, load);
    load();
  }

  function renderMembersTable(list, { mode = 'adherents', reload } = {}) {
    const isBureau = mode === 'bureau';
    const t = $('#adhTable');
    if (!list.length) {
      t.innerHTML = UI.emptyState(isBureau ? '🏛️' : '👤', isBureau ? 'Aucun membre du Bureau exécutif trouvé.' : 'Aucun adhérent trouvé.');
      return;
    }

    t.innerHTML = `<div class="table-wrap"><table class="data">
      <thead><tr>
        <th width="40"><input type="checkbox" id="selectAllAdh" /></th>
        <th>Matricule</th>
        <th>Nom & Prénom</th>
        <th>${isBureau ? 'Badge spécial' : 'Téléphone'}</th>
        <th>${isBureau ? 'Type badge' : 'Wilaya'}</th>
        <th>${isBureau ? 'Wilaya' : 'Type'}</th>
        <th>Notation</th>
        <th>${isBureau ? 'Fin adhésion' : 'Fin adhésion'}</th>
        <th>Payé</th>
        <th></th>
      </tr></thead><tbody>
      ${list.map((a) => {
        const expiry = getExpirationInfo(a);
        const expiryHtml = expiry
          ? `<div style="font-weight:600;color:${expiry.isExpired ? '#dc2626' : expiry.isSoon ? '#d97706' : 'var(--text)'}">${esc(expiry.expirationText)}</div><div class="muted" style="font-size:11px">${expiry.isExpired ? 'Expirée' : expiry.isSoon ? `Expire dans ${expiry.daysLeft} jour${expiry.daysLeft > 1 ? 's' : ''}` : 'Valide'}</div>`
          : '<span class="muted">—</span>';
        const cvBadge = (a.profession || a.fonction || a.diplome || a.nom_soc) ? `<div style="margin-top:3px"><span class="tag" style="background:#f1f5f9;color:#475569;border:1px solid #e2e8f0;font-size:10px;padding:2px 6px">📄 ${esc((a.profession || a.fonction || '').slice(0,18) || a.nom_soc?.slice(0,18) || 'CV')}</span></div>` : '';
        const nameCell = `<div class="cell-strong">${esc((a.nom || '').trim() || '—')} ${esc((a.prenom || '').trim() || '')}</div>${a.nom_soc ? `<div style="font-size:11px;color:var(--muted)">${esc(a.nom_soc)}</div>` : ''}${cvBadge}`;
        const paiementHtml = a.paiement_mode === 'non_assujetti' ? '<span class="tag" style="background:#f0ead8;color:#8a6e18">⊘ Non assujetti</span>' : a.paiement_mode ? '<span class="tag tag-actif">✓ Oui</span>' : '<span class="tag tag-inactif">✕ Non</span>';
        return `<tr>
        <td><input type="checkbox" class="adh-checkbox" value="${a.id}" /></td>
        <td><span class="mono" style="font-weight:bold; color:var(--gold); font-size:13px;">${esc(a.matricule || '—')}</span></td>
        <td>${nameCell}</td>
        <td>${isBureau ? specialBadge() : esc(a.telephone || '—')}</td>
        <td>${isBureau ? esc(a.bureau_badge_type || '—') : esc(a.wilaya_nom || '—')}</td>
        <td>${isBureau ? esc(a.wilaya_nom || '—') : UI.typeTag(a.type_libelle || '—')}</td>
        <td>${(parseInt(a.notation_negative ?? a.malus,10)||0) > 0 ? renderNotationNegativeCompact(a.notation_negative ?? a.malus) : renderStars(a.etoiles)}</td>
        <td>${expiryHtml}</td>
        <td>${paiementHtml}</td>
        <td><div class="row-actions">
          <button class="btn btn-dark btn-sm" data-view="${a.id}">Voir</button>
          ${isBureau ? '' : `<button class="btn btn-gold btn-sm" data-renew="${a.id}">Renouveler</button>`}
          <button class="btn btn-dark btn-sm" data-edit="${a.id}">✎</button>
          <button class="btn btn-danger btn-sm" data-del="${a.id}">✕</button>
        </div></td>
      </tr>`;}).join('')}
      </tbody></table></div>
      <div class="muted" style="margin-top:8px;font-size:12px">★ Notation : étoiles (or) ou <span style="color:#dc2626">● points en moins</span> (rouge) si noté</div>`;

    const selectAll = $('#selectAllAdh');
    const checkboxes = t.querySelectorAll('.adh-checkbox');
    const bulkBtn = $('#bulkDeleteAdhBtn');
    const countSpan = $('#bulkAdhCount');

    function updateBulkBtn() {
      const checkedCount = t.querySelectorAll('.adh-checkbox:checked').length;
      countSpan.textContent = checkedCount;
      bulkBtn.style.display = checkedCount > 0 ? 'inline-block' : 'none';
      selectAll.checked = checkedCount === checkboxes.length && checkboxes.length > 0;
    }

    selectAll.onchange = () => {
      checkboxes.forEach(cb => cb.checked = selectAll.checked);
      updateBulkBtn();
    };
    checkboxes.forEach(cb => cb.onchange = updateBulkBtn);

    t.querySelectorAll('[data-view]').forEach((b) => b.onclick = () => adherentDetail(b.dataset.view, reload));
    t.querySelectorAll('[data-renew]').forEach((b) => b.onclick = async () => {
      const current = await API.adherent(b.dataset.renew);
      const today = new Date().toISOString().slice(0, 10);
      adherentForm({ ...current, date_adhesion: today, __renewal: true }, reload);
      setTimeout(() => $('#fDate')?.focus(), 30);
    });
    t.querySelectorAll('[data-edit]').forEach((b) => b.onclick = async () => adherentForm(await API.adherent(b.dataset.edit), reload));
    t.querySelectorAll('[data-del]').forEach((b) => b.onclick = () => {
      confirm('Supprimer définitivement cette fiche ?', async () => {
        await API.deleteAdherent(b.dataset.del);
        toast('Fiche supprimée.');
        reload && reload();
      });
    });
  }

  /* ----- Formulaire adhérent ----- */
  function adherentForm(adh, onDone) {
    const isEdit = !!adh?.id;
    const isRenewal = !!adh?.__renewal;
    const today = new Date().toISOString().slice(0, 10);
    const currTypeCode = adh?.type_code || 'AD';
    const currNiveau = adh?.niveau || (currTypeCode === 'BE' ? 'Bureau exécutif' : 'Adhérent Simple');
    const currPaiementMode = (adh?.paiement_mode || '').toLowerCase();
    const currPaiementRef = adh?.paiement_ref || '';
    const currPaiementBanque = adh?.paiement_banque || '';
    const currEtoiles = Number.parseInt(adh?.etoiles, 10) || 0;
    const currNotationNegative = Number.parseInt(adh?.notation_negative ?? adh?.malus, 10) || 0;
    const currBureauCode = adh?.bureau_code || '';
    const currBadgeType = adh?.bureau_badge_type || '';
    const currQualiteAr = adh?.qualite_ar || '';
    const currMatricule = adh?.matricule || '';
    const currFonction = adh?.fonction || '';
    const currDiplome = adh?.diplome || '';
    const currProfession = adh?.profession || '';
    const currCarteRemise = Number.parseInt(adh?.carte_remise, 10) === 1;
    const allowBE = canAccessBE();
    const hasCV = !!(currFonction || currDiplome || currProfession);
openModal(
  isRenewal ? "Renouveler l'adhésion" : (isEdit ? "Modifier l'adhérent" : 'Nouvelle fiche'),
  `
  <style>
    #modal .modal { max-width: 900px !important; width: 96% !important; }
    #cvSection { grid-column:1 / -1 !important; width:100% !important; margin:18px 0 0 0 !important; padding:32px 28px !important; border:1.5px solid var(--border-strong) !important; border-radius:16px !important; background:var(--panel) !important; box-shadow:var(--shadow) !important; box-sizing:border-box !important; }
    #cvSection .form-grid { gap:22px !important; grid-template-columns:1fr 1fr !important; }
    #cvSection .field input { padding:14px 16px !important; font-size:16px !important; height:52px !important; border-radius:10px !important; }
    #cvSection .field label { font-size:14px !important; font-weight:700 !important; }
    /* Correctifs formulaire adhérent */
    #adhForm .adh-check-field {
      display: flex !important;
      align-items: center !important;
      padding-top: 24px;
    }

    #adhForm .adh-check-label {
      display: inline-flex !important;
      align-items: center !important;
      gap: 10px !important;
      margin: 0 !important;
      cursor: pointer;
      white-space: nowrap;
      color: var(--text-dim);
      font-weight: 600;
    }

    #adhForm .adh-check-label input[type="checkbox"] {
      width: 18px !important;
      height: 18px !important;
      margin: 0 !important;
      padding: 0 !important;
      flex: 0 0 auto !important;
      accent-color: var(--blue);
    }

    #adhForm .paiement-options {
      display: flex;
      gap: 18px;
      flex-wrap: wrap;
      padding: 10px 0 4px;
    }

    #adhForm .paiement-option {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      color: var(--text-dim);
      font-weight: 600;
    }

    #adhForm .paiement-option input[type="radio"] {
      width: 18px !important;
      height: 18px !important;
      margin: 0 !important;
      padding: 0 !important;
      accent-color: var(--blue);
    }
  </style>

  <form id="adhForm">
    ${isRenewal ? `
      <div style="margin:0 0 14px;padding:10px 12px;border-radius:10px;background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8">
        Modifiez la date d'adhésion puis enregistrez. Vous pouvez aussi ajuster les autres champs si nécessaire.
      </div>
    ` : ''}

    <div class="form-grid">

      <div class="field">
        <label>Nom</label>
        <input name="nom" value="${esc(adh?.nom || '')}" required />
      </div>

      <div class="field">
        <label>Prénom</label>
        <input name="prenom" value="${esc(adh?.prenom || '')}" required />
      </div>

      <div class="field">
        <label>Nom (Arabe)</label>
        <input name="nom_ar" value="${esc(adh?.nom_ar || '')}" dir="rtl" />
      </div>

      <div class="field">
        <label>Prénom (Arabe)</label>
        <input name="prenom_ar" value="${esc(adh?.prenom_ar || '')}" dir="rtl" />
      </div>

      <div class="field" style="display:none">
        <label>Nom de société (ancien)</label>
        <input name="nom_soc" id="fNomSocTop" value="${esc(adh?.nom_soc || '')}"  />
      </div>

      <div class="field">
        <label>Téléphone</label>
        <input name="telephone" value="${esc(adh?.telephone || '')}" />
      </div>

      <div class="field">
        <label>WhatsApp</label>
        <input name="whatsapp" value="${esc(adh?.whatsapp || '')}" />
      </div>

      <div class="field">
        <label>Viber</label>
        <input name="viber" value="${esc(adh?.viber || '')}" />
      </div>

      <div class="field">
        <label>Email</label>
        <input type="email" name="email" value="${esc(adh?.email || '')}" />
      </div>

      <div class="field full">
        <label>Adresse personnelle</label>
        <input name="adresse_personnelle" value="${esc(adh?.adresse_personnelle || '')}"  />
      </div>

      <div class="field">
        <label>Date de naissance</label>
        <input type="date" name="date_naissance" value="${esc(adh?.date_naissance ? String(adh.date_naissance).slice(0, 10) : '')}" />
      </div>

      <div class="field">
        <label>NIN (18 chiffres)</label>
        <input name="nin" value="${esc(adh?.nin || '')}" maxlength="18" pattern="[0-9]{18}" placeholder="18 chiffres" />
      </div>

      <div class="field">
        <label>Type de document</label>
        <select name="doc_type" id="fDocType">
          ${docTypeOptions(adh?.doc_type || 'RC')}
        </select>
      </div>

      <div class="field">
        <label>Numéro du document</label>
        <input name="doc_numero" id="fDocNum" value="${esc(adh?.doc_numero || '')}" />
        <small class="muted" id="docHint"></small>
      </div>

      <div class="field">
        <label>Autre numéro de RC (si besoin)</label>
        <input name="doc_numero_2" value="${esc(adh?.doc_numero_2 || '')}" />
      </div>

      <div class="field">
        <label>Wilaya / pays</label>
        <select name="wilaya_code" id="fWilaya">
          ${wilayaOptions(adh?.wilaya_code || '16')}
        </select>
      </div>

      <div class="field" id="fManualMatriculeWrap">
        <label>Matricule manuel *</label>
        <input name="matricule" id="fManualMatricule" value="${esc(currMatricule)}" maxlength="40" placeholder="Saisir le matricule" />
      </div>

      <div class="field" id="fQualiteArWrap">
        <label>الصفة *</label>
        <input name="qualite_ar" id="fQualiteAr" value="${esc(currQualiteAr)}" dir="rtl" maxlength="100" />
        
      </div>

      <div class="field">
        <label>Type de membre</label>
        <select id="fTypeSelect">
          <option value="Adhérent Simple" data-code="AD" ${currTypeCode === 'AD' && !currNiveau.toLowerCase().includes('gold') ? 'selected' : ''}>
            Adhérent simple (AD)
          </option>

          <option value="Adhérent Gold" data-code="AD" ${currTypeCode === 'AD' && currNiveau.toLowerCase().includes('gold') ? 'selected' : ''}>
            Adhérent gold (AD)
          </option>

          <option value="Membre Actif" data-code="MA" ${currTypeCode === 'MA' ? 'selected' : ''}>
            Membre Actif (MA)
          </option>

          <option value="Conseiller" data-code="CR" ${currTypeCode === 'CR' ? 'selected' : ''}>
            Conseiller (CR)
          </option>

          ${allowBE ? `
            <option value="Bureau exécutif" data-code="BE" ${currTypeCode === 'BE' ? 'selected' : ''}>
              Bureau exécutif (BE)
            </option>
          ` : ''}
        </select>

        <input type="hidden" name="type_code" id="fTypeCode" value="${esc(currTypeCode)}" />
        <input type="hidden" name="niveau" id="fNiveau" value="${esc(currNiveau)}" />
      </div>

      <div class="field">
        <label>Date d'adhésion</label>
        <input 
          type="date" 
          name="date_adhesion" 
          id="fDate" 
          value="${esc(adh?.date_adhesion ? String(adh.date_adhesion).slice(0, 10) : '')}" 
        />
      </div>

      <div class="field">
        <label>Année (auto)</label>
        <input id="fAnnee" value="${esc(adh?.annee || new Date(today).getFullYear())}" disabled />
      </div>

      <div class="field">
        <label>Photo</label>
        <input type="file" name="photo" accept="image/*" />
      </div>



      <div class="field" id="fBureauCodeWrap">
        <label>Code Bureau exécutif (3 caractères) *</label>
        <input name="bureau_code" id="fBureauCode" value="${esc(currBureauCode)}" maxlength="3" placeholder="ABC" />
      </div>

      <div class="field" id="fBadgeTypeWrap">
        <label>Type affiché sur badge *</label>
        <input name="bureau_badge_type" id="fBadgeType" value="${esc(currBadgeType)}" />
      </div>

      <div class="field" id="fEtoilesWrap">
        <label>Étoiles</label>
        <select name="etoiles" id="fEtoiles">
          <option value="0" ${currEtoiles === 0 ? 'selected' : ''}>0 ★ — Aucune</option>
          <option value="1" ${currEtoiles === 1 ? 'selected' : ''}>1 ★</option>
          <option value="2" ${currEtoiles === 2 ? 'selected' : ''}>2 ★★</option>
          <option value="3" ${currEtoiles === 3 ? 'selected' : ''}>3 ★★★</option>
          <option value="4" ${currEtoiles === 4 ? 'selected' : ''}>4 ★★★★</option>
          <option value="5" ${currEtoiles === 5 ? 'selected' : ''}>5 ★★★★★ — Excellent</option>
        </select>
      </div>

      <div class="field" id="fNotationNegativeWrap">
        <label>Notation négative</label>
        <select name="notation_negative" id="fNotationNegative">
          <option value="0" ${currNotationNegative === 0 ? 'selected' : ''}>0 — Aucune</option>
          <option value="1" ${currNotationNegative === 1 ? 'selected' : ''}>1 point en moins</option>
          <option value="2" ${currNotationNegative === 2 ? 'selected' : ''}>2 points en moins</option>
          <option value="3" ${currNotationNegative === 3 ? 'selected' : ''}>3 points en moins</option>
          <option value="4" ${currNotationNegative === 4 ? 'selected' : ''}>4 points en moins</option>
          <option value="5" ${currNotationNegative === 5 ? 'selected' : ''}>5 points en moins — Max</option>
        </select>
      </div>

      <div class="field adh-check-field">
        <label class="adh-check-label">
          <input type="checkbox" name="carte_remise" value="1" ${currCarteRemise ? 'checked' : ''} />
          <span>Carte remise</span>
        </label>
      </div>   

      <div class="field full" style="margin-top:4px">
        <button type="button" class="btn btn-dark btn-sm" id="toggleCVBtn" style="width:100%;justify-content:center">
          <span>📄 CV — Informations professionnelles</span>
        </button>
      </div>

      <div id="cvSection" style="${hasCV ? "" : "display:none;"}border:1.5px solid var(--border-strong);border-radius:16px;padding:32px 28px;background:var(--panel);margin:18px 0 0 0;box-shadow:var(--shadow);width:100%;box-sizing:border-box;grid-column:1 / -1">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
          <span style="font-size:16px">📄</span>
          <strong style="font-size:14px;color:var(--text)">Informations professionnelles</strong>
        </div>
        <div class="form-grid" style="margin:0;gap:20px">
          <div class="field">
            <label>Société / Entreprise</label>
            <input name="nom_soc" id="fNomSocCV" value="${esc(adh?.nom_soc || '')}"  style="padding:14px 16px;font-size:16px;height:52px" />
          </div>
          <div class="field">
            <label>Fonction</label>
            <input name="fonction" id="fFonction" value="${esc(currFonction)}" style="padding:14px 16px;font-size:16px;height:52px" />
          </div>
          <div class="field">
            <label>Diplôme</label>
            <input name="diplome" id="fDiplome" value="${esc(currDiplome)}"  style="padding:14px 16px;font-size:16px;height:52px" />
          </div>
          <div class="field">
            <label>Profession</label>
            <input name="profession" id="fProfession" value="${esc(currProfession)}"  style="padding:14px 16px;font-size:16px;height:52px" />
          </div>
        </div>
      </div>

     <div class="field full" id="fNonAssujettiWrap">
  <input type="checkbox" id="fNonAssujetti" name="non_assujetti" ${currPaiementMode === 'non_assujetti' ? 'checked' : ''}>
  <label for="fNonAssujetti">Non assujetti</label>
</div>
<div class="field full" id="fPaiementModeWrap">
  <label>Mode de paiement</label>
  <div class="paiement-options">
    <label class="paiement-option">
      <input type="radio" name="paiement_mode" value="" ${!currPaiementMode ? 'checked' : ''} />
      <span>Non renseigné</span>
    </label>
    <label class="paiement-option">
      <input type="radio" name="paiement_mode" value="cheque" ${currPaiementMode === 'cheque' ? 'checked' : ''} />
      <span>Chèque</span>
    </label>
    <label class="paiement-option">
      <input type="radio" name="paiement_mode" value="espece" ${currPaiementMode === 'espece' ? 'checked' : ''} />
      <span>Espèce</span>
    </label>
    <label class="paiement-option">
      <input type="radio" name="paiement_mode" value="virement" ${currPaiementMode === 'virement' ? 'checked' : ''} />
      <span>Virement</span>
    </label>
  </div>
</div>
<div class="field" id="fPaiementRefWrap">
  <label id="fPaiementRefLabel">Référence</label>
  <input name="paiement_ref" id="fPaiementRef" value="${esc(currPaiementRef)}" />
  <small class="muted" id="fPaiementRefHint"></small>
</div>
<div class="field" id="fPaiementBanqueWrap">
  <label id="fPaiementBanqueLabel">Banque</label>
  <input name="paiement_banque" id="fPaiementBanque" value="${esc(currPaiementBanque)}" />
</div>

      <div class="field full">
        <label>Description / Notes</label>
        <textarea name="description" rows="3" placeholder="Informations complémentaires, observations…" style="resize:vertical">${esc(adh?.description || '')}</textarea>
      </div>

    </div>

    <div class="field full" style="margin-top:6px">
      <label>Matricule :</label>
      <div class="matricule-preview" id="matPreview">
        ${esc(adh?.matricule || '…')}
      </div>
    </div>

    <div class="form-error" id="adhFormErr"></div>

    <div class="modal-foot">
      <button type="button" class="btn btn-ghost" id="adhCancel">Annuler</button>
      <button type="submit" class="btn btn-gold">${isEdit ? 'Enregistrer' : 'Créer la fiche'}</button>
    </div>
  </form>
  `,
  true
);

    function updateDocHint() {
      const sel = $('#fDocType');
      const opt = sel.options[sel.selectedIndex];
      const min = +opt.dataset.min, max = +opt.dataset.max;
      const input = $('#fDocNum');
      input.maxLength = max;
      $('#docHint').textContent = (min === max) ? `Exactement ${min} caractères.` : `Entre ${min} et ${max} caractères.`;
    }

    function updateMemberTypeFields() {
      if (isSaisieOnly() && $('#fTypeCode').value === 'BE') {
        $('#fTypeCode').value = 'AD';
        $('#fNiveau').value = 'Adhérent Simple';
      }
      const typeCode = $('#fTypeCode').value;
      const isBE = typeCode === 'BE';
      $('#fBureauCodeWrap').style.display = isBE ? '' : 'none';
      $('#fBadgeTypeWrap').style.display = isBE ? '' : 'none';
      $('#fEtoilesWrap').style.display = isBE ? 'none' : '';
      $('#fBureauCode').required = isBE;
      $('#fBadgeType').required = isBE;
      if (isBE) {
        $('#fNiveau').value = 'Bureau exécutif';
        $('#fEtoiles').value = '0';
      } else if ($('#fTypeSelect').value) {
        $('#fNiveau').value = $('#fTypeSelect').value;
      }
    }

    function updatePaiementFields() {
 const nonAssujetti = $('#fNonAssujetti') && $('#fNonAssujetti').checked;
 const mode = nonAssujetti ? '' : (document.querySelector('input[name="paiement_mode"]:checked')?.value || '');
 const refWrap = $('#fPaiementRefWrap');
 const bankWrap = $('#fPaiementBanqueWrap');
 const refInput = $('#fPaiementRef');
 const bankInput = $('#fPaiementBanque');
 const refLabel = $('#fPaiementRefLabel');
 const bankLabel = $('#fPaiementBanqueLabel');
 const refHint = $('#fPaiementRefHint');
 const modeWrap = $('#fPaiementModeWrap');

 if (nonAssujetti) {
  modeWrap.style.display = 'none';
  refWrap.style.display = 'none';
  bankWrap.style.display = 'none';
  refInput.required = false;
  bankInput.required = false;
  refInput.value = '';
  bankInput.value = '';
  document.querySelectorAll('input[name="paiement_mode"]').forEach(el => { if (el.id !== 'fNonAssujetti') el.checked = false; });
  return;
 }

 modeWrap.style.display = '';

 refInput.minLength = 0;
 refInput.maxLength = 524288;
 refInput.removeAttribute('pattern');
 refInput.removeAttribute('inputmode');
 refHint.textContent = '';

 if (mode === 'cheque') {
  refWrap.style.display = '';
  bankWrap.style.display = '';
  refLabel.textContent = 'Numéro de chèque *';
  bankLabel.textContent = 'Banque *';
  refInput.placeholder = '7 chiffres';
  bankInput.placeholder = 'Nom de la banque';
  refInput.required = true;
  bankInput.required = true;
  refInput.minLength = 7;
  refInput.maxLength = 7;
  refInput.setAttribute('pattern', '[0-9]{7}');
  refInput.setAttribute('inputmode', 'numeric');
  refHint.textContent = 'Le numéro de chèque doit contenir exactement 7 chiffres.';
 } else if (mode === 'virement') {
  refWrap.style.display = 'none';
  bankWrap.style.display = '';
  bankLabel.textContent = 'Information virement *';
  bankInput.placeholder = 'Information sur le virement';
  refInput.required = false;
  bankInput.required = true;
  refInput.value = '';
 } else if (mode === 'espece') {
  refWrap.style.display = 'none';
  bankWrap.style.display = 'none';
  refInput.required = false;
  bankInput.required = false;
  refInput.value = '';
  bankInput.value = '';
 } else {
  refWrap.style.display = 'none';
  bankWrap.style.display = 'none';
  refInput.required = false;
  bankInput.required = false;
  refInput.value = '';
  bankInput.value = '';
 }
}

    function updateWilayaFields() {
      const foreign = $('#fWilaya').value === 'ETR';
      const matriculeWrap = $('#fManualMatriculeWrap');
      const matriculeInput = $('#fManualMatricule');
      const qualiteWrap = $('#fQualiteArWrap');
      const qualiteInput = $('#fQualiteAr');

      matriculeWrap.style.display = foreign ? '' : 'none';
      qualiteWrap.style.display = foreign ? '' : 'none';
      matriculeInput.required = foreign;
      qualiteInput.required = foreign;
    }

    async function refreshMatricule() {
      const w = $('#fWilaya').value;
      const t = $('#fTypeCode').value;
      updateWilayaFields();

      if (w === 'ETR') {
        $('#matPreview').textContent = $('#fManualMatricule').value.trim() || 'Saisissez le matricule manuel ci-dessus';
        return;
      }
      const bureauCode = ($('#fBureauCode').value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
      const an = $('#fDate').value ? new Date($('#fDate').value).getFullYear() : new Date().getFullYear();
      $('#fAnnee').value = an;
      if (t === 'BE' && bureauCode.length < 3) {
        $('#matPreview').textContent = 'veuillez saisir le code adherent BE';
        return;
      }
      try {
        const r = await API.previewMatricule(w, t, an, bureauCode);
        if (r && r.matricule) $('#matPreview').textContent = r.matricule ;
      } catch {}
    }

    // CV toggle + sync societe
    const cvSection = $('#cvSection');
    const toggleCVBtn = $('#toggleCVBtn');
    const fNomSocCV = $('#fNomSocCV');
    const fNomSocTop = $('#fNomSocTop');
    if (toggleCVBtn && cvSection) {
      toggleCVBtn.onclick = () => {
        const hidden = cvSection.style.display === 'none';
        cvSection.style.display = hidden ? '' : 'none';
      };
    }
    if (fNomSocCV && fNomSocTop) {
      fNomSocCV.oninput = () => { fNomSocTop.value = fNomSocCV.value; };
      fNomSocTop.oninput = () => { fNomSocCV.value = fNomSocTop.value; };
      // init sync
      fNomSocTop.value = fNomSocCV.value;
    }

    $('#fDocType').onchange = updateDocHint;
    $('#fWilaya').onchange = refreshMatricule;
    $('#fManualMatricule').oninput = () => {
      if ($('#fWilaya').value === 'ETR') {
        $('#matPreview').textContent = $('#fManualMatricule').value.trim() || 'Saisissez le matricule manuel ci-dessus';
      }
    };
    $('#fTypeSelect').onchange = () => {
      const opt = $('#fTypeSelect').options[$('#fTypeSelect').selectedIndex];
      $('#fTypeCode').value = opt.dataset.code;
      $('#fNiveau').value = opt.value;
      updateMemberTypeFields();
      refreshMatricule();
    };
    $('#fBureauCode').oninput = (e) => {
      e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
      refreshMatricule();
    };
    document.querySelectorAll('input[name="paiement_mode"]').forEach((el) => el.onchange = updatePaiementFields);
    if ($('#fNonAssujetti')) $('#fNonAssujetti').onchange = updatePaiementFields;
    $('#fDate').onchange = refreshMatricule;
    updateDocHint();
    updateMemberTypeFields();
    updatePaiementFields();
    refreshMatricule();

    $('#adhCancel').onclick = closeModal;
    $('#adhForm').onsubmit = async (e) => {
      e.preventDefault();
      $('#adhFormErr').textContent = '';
      // sync societe from CV section
      const cvNomSoc = $('#fNomSocCV')?.value || '';
      const topNomSoc = $('#fNomSocTop')?.value || '';
      const finalSoc = cvNomSoc || topNomSoc;
      if ($('#fNomSocCV')) $('#fNomSocCV').value = finalSoc;
      if ($('#fNomSocTop')) $('#fNomSocTop').value = finalSoc;
      const fd = new FormData(e.target);
      // ensure nom_soc is correctly set (FormData may have duplicate, keep last)
      fd.set('nom_soc', finalSoc);
      if ($('#fNonAssujetti') && $('#fNonAssujetti').checked) { fd.set('paiement_mode', 'non_assujetti'); fd.delete('paiement_ref'); fd.delete('paiement_banque'); }
      try {
        let saved = null;
        if (isEdit) {
          saved = await API.updateAdherent(adh.id, fd);
          toast(isRenewal ? 'Adhésion renouvelée.' : 'Fiche mise à jour.');
        } else {
          saved = await API.createAdherent(fd);
          toast('Fiche créée : ' + saved.adherent.matricule);
        }
        closeModal();
        if (saved?.adherent?.type_code === 'BE') bureauExecutifList();
        else onDone && onDone();
      } catch (err) {
        $('#adhFormErr').textContent = err.message;
      }
    };
  }

  /* ----- Détail adhérent ----- */
  async function adherentDetail(id, onBackList = null) {
    const a = await API.adherent(id);
    const backTo = onBackList || (a.type_code === 'BE' ? bureauExecutifList : adherentsList);
    const expiry = a.type_code !== 'BE' ? getExpirationInfo(a) : null;
    openModal('Fiche adhérent', `
      <div class="profile-head">
        <div id="detailPhoto"><div class="profile-photo-ph">${UI.initials(a.prenom, a.nom)}</div></div>
        <div>
          <h3 style="font-size:20px;color:var(--text)">${esc(a.nom || '')} ${esc(a.prenom || '')}</h3>
          ${(a.prenom_ar || a.nom_ar) ? `<div dir="rtl" style="font-size:16px;color:var(--text);margin-top:2px">${esc(a.nom_ar || '')} ${esc(a.prenom_ar || '')}</div>` : ''}
          <div class="mono" style="margin:6px 0">${esc(a.matricule || '—')}</div>
          ${a.type_code === 'BE' ? specialBadge() : UI.typeTag(a.type_libelle)} ${UI.niveauTag(a.niveau || '—')}
          <div style="margin-top:8px;display:flex;gap:12px;align-items:center;flex-wrap:wrap">
            ${renderStars(a.etoiles)}
            <span style="color:#dc2626">${renderNotationNegativeCompact(a.notation_negative ?? a.malus)}</span>
          </div>
          ${(a.nom_soc || a.profession || a.fonction) ? `<div class="muted" style="margin-top:6px;font-size:12px">🏢 ${esc(a.nom_soc || '—')} ${a.profession ? '· ' + esc(a.profession) : ''} ${a.fonction ? '· ' + esc(a.fonction) : ''}</div>` : ''}
        </div>
      </div>
      <div class="detail-grid">
        ${detailItem('Nom (Français)', a.nom || '—')}
        ${detailItem('Prénom (Français)', a.prenom || '—')}
        ${detailItem('Nom (Arabe)', a.nom_ar || '—')}
        ${detailItem('Prénom (Arabe)', a.prenom_ar || '—')}
        ${detailItem('Téléphone', a.telephone || '—')}
        ${detailItem('NIN', a.nin || '—')}
        ${detailItem(a.doc_type_libelle || 'Document', a.doc_numero || '—')}
        ${detailItem('Autre numéro RC', a.doc_numero_2 || '—')}
        ${detailItem('Email', a.email || '—')}
        ${detailItem('WhatsApp', a.whatsapp || '—')}
        ${detailItem('Viber', a.viber || '—')}
        ${detailItem('Adresse personnelle', a.adresse_personnelle || '—')}
        ${detailItem('Date de naissance', fmtDate(a.date_naissance))}
        ${detailItem('Wilaya / pays', a.wilaya_nom || '—')}
        ${a.qualite_ar ? detailItem('الصفة', a.qualite_ar) : ''}
        ${detailItem("Date d'adhésion", fmtDate(a.date_adhesion))}
        ${a.type_code === 'BE' ? '' : detailItem("Fin d'adhésion", expiry ? expiry.expirationText : '—')}
        ${detailItem('Année', a.annee || '—')}
        ${detailItem('Carte', Number.parseInt(a.carte_remise, 10) === 1 ? 'Remise' : 'Non remise')}
        ${detailItem('Notation (étoiles / négative)', `${a.etoiles ?? 0}/5 ${'★'.repeat(a.etoiles||0)}${'☆'.repeat(5-(a.etoiles||0))}  —  ${(a.notation_negative ?? a.malus ?? 0)==0 ? 'Aucune notation négative' : (a.notation_negative ?? a.malus)+' point(s) en moins'}`)}
        ${a.type_code === 'BE' ? detailItem('Code BE', a.bureau_code || '—') : ''}
        ${a.type_code === 'BE' ? detailItem('Type badge', a.bureau_badge_type || '—') : ''}
        ${detailItem('Mode de paiement', paiementLabel(a.paiement_mode) || '—')}
        ${detailItem('Référence paiement', a.paiement_ref || '—')}
        ${detailItem('Banque / CCP', a.paiement_banque || '—')}
      </div>

      <div class="panel" style="margin-top:14px">
        <div class="panel-head"><h3>📄 CV — Informations professionnelles</h3></div>
        <div class="detail-grid">
          ${detailItem('Société / Entreprise', a.nom_soc || '—')}
          ${detailItem('Fonction', a.fonction || '—')}
          ${detailItem('Diplôme', a.diplome || '—')}
          ${detailItem('Profession', a.profession || '—')}
        </div>
        <div class="muted" style="margin-top:8px;font-size:12px">Pas de CV détaillé — uniquement ces 4 champs.</div>
      </div>
      ${a.description ? `<div class="panel" style="margin-top:14px"><div class="panel-head"><h3>📝 Description / Notes</h3></div><div style="line-height:1.6;white-space:pre-wrap">${esc(a.description)}</div></div>` : ''}
      <div class="modal-foot">
        <button class="btn btn-ghost" id="dDossier">📄 Dossier à remplir</button>
        <button class="btn btn-ghost" id="dCarte">📇 Carte (recto/verso)</button>
        ${a.type_code !== 'BE' ? '<button class="btn btn-gold" id="dRenew">↻ Renouveler</button>' : ''}
        <button class="btn btn-dark" id="dEdit">✎ Modifier</button>
        <button class="btn btn-gold" id="dClose">Fermer</button>
      </div>`, true);

    if (a.photo) API.fileUrl(a.photo).then((url) => { $('#detailPhoto').innerHTML = `<img src="${url}" class="profile-photo" />`; }).catch(() => {});
    $('#dClose').onclick = closeModal;
    $('#dDossier').onclick = () => downloadDossier(a.id);
    $('#dCarte').onclick = () => downloadCarte(a.id, a.matricule);
    if ($('#dRenew')) $('#dRenew').onclick = () => {
      const today = new Date().toISOString().slice(0, 10);
      adherentForm({ ...a, date_adhesion: today, __renewal: true }, () => { closeModal(); backTo(); });
    };
    $('#dEdit').onclick = () => adherentForm(a, () => { closeModal(); backTo(); });
  }

  function detailItem(lbl, val) {
    return `<div class="detail-item"><div class="d-lbl">${esc(lbl)}</div><div class="d-val">${esc(val)}</div></div>`;
  }

  function downloadDossier(id) {
    try {
      const win = window.open('/api/adherents/' + id + '/dossier?token=' + API.getToken(), '_blank');
      if (!win) toast('Autorisez les pop-ups pour afficher le dossier.', 'error');
    } catch { toast('Impossible d\'ouvrir le dossier.', 'error'); }
  }

  function downloadCarte(id, matricule) {
    try {
      const win = window.open('/api/adherents/' + id + '/carte?token=' + API.getToken(), '_blank');
      if (!win) toast('Autorisez les pop-ups pour afficher la carte.', 'error');
    } catch { toast('Impossible d\'ouvrir la carte.', 'error'); }
  }

/* ============ DEMANDES ============ */

  async function demandesList() {
    const c = container();
    if (!canViewDemandes()) {
      c.innerHTML = UI.emptyState('🔒', 'Accès réservé aux comptes autorisés à consulter les demandes.');
      return;
    }
    const types = (REF.typesDemande || []);
    c.innerHTML = `
      <div class="toolbar" style="flex-wrap: wrap; gap: 10px;">
        <input type="search" id="demSearch" placeholder="Rechercher (objet, numéro, nom, matricule, email)…" />
        <select id="demStatut"><option value="">Tous statuts</option>${REF.statutsDemande.map((s) => `<option>${esc(s)}</option>`).join('')}</select>
        <select id="demPriorite"><option value="">Toutes priorités</option>${REF.priorites.map((p) => `<option>${esc(p)}</option>`).join('')}</select>
        <select id="demWilaya"><option value="">Toutes wilayas</option>${REF.wilayas.map((w) => `<option value="${w.code}">${w.code} — ${esc(w.nom)}</option>`).join('')}</select>
        <select id="demType"><option value="">Tous types</option>${types.map((t) => `<option>${esc(t)}</option>`).join('')}</select>
        <button class="btn btn-dark" id="refreshDemBtn" title="Rafraîchir">⟳ Rafraîchir</button>
        <button class="btn btn-danger" id="bulkDeleteDemBtn" style="display: none;">✕ Supprimer la sélection (<span id="bulkCount">0</span>)</button>
      </div>
      <div id="demTable"><div class="muted">Chargement…</div></div>`;

    async function load() {
      const params = {};
      const q = $('#demSearch').value.trim(); if (q) params.q = q;
      const s = $('#demStatut').value; if (s) params.statut = s;
      const p = $('#demPriorite').value; if (p) params.priorite = p;
      const w = $('#demWilaya').value; if (w) params.wilaya = w;
      const t = $('#demType').value; if (t) params.type_demande = t;
      renderDemTable(await API.demandes(params));
      updateBulkButton(); // Réinitialise le bouton après chargement
    }

    // Gestion du bouton de suppression en masse
    function updateBulkButton() {
      const checkedBoxes = document.querySelectorAll('.dem-checkbox:checked');
      const bulkBtn = $('#bulkDeleteDemBtn');
      const bulkCount = $('#bulkCount');
      
      if (checkedBoxes.length > 0) {
        bulkCount.textContent = checkedBoxes.length;
        bulkBtn.style.display = 'inline-block';
      } else {
        bulkBtn.style.display = 'none';
      }
    }

    // Clic sur le bouton de suppression en masse
    $('#bulkDeleteDemBtn').onclick = () => {
      const checkedBoxes = document.querySelectorAll('.dem-checkbox:checked');
      const idsToDelete = Array.from(checkedBoxes).map(cb => cb.value);

      confirm(`Supprimer ces ${idsToDelete.length} demandes définitivement ?`, async () => {
        try {
          // Boucle asynchrone pour tout supprimer
          await Promise.all(idsToDelete.map(id => API.deleteDemande(id)));
          toast(`${idsToDelete.length} demandes supprimées avec succès.`);
          load();
        } catch (err) {
          toast('Erreur lors de la suppression groupée : ' + err.message, 'error');
        }
      });
    };

    // Exposer updateBulkButton globalement ou l'attacher aux événements dans renderDemTable
    c.addEventListener('change', (e) => {
      if (e.target.classList.contains('dem-checkbox') || e.target.id === 'selectAllDem') {
        updateBulkButton();
      }
    });

    let timer;
    $('#demSearch').oninput = () => { clearTimeout(timer); timer = setTimeout(load, 280); };
    $('#demStatut').onchange = load;
    $('#demPriorite').onchange = load;
    $('#demWilaya').onchange = load;
    $('#demType').onchange = load;
    $('#refreshDemBtn').onclick = () => { load(); toast('Liste actualisée.'); };
    load();
  }

  function renderDemTable(list) {
    const t = $('#demTable');
    if (!list.length) { t.innerHTML = UI.emptyState('📨', 'Aucune demande.'); return; }
    
    t.innerHTML = `<div class="table-wrap"><table class="data">
    <thead><tr>
      <th width="40"><input type="checkbox" id="selectAllDem" /></th>
      <th>Nom</th><th>Prénom</th><th>Wilaya</th>
      <th>Date & Heure de création</th><th>Statut</th><th></th>
    </tr></thead><tbody>
    ${list.map((d) => `<tr>
      <td><input type="checkbox" class="dem-checkbox" value="${d.id}" /></td>
      <td class="cell-strong">${esc(d.nom)}</td>
      <td>${esc(d.prenom)}</td>
      <td>${esc(d.wilaya_nom || d.wilaya_code || '—')}</td>
      <td class="muted">${esc((d.created_at || '').replace('T', ' ').slice(0, 16))}</td>
      <td>${UI.statutTag(d.statut)}</td>
      <td><div class="row-actions">
        <button class="btn btn-dark btn-sm" data-view="${d.id}">${canEditDemandes() ? 'Traiter' : 'Voir'}</button>
        ${canEditDemandes() ? `<button class="btn btn-danger btn-sm" data-del="${d.id}">✕</button>` : ''}
      </div></td>
    </tr>`).join('')}
    </tbody></table></div>`;

    // Logique Tout Sélectionner / Tout Désélectionner
    const selectAll = $('#selectAllDem');
    const checkboxes = t.querySelectorAll('.dem-checkbox');

    selectAll.onchange = () => {
      checkboxes.forEach(cb => cb.checked = selectAll.checked);
    };

    t.querySelectorAll('[data-view]').forEach((b) => b.onclick = () => demandeDetail(b.dataset.view));
    t.querySelectorAll('[data-del]').forEach((b) => b.onclick = () => {
      confirm('Supprimer cette demande ?', async () => {
        await API.deleteDemande(b.dataset.del); toast('Demande supprimée.'); demandesList();
      });
    });
  }
  /* ----- Détail Demande ----- */
    /* ----- Détail Demande ----- */
  async function demandeDetail(id) {
    try {
      const d = await API.demande(id);

      const titre = `Demande ${d.numero || ('#' + d.id)}`;
      const objet = d.objet || d.titre_demande || '—';
      const telephone = d.num_tel || d.telephone || d.phone || '—';
      const dateCreation = String(d.created_at || d.date_creation || '').replace('T', ' ').slice(0, 16);

      const piecesHtml = d.pieces && d.pieces.length
        ? d.pieces.map((p) => `
            <button class="btn btn-dark btn-sm" data-file="${esc(p.filename)}">
              📎 ${esc(p.original_name || 'Pièce jointe')}
            </button>
          `).join(' ')
        : '<span class="muted">Aucune pièce jointe.</span>';

      openModal(titre, `
        <div class="detail-grid" style="margin-bottom:18px">
          ${detailItem('Numéro', d.numero || '—')}
          ${detailItem('Nom', d.nom || '—')}
          ${detailItem('Prénom', d.prenom || '—')}
          ${detailItem('Wilaya', d.wilaya_nom || d.wilaya || d.wilaya_code || '—')}
          ${detailItem('Téléphone', telephone)}
          ${detailItem('Matricule', d.matricule || '—')}
          ${detailItem('Priorité', d.priorite || 'Normale')}
          ${detailItem('Statut', d.statut || 'En attente')}
          ${detailItem('Source', d.source || 'site')}
          ${detailItem('Date de création', dateCreation || '—')}
        </div>

        <div class="detail-item full" style="margin-top:12px">
          <div class="d-lbl">Objet</div>
          <div class="d-val">${esc(objet)}</div>
        </div>

        <div class="detail-item full" style="margin-top:12px">
          <div class="d-lbl">Description</div>
          <div class="d-val" style="line-height:1.6;white-space:pre-wrap">${esc(d.description || '—')}</div>
        </div>

        <div style="margin-top:14px">
          <div class="d-lbl" style="margin-bottom:8px">Pièces jointes</div>
          ${piecesHtml}
        </div>

        <div class="panel" style="margin-top:18px">
          <div class="panel-head">
            <h3>${canEditDemandes() ? 'Traitement de la demande' : 'Consultation de la demande'}</h3>
          </div>

          <div class="form-grid">
            <div class="field">
              <label>Statut</label>
              <select id="dStatut" ${canEditDemandes() ? '' : 'disabled'}>
                ${REF.statutsDemande.map((s) => `
                  <option value="${esc(s)}" ${s === d.statut ? 'selected' : ''}>${esc(s)}</option>
                `).join('')}
              </select>
            </div>

            <div class="field">
              <label>Priorité</label>
              <select id="dPriorite" ${canEditDemandes() ? '' : 'disabled'}>
                ${REF.priorites.map((p) => `
                  <option value="${esc(p)}" ${p === d.priorite ? 'selected' : ''}>${esc(p)}</option>
                `).join('')}
              </select>
            </div>

            <div class="field full">
              <label>Affecté à</label>
              <input id="dAffecteA" value="${esc(d.affecte_a || '')}" ${canEditDemandes() ? '' : 'disabled'} placeholder="Nom du responsable..." />
            </div>

            <div class="field full">
              <label>Réponse / traitement</label>
              <textarea id="dReponse" rows="4" ${canEditDemandes() ? '' : 'disabled'} placeholder="Écrire la réponse ou le suivi du traitement...">${esc(d.reponse || '')}</textarea>
            </div>
          </div>

          ${canEditDemandes() ? `
            <div style="text-align:right;margin-top:10px">
              <button class="btn btn-gold" id="demSave">Enregistrer le traitement</button>
            </div>
          ` : `
            <div class="muted" style="margin-top:10px">
              Ce compte peut consulter les demandes sans les modifier.
            </div>
          `}
        </div>

        <div class="modal-foot">
          ${canEditDemandes() && d.statut !== 'Clôturée' ? '<button class="btn btn-dark" id="demCloturer">Clôturer</button>' : ''}
          <button class="btn btn-gold" id="demClose">Fermer</button>
        </div>
      `, true);

      document.querySelectorAll('[data-file]').forEach((b) => {
        b.onclick = async () => {
          try {
            window.open(await API.fileUrl(b.dataset.file), '_blank');
          } catch {
            toast('Fichier indisponible.', 'error');
          }
        };
      });

      $('#demClose').onclick = closeModal;

      if ($('#demCloturer')) {
        $('#demCloturer').onclick = async () => {
          try {
            await API.cloturerDemande(d.id);
            toast('Demande clôturée.');
            closeModal();
            demandesList();
          } catch (err) {
            toast('Erreur lors de la clôture : ' + err.message, 'error');
          }
        };
      }

      if ($('#demSave')) {
        $('#demSave').onclick = async () => {
          try {
            await API.updateDemande(d.id, {
              statut: $('#dStatut').value,
              priorite: $('#dPriorite').value,
              affecte_a: $('#dAffecteA').value.trim(),
              reponse: $('#dReponse').value.trim()
            });

            toast('Demande mise à jour avec succès.');
            closeModal();
            demandesList();
          } catch (err) {
            toast('Erreur lors de la mise à jour : ' + err.message, 'error');
          }
        };
      }
    } catch (err) {
      toast('Impossible d’ouvrir la demande : ' + err.message, 'error');
    }
  }

/* ============ GESTION DOCUMENTAIRE (SUPPRESSION PAR ADHERENT_ID) ============ */
async function documentsList() {
  const c = container();
  if (!canViewDocuments()) {
    c.innerHTML = UI.emptyState('🔒', 'Accès réservé aux comptes autorisés à consulter les documents.');
    return;
  }
  const readOnlyDocs = !(ROLE === 'admin' || ROLE === 'president');
  c.innerHTML = `
    <div class="toolbar" style="flex-wrap: wrap; gap: 10px; align-items: center;">
      <input type="search" id="docSearch" placeholder="Rechercher (nom, prénom, matricule)…" />
      <select id="docWilaya">
        <option value="">Toutes wilayas</option>
        ${REF.wilayas.map((w) => `<option value="${w.code}">${w.code} — ${esc(w.nom)}</option>`).join('')}
      </select>
      <button class="btn btn-dark" id="refreshDocsBtn" title="Rafraîchir">⟳</button>
      
      ${readOnlyDocs ? '' : `<button class="btn btn-danger" id="deleteBulkBtn" style="display: none; margin-left: auto;">
        ✕ Supprimer la sélection (<span id="selectedCount">0</span>)
      </button>`}
    </div>
    <div id="docTable"><div class="muted">Chargement de la liste des adhérents…</div></div>`;

  let currentFilteredList = [];

  async function load() {
    try {
      const liste = await API.adherentsStatut();
      renderDocTable(liste);
    } catch (err) {
      $('#docTable').innerHTML = `<div class="error">Erreur : ${err.message}</div>`;
    }
  }

  function renderDocTable(liste) {
    const t = $('#docTable');
    if (!liste.length) { t.innerHTML = UI.emptyState('👥', 'Aucun adhérent trouvé.'); return; }

    const searchQuery = $('#docSearch').value.toLowerCase().trim();
    const selectedWilaya = $('#docWilaya').value;

    currentFilteredList = liste.filter(a => {
      const matchSearch = `${a.matricule || ''} ${a.nom || ''} ${a.prenom || ''}`.toLowerCase().includes(searchQuery);
      const matchWilaya = !selectedWilaya || a.wilaya_code === selectedWilaya;
      return matchSearch && matchWilaya;
    });

    t.innerHTML = `
      <div class="table-wrap">
        <table class="data">
          <thead>
            <tr>
              <th width="40" style="text-align:center;">
                <input type="checkbox" id="selectAllDocs" />
              </th>
              <th>Matricule</th>
              <th>Nom & Prénom</th>
              <th>Dernière fusion</th>
              <th width="200" style="text-align:right;">Fichier complet</th>
            </tr>
          </thead>
          <tbody>
            ${currentFilteredList.map((a) => {
              const hasFile = !!a.filename;
              const dateAffichage = a.updated_at ? esc(a.updated_at.slice(0, 10)) : '—';
              
              return `
                <tr>
                  <td style="text-align:center;">
                    <input type="checkbox" class="doc-checkbox" value="${a.adherent_id}" ${!hasFile ? 'disabled style="opacity:0.3;"' : ''} />
                  </td>
                  <td><span class="mono" style="font-weight:bold; color:var(--gold);">${esc(a.matricule || '—')}</span></td>
                  <td class="cell-strong">${esc(a.prenom)} ${esc(a.nom)}</td>
                  <td class="muted">${hasFile ? dateAffichage : '—'}</td>
                  <td>
                    <div class="row-actions" style="justify-content: flex-end; gap:8px;">
                      ${readOnlyDocs ? '' : `<input type="file" id="fileInput-${a.adherent_id}" style="display:none;" accept=".pdf" multiple />
                      <button class="btn btn-dark btn-sm" onclick="document.getElementById('fileInput-${a.adherent_id}').click()">
                        📎 Fusionner
                      </button>`}
                      <button class="btn btn-gold btn-sm" data-file="${esc(a.filename || '')}" ${!hasFile ? 'disabled style="opacity:0.5;"' : ''}>
                        👁 Ouvrir
                      </button>
                    </div>
                  </td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;

    const selectAllCheckbox = $('#selectAllDocs');
    const checkboxes = t.querySelectorAll('.doc-checkbox:not([disabled])');
    const bulkBtn = $('#deleteBulkBtn');
    const countSpan = $('#selectedCount');

    function updateBulkButtonVisibility() {
      if (!bulkBtn || !countSpan) return;
      const checkedBoxes = t.querySelectorAll('.doc-checkbox:checked');
      countSpan.textContent = checkedBoxes.length;
      bulkBtn.style.display = checkedBoxes.length > 0 ? 'inline-block' : 'none';
    }

    if (selectAllCheckbox) {
      selectAllCheckbox.onchange = () => {
        checkboxes.forEach(cb => cb.checked = selectAllCheckbox.checked);
        updateBulkButtonVisibility();
      };
    }

    checkboxes.forEach(cb => {
      cb.onchange = () => {
        const allChecked = t.querySelectorAll('.doc-checkbox:not([disabled]):checked').length === checkboxes.length;
        if (selectAllCheckbox) selectAllCheckbox.checked = allChecked;
        updateBulkButtonVisibility();
      };
    });

    // --- EVENEMENT : SUPPRESSION GROUPÉE SIMPLIFIÉE & SÉCURISÉE ---
    if (bulkBtn) bulkBtn.onclick = () => {
      const checkedBoxes = t.querySelectorAll('.doc-checkbox:checked');
      const idsToDelete = Array.from(checkedBoxes).map(cb => cb.value);
      
      if (!idsToDelete.length) return;

      confirm(`Détacher et supprimer définitivement les fichiers fusionnés pour ces ${idsToDelete.length} adhérent(s) ?`, async () => {
        try {
          toast('Suppression en cours...', 'info');
          await API.deleteGroupedDocuments(idsToDelete);
          toast('Dossiers supprimés avec succès.');
          load();
        } catch (err) {
          toast(`Échec de la suppression : ${err.message}`, 'error');
        }
      });
    };

    // --- EVENEMENT : FUSION ---
    currentFilteredList.forEach(a => {
      const input = document.getElementById(`fileInput-${a.adherent_id}`);
      if (input) {
        input.onchange = async () => {
          if (!input.files.length) return;
          const formData = new FormData();
          for (let i = 0; i < input.files.length; i++) {
            formData.append('fichiers', input.files[i]);
          }
          toast(`Fusion en cours...`, 'info');
          try {
            await API.fusionnerDossier(a.adherent_id, formData);
            toast('Documents fusionnés avec succès !');
            load();
          } catch (err) {
            toast(err.message, 'error');
          }
        };
      }
    });

    // --- EVENEMENT : OUVRIR ---
    t.querySelectorAll('[data-file]').forEach((b) => b.onclick = async () => {
      const relPath = b.dataset.file;
      if (!relPath) return;
      try { 
        const cleanPath = relPath.replace(/^uploads\//, '');
        window.open(await API.fileUrl(cleanPath), '_blank'); 
      } catch { 
        toast('Fichier introuvable.', 'error'); 
      }
    });
  }

  let timer;
  $('#docSearch').oninput = () => { clearTimeout(timer); timer = setTimeout(load, 280); };
  $('#docWilaya').onchange = load;
  $('#refreshDocsBtn').onclick = () => { load(); toast('Liste actualisée.'); };

  load();
}
  /* ============ PARAMÈTRES ============ */
  function parametres() {
    const c = container();

    if (isSaisieOnly()) {
      c.innerHTML = UI.emptyState('🔒', "Ce compte ne peut ni changer son mot de passe ni faire des sauvegardes.");
      return;
    }

    c.innerHTML = `
      <div class="panel" style="max-width:520px">
        <div class="panel-head"><h3>Changer mon mot de passe</h3></div>
        <form id="pwForm">
          <div class="field"><label>Mot de passe actuel</label><input type="password" name="current" required /></div>
          <div class="field"><label>Nouveau mot de passe</label><input type="password" name="next" required minlength="6" /></div>
          <div class="form-error" id="pwErr"></div>
          <button type="submit" class="btn btn-gold">Mettre à jour</button>
        </form>
      </div>
      <div class="panel" style="max-width:680px">
        <div class="panel-head">
          <h3>Sauvegarde de la base de données</h3>
          <button class="btn btn-gold" id="backupBtn">💾 Sauvegarder maintenant</button>
        </div>
        <p class="muted" style="margin-bottom:14px">Une <b>sauvegarde mensuelle automatique</b> est téléchargée quand un administrateur ou le président se connecte sur ce PC pour la première fois du mois. Les sauvegardes serveur restent aussi disponibles ci-dessous.</p>
        <div id="backupMsg" class="muted" style="margin-bottom:12px"></div>
        <div id="backupList"><div class="muted">Chargement des sauvegardes…</div></div>
      </div>`;
    $('#pwForm').onsubmit = async (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        await API.changePassword(f.current.value, f.next.value);
        toast('Mot de passe modifié.');
        f.reset();
      }
      catch (err) { $('#pwErr').textContent = err.message; }
    };

    async function loadBackups() {
      try {
        const fullList = await API.listBackups();
        const list = fullList.slice(0, 1); // Ne garder strictement que la toute dernière sauvegarde pour l'affichage
        const el = $('#backupList');
        if (!list.length) { el.innerHTML = UI.emptyState('💾', 'Aucune sauvegarde pour le moment.'); return; }
        el.innerHTML = `<div class="table-wrap"><table class="data">
          <thead><tr><th>Fichier</th><th>Date</th><th>Taille</th><th></th></tr></thead>
          <tbody>${list.map((b) => `<tr>
            <td class="cell-strong">${esc(b.name)}</td>
            <td class="muted">${new Date(b.date).toLocaleString('fr-FR')}</td>
            <td class="muted">${(b.size / 1024).toFixed(1)} Ko</td>
            <td><button class="btn btn-dark btn-sm" data-dl="${esc(b.name)}">⬇ Télécharger</button></td>
          </tr>`).join('')}</tbody></table></div>`;
        el.querySelectorAll('[data-dl]').forEach((btn) => btn.onclick = async () => {
          try {
            await API.downloadBackup(btn.dataset.dl);
            toast('Téléchargement lancé.');
          }
          catch (err) { toast(err.message, 'error'); }
        });
      } catch (err) { $('#backupList').innerHTML = `<p class="form-error">${esc(err.message)}</p>`; }
    }

    $('#backupBtn').onclick = async () => {
      $('#backupMsg').textContent = 'Sauvegarde en cours…';
      try {
        const r = await API.backup();
        $('#backupMsg').textContent = '✅ Sauvegarde créée : ' + r.file;
        toast('Sauvegarde effectuée.');
        loadBackups();
      } catch (err) { $('#backupMsg').textContent = '⚠️ ' + err.message; toast('Échec de la sauvegarde.', 'error'); }
    };

    loadBackups();
  }

  /* ============ AGENT DE SAISIE ============ */
  function saisieAjout() {
    const c = container();
    c.innerHTML = `
      <div class="panel" style="max-width:560px;text-align:center">
        <div class="panel-head" style="justify-content:center"><h3>Ajouter un adhérent</h3></div>
        <p class="muted" style="margin-bottom:18px">Cliquez ci-dessous pour enregistrer un nouvel adhérent.
          Vous n'avez pas accès à la liste des adhérents ni aux demandes.</p>
        <button class="btn btn-gold" id="saisieBtn" style="font-size:15px;padding:13px 26px">➕ Nouvel adhérent</button>
        <div id="saisieRecap" style="margin-top:20px"></div>
      </div>`;
    $('#saisieBtn').onclick = () => adherentForm({ type_code: 'AD', niveau: 'Adhérent Simple' }, () => {
      $('#saisieRecap').innerHTML = `<div class="muted" style="color:var(--green,#2f9e5e)">✅ Adhérent enregistré avec succès.</div>`;
      setTimeout(() => { $('#saisieRecap').innerHTML = ''; }, 4000);
    });
  }

  /* ============ COMPTES UTILISATEURS ============ */
   async function comptesList() {
    const c = container();
    c.innerHTML = `
      <div class="toolbar">
        <h3 style="flex:1;color:var(--text)">Comptes utilisateurs</h3>
        <button class="btn btn-gold" id="addUserBtn">+ Nouveau compte</button>
      </div>
      <p class="muted" style="margin:-6px 0 16px">Créez un <b>compte personnalisé</b> et cochez un ou plusieurs accès selon le besoin.</p>
      <div id="usersTable"><div class="muted">Chargement…</div></div>`;
    async function load() {
      const users = await API.users();
      const t = $('#usersTable');
      const roleLabel = { admin: 'Administrateur', president: 'Président', saisie: 'Compte personnalisé' };
      const permLabel = {
        adherents_add: 'Ajouter des adhérents',
        adherents_manage: 'Ajouter et modifier les adhérents',
        demandes_view: 'Consulter les demandes',
        demandes_edit: 'Consulter et modifier les demandes',
        documents_view: 'Consulter les documents des adhérents',
      };
      t.innerHTML = `<div class="table-wrap"><table class="data">
        <thead><tr><th>Email</th><th>Téléphone</th><th>Rôle</th><th>Accès</th><th>Créé le</th><th></th></tr></thead>
        <tbody>${users.map((u) => {
          const isPresident = u.role === 'president';
          const actions = isPresident
            ? `<span class="tag tag-gold" title="Le compte Président est protégé : il ne peut être ni modifié, ni réinitialisé, ni supprimé par l'administrateur.">🔒 Compte protégé</span>`
            : `<div class="row-actions">
                <button class="btn btn-dark btn-sm" data-pwd="${u.id}" data-email="${esc(u.email)}">🔑 Mot de passe</button>
                <button class="btn btn-danger btn-sm" data-del="${u.id}">✕</button>
              </div>`;
          const access = u.role === 'admin' || u.role === 'president'
            ? 'Accès complet'
            : (u.permissions || []).map((p) => permLabel[p] || p).join(' • ');
          return `<tr>
            <td class="cell-strong">${esc(u.email)}</td>
            <td>${u.telephone ? `<span class="mono">${esc(u.telephone)}</span>` : '<span class="muted">—</span>'}</td>
            <td>${esc(roleLabel[u.role] || u.role)}</td>
            <td>${esc(access || '—')}</td>
            <td class="muted">${esc((u.created_at || '').slice(0,10))}</td>
            <td>${actions}</td>
          </tr>`;
        }).join('')}</tbody></table></div>`;
      t.querySelectorAll('[data-del]').forEach((b) => b.onclick = () => confirm('Supprimer ce compte ?', async () => {
        try { await API.deleteUser(b.dataset.del); toast('Compte supprimé.'); load(); }
        catch (e) { toast(e.message, 'error'); }
      }));
      t.querySelectorAll('[data-pwd]').forEach((b) => b.onclick = () => {
        openModal('Réinitialiser le mot de passe', `
          <p class="muted" style="margin-bottom:12px">${esc(b.dataset.email)}</p>
          <form id="pwdForm">
            <div class="field"><label>Nouveau mot de passe</label><input type="text" name="password" required minlength="6" /></div>
            <div class="form-error" id="pwdErr"></div>
            <div class="modal-foot"><button type="button" class="btn btn-ghost" id="pwdCancel">Annuler</button>
            <button type="submit" class="btn btn-gold">Enregistrer</button></div>
          </form>`);
        $('#pwdCancel').onclick = closeModal;
        $('#pwdForm').onsubmit = async (e) => {
          e.preventDefault();
          try { await API.resetUserPassword(b.dataset.pwd, e.target.password.value); toast('Mot de passe mis à jour.'); closeModal(); }
          catch (err) { $('#pwdErr').textContent = err.message; }
        };
      });
    }
    $('#addUserBtn').onclick = () => {
      openModal('Nouveau compte', `
  <style>
    .access-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.access-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 0;
  cursor: pointer;
  border-bottom: 1px solid var(--border);
}

.access-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.access-text strong {
  font-size: 13.5px;
  color: var(--text);
  font-weight: 600;
}

.access-text small {
  font-size: 12px;
  color: var(--text-mute);
}

.access-item input[type="checkbox"] {
  order: 2;
  flex: 0 0 auto;
  margin-left: auto !important;
  margin-right: 0 !important;
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: var(--blue);
}
   </style>

  <form id="userForm">
    <input type="hidden" name="role" value="saisie" />
    <div class="form-grid">
      <div class="field"><label>Email *</label><input type="email" name="email" required placeholder="agent@opa.dz" /></div>
      <div class="field"><label>Mot de passe *</label><input type="text" name="password" required minlength="6" placeholder="6 caractères min." /></div>
    </div>
    
    <div class="field full">
      <label>Accès utilisateur *</label>
      <div class="access-list">
        <label class="access-item">
          <span class="access-text">
            <strong>Ajouter des adhérents</strong>
            <small>Création d'adhérents normaux uniquement.</small>
          </span>
          <input type="checkbox" name="permissions" value="adherents_add" checked />
        </label>
        <label class="access-item">
          <span class="access-text">
            <strong>Ajouter et modifier les adhérents</strong>
            <small>Accès à la liste et modification.</small>
          </span>
          <input type="checkbox" name="permissions" value="adherents_manage" />
        </label>
        <label class="access-item">
          <span class="access-text">
            <strong>Consulter les demandes</strong>
            <small>Lecture seule des demandes.</small>
          </span>
          <input type="checkbox" name="permissions" value="demandes_view" />
        </label>
        <label class="access-item">
          <span class="access-text">
            <strong>Consulter et modifier les demandes</strong>
            <small>Traitement et clôture des demandes.</small>
          </span>
          <input type="checkbox" name="permissions" value="demandes_edit" />
        </label>
        <label class="access-item">
          <span class="access-text">
            <strong>Consulter les documents</strong>
            <small>Consultation des documents liés.</small>
          </span>
          <input type="checkbox" name="permissions" value="documents_view" />
        </label>
      </div>
    </div>
    
    <div class="user-access-help">
      Cochez les accès nécessaires. Ce compte ne peut pas changer son mot de passe ni accéder au Bureau exécutif.
    </div>
    <div class="form-error" id="userErr"></div>
    <div class="modal-foot">
      <button type="button" class="btn btn-ghost" id="userCancel">Annuler</button>
      <button type="submit" class="btn btn-gold">Créer le compte</button>
    </div>
  </form>
`);
      $('#userCancel').onclick = closeModal;
      $('#userForm').onsubmit = async (e) => {
        e.preventDefault();
        const f = e.target;
        const permissions = Array.from(f.querySelectorAll('input[name="permissions"]:checked')).map((el) => el.value);
        if (!permissions.length) {
          $('#userErr').textContent = 'Choisissez au moins un accès.';
          return;
        }
        const telValue = f.telephone ? f.telephone.value.trim() : '';
        try {
          await API.createUser({ email: f.email.value, password: f.password.value, role: 'saisie', permissions, telephone: telValue });
          toast('Compte créé.'); closeModal(); load();
        } catch (err) { $('#userErr').textContent = err.message; }
      };
    };
    load();
  }


  /* ============ BLACKLIST ============ */

  async function blacklistList() {
    const c = container();
    if (!(ROLE === 'admin' || ROLE === 'president')) {
      c.innerHTML = UI.emptyState('🔒', 'Accès réservé à l’administrateur et au président.');
      return;
    }
    c.innerHTML = `
      <div class="panel" style="margin-bottom:18px;border:1px solid #fecaca;background:#fff5f5">
        <div style="padding:14px 16px;display:flex;align-items:center;gap:12px">
          <span style="font-size:22px">🚫</span>
          <div>
            <div style="font-weight:800;color:#b91c1c">Liste noire – Blacklist OPA</div>
            <div class="muted" style="font-size:13px">Les adhérents blacklistés sont signalés sur le tableau de bord.</div>
          </div>
        </div>
      </div>
      <div class="toolbar" style="flex-wrap:wrap;gap:10px">
        <input type="search" id="blSearch" placeholder="Rechercher (nom, prénom, matricule)…" />
        <button class="btn btn-dark" id="blRefresh">⟳ Rafraîchir</button>
        <button class="btn btn-gold" id="blAdd">+ Ajouter à la blacklist</button>
      </div>
      <div id="blTable"><div class="muted">Chargement…</div></div>
    `;

    async function load() {
      const params = {};
      const q = $('#blSearch').value.trim(); if(q) params.q = q;
      const list = await API.blacklist(params);
      renderBlTable(list);
    }

    function renderBlTable(list) {
      const t = $('#blTable');
      if(!list.length){ t.innerHTML = UI.emptyState('🚫', 'Aucune entrée dans la blacklist.'); return; }
      t.innerHTML = `<div class="table-wrap"><table class="data">
        <thead><tr>
          <th>Nom & Prénom</th><th>Matricule</th><th>Date blacklist</th><th>Motif</th><th></th>
        </tr></thead><tbody>
        ${list.map(b=>`
          <tr>
            <td class="cell-strong">${esc(b.prenom)} ${esc(b.nom)}</td>
            <td><span class="mono" style="color:#b91c1c;font-weight:700">${esc(b.matricule||'—')}</span></td>
            <td class="muted">${esc(fmtDate(b.date_blacklist))}</td>
            <td style="max-width:360px"><div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${esc(b.motif||'')}">${esc(b.motif||'—')}</div></td>
            <td><div class="row-actions">
              <button class="btn btn-dark btn-sm" data-view="${b.id}">Voir</button>
              <button class="btn btn-gold btn-sm" data-edit="${b.id}">✎</button>
              <button class="btn btn-danger btn-sm" data-del="${b.id}">Retirer</button>
            </div></td>
          </tr>
        `).join('')}
        </tbody></table></div>`;
      t.querySelectorAll('[data-view]').forEach(btn=>btn.onclick=()=>blacklistDetail(btn.dataset.view, load));
      t.querySelectorAll('[data-edit]').forEach(btn=>btn.onclick=()=>blacklistForm(btn.dataset.edit, load));
      t.querySelectorAll('[data-del]').forEach(btn=>btn.onclick=()=>{
        confirm('Retirer cette personne de la blacklist ?', async ()=>{
          await API.deleteBlacklist(btn.dataset.del);
          toast('Retiré de la blacklist.');
          load();
        });
      });
    }

    let timer;
    $('#blSearch').oninput = ()=>{ clearTimeout(timer); timer=setTimeout(load, 280); };
    $('#blRefresh').onclick = ()=>{ load(); toast('Liste actualisée.'); };
    $('#blAdd').onclick = ()=>blacklistForm(null, load);

    load();
  }

  async function blacklistForm(id, onDone) {
    let bl = null;
    if(id){ bl = await API.blacklistEntry(id); }
    const isEdit = !!bl;
    openModal(isEdit ? 'Modifier entrée blacklist' : 'Ajouter à la blacklist', `
      <form id="blForm">
        <div class="form-grid">
          <div class="field"><label>Nom *</label><input name="nom" value="${esc(bl?.nom||'')}" required /></div>
          <div class="field"><label>Prénom *</label><input name="prenom" value="${esc(bl?.prenom||'')}" required /></div>
          <div class="field"><label>Matricule</label><input name="matricule" value="${esc(bl?.matricule||'')}"  /></div>
          <div class="field"><label>Date blacklist</label><input type="date" name="date_blacklist" value="${esc(bl?.date_blacklist ? fmtDate(bl.date_blacklist) : new Date().toISOString().slice(0,10))}" /></div>
          <div class="field full"><label>Motif</label><textarea name="motif" rows="3" placeholder="motif du blacklist">${esc(bl?.motif||'')}</textarea></div>
        </div>
        <div class="form-error" id="blFormErr"></div>
        <div class="modal-foot">
          <button type="button" class="btn btn-ghost" id="blFormCancel">Annuler</button>
          <button type="submit" class="btn btn-gold">${isEdit?'Enregistrer':'Ajouter'}</button>
        </div>
      </form>
    `, true);
    $('#blFormCancel').onclick = closeModal;
    $('#blForm').onsubmit = async (e)=>{
      e.preventDefault();
      const fd = new FormData(e.target);
      const data = Object.fromEntries(fd.entries());
      try{
        if(isEdit){
          await API.updateBlacklist(id, data);
          toast('Entrée mise à jour.');
        } else {
          await API.createBlacklist(data);
          toast('Ajouté à la blacklist.');
        }
        closeModal();
        onDone && onDone();
      }catch(err){
        $('#blFormErr').textContent = err.message;
      }
    };
  }

  async function blacklistDetail(id, onBack) {
    const b = await API.blacklistEntry(id);
    openModal('🚫 Détail blacklist', `
      <div style="display:flex;gap:16px;align-items:flex-start;margin-bottom:16px">
        <div style="font-size:36px">🚫</div>
        <div>
          <div style="font-size:18px;font-weight:800">${esc(b.prenom)} ${esc(b.nom)}</div>
          <div class="mono" style="color:#b91c1c;font-weight:700">${esc(b.matricule||'Sans matricule')}</div>
        </div>
      </div>
      <div class="detail-grid">
        ${detailItem('Nom', b.nom||'—')}
        ${detailItem('Prénom', b.prenom||'—')}
        ${detailItem('Matricule', b.matricule||'—')}
        ${detailItem('Date blacklist', fmtDate(b.date_blacklist))}
        ${detailItem('Ajouté par', b.created_by_email||'—')}
        ${detailItem('Créé le', (b.created_at||'').slice(0,16).replace('T',' '))}
      </div>
      ${b.motif ? `<div class="panel" style="margin-top:14px"><div class="panel-head"><h3>Motif</h3></div><div style="padding:14px;line-height:1.6">${esc(b.motif)}</div></div>` : ''}
      <div class="modal-foot">
        <button class="btn btn-dark" id="blEdit">✎ Modifier</button>
        <button class="btn btn-danger" id="blRemove">Retirer de la blacklist</button>
        <button class="btn btn-gold" id="blClose">Fermer</button>
      </div>
    `, true);
    $('#blClose').onclick = closeModal;
    $('#blEdit').onclick = ()=>{ closeModal(); setTimeout(()=>blacklistForm(id, ()=>{ onBack && onBack(); }), 60); };
    $('#blRemove').onclick = ()=>{
      confirm('Retirer définitivement de la blacklist ?', async ()=>{
        await API.deleteBlacklist(id);
        toast('Retiré de la blacklist.');
        closeModal();
        onBack && onBack();
      });
    };
  }

  // --- Patch dashboard pour afficher blacklist ---
  const _origDashboard = dashboard;
  dashboard = async function() {
    await _origDashboard();
    try {
      const s = await API.stats();
      const bl = s.blacklist || { total:0, recent:[] };
      // injecter KPI blacklist
      const kpiRow = document.querySelector('.kpi-row');
      if (kpiRow && !document.getElementById('kpi-blacklist')) {
        const k = document.createElement('div');
        k.innerHTML = `
          <div class="kpi" id="kpi-blacklist" style="cursor:pointer" onclick="Views.blacklistList()">
            <div class="kpi-accent" style="background:#dc2626"></div>
            <div class="kpi-ico" style="background:#fee2e2;color:#dc2626">🚫</div>
            <div class="kpi-val" style="color:#dc2626">${bl.total}</div>
            <div class="kpi-lbl">Blacklist</div>
            <div class="kpi-sub">personnes signalées</div>
          </div>`;
        kpiRow.appendChild(k.firstElementChild);
      }
      // panneau blacklist récent
      const containerEl = container();
      if (bl.recent && bl.recent.length) {
        const panel = document.createElement('div');
        panel.className = 'dash-panel';
        panel.style.marginBottom = '28px';
        panel.innerHTML = `
          <div class="dash-panel-head">
            <h3>🚫 Blacklist récente</h3>
            <button class="btn btn-dark btn-sm" onclick="Views.blacklistList()">Voir tout →</button>
          </div>
          <div class="dash-panel-body" style="padding:0">
            <table class="mini-table">
              <thead><tr><th>Nom</th><th>Matricule</th><th>Date</th></tr></thead>
              <tbody>
                ${bl.recent.map(x=>`
                  <tr>
                    <td style="font-weight:600">${esc(x.prenom||'')} ${esc(x.nom||'')}</td>
                    <td><span class="mono" style="color:#b91c1c">${esc(x.matricule||'—')}</span></td>
                    <td class="muted">${esc(fmtDate(x.date_blacklist))}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>`;
        const firstGrid = containerEl.querySelector('.dash-grid');
        if (firstGrid) firstGrid.parentNode.insertBefore(panel, firstGrid);
      }

      
      // quick action blacklist
      const qa = document.getElementById('qaComptes')?.parentElement;
      if (qa && !document.getElementById('qaBlacklist')) {
        const btn = document.createElement('button');
        btn.className = 'qa-btn';
        btn.id = 'qaBlacklist';
        btn.innerHTML = `<div class="qa-ico" style="background:rgba(220,38,38,.08);color:#dc2626">🚫</div>
          <div><div>Blacklist</div><div style="font-size:11px;color:var(--muted,#94a3b8);font-weight:400">${bl.total} signalé${bl.total>1?'s':''}</div></div>`;
        btn.onclick = ()=>blacklistList();
        qa.appendChild(btn);
      }
    } catch(e){ console.warn('blacklist dashboard', e.message); }
  };

  async function auditList() {
    const c = container();
    c.innerHTML = `
      <div class="panel">
        <div class="panel-head">
          <h3>📋 Journal d'audit des actions utilisateurs</h3>
        </div>
        <div class="toolbar">
          <input type="search" id="auditSearch" placeholder="Rechercher par utilisateur, action, description..." style="max-width:350px;" />
          <select id="auditActionFilter">
            <option value="">Toutes les actions</option>
            <option value="LOGIN">Connexion</option>
            <option value="CHANGE_PASSWORD">Changement MDP</option>
            <option value="CREATE_USER">Création Utilisateur</option>
            <option value="EDIT_USER_ROLE">Modification Rôle</option>
            <option value="EDIT_USER_PASSWORD">Réinitialisation MDP</option>
            <option value="DELETE_USER">Suppression Utilisateur</option>
            <option value="CREATE_ADHERENT">Création Adhérent</option>
            <option value="EDIT_ADHERENT">Modification Adhérent</option>
            <option value="DELETE_ADHERENT">Suppression Adhérent</option>
            <option value="PRINT_CARTE">Impression Carte</option>
            <option value="PRINT_DOSSIER">Impression Dossier</option>
            <option value="CREATE_BLACKLIST">Ajout Blacklist</option>
            <option value="EDIT_BLACKLIST">Modification Blacklist</option>
            <option value="DELETE_BLACKLIST">Retrait Blacklist</option>
            <option value="EDIT_DEMANDE">Modification Demande</option>
            <option value="CLOSE_DEMANDE">Clôture Demande</option>
            <option value="DELETE_DEMANDE">Suppression Demande</option>
            <option value="MERGE_PDF">Fusion PDF</option>
            <option value="DELETE_PDF_GROUP">Suppression PDF</option>
            <option value="BACKUP_CREATE">Sauvegarde BDD</option>
            <option value="BACKUP_DOWNLOAD">Téléchargement Sauvegarde</option>
          </select>
          <div class="spacer"></div>
          <button class="btn btn-dark" id="btnRefreshAudit">↻ Actualiser</button>
        </div>
        <div class="table-wrap">
          <table class="data" id="auditTable">
            <thead>
              <tr>
                <th>Date / Heure</th>
                <th>Utilisateur</th>
                <th>Action</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody id="auditListBody">
              <tr><td colspan="6" class="muted" style="text-align:center">Chargement...</td></tr>
            </tbody>
          </table>
        </div>
        <div style="margin-top:16px;display:flex;justify-content:space-between;align-items:center;" id="auditPagination">
          <span class="muted" id="auditPaginationInfo">Affichage de 0 à 0 sur 0 entrées</span>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-dark btn-sm" id="btnPrevAudit" disabled>Précédent</button>
            <button class="btn btn-dark btn-sm" id="btnNextAudit" disabled>Suivant</button>
          </div>
        </div>
      </div>
    `;

    let page = 0;
    const limit = 20;

    async function loadLogs() {
      const q = $('#auditSearch').value;
      const action = $('#auditActionFilter').value;
      const offset = page * limit;

      try {
        const res = await API.audit({ q, action, limit, offset });
        const logs = res.logs;
        const total = res.total;

        const body = $('#auditListBody');
        if (!logs.length) {
          body.innerHTML = '<tr><td colspan="6" class="muted" style="text-align:center;padding:24px;">Aucun log trouvé.</td></tr>';
          $('#auditPaginationInfo').textContent = 'Affichage de 0 à 0 sur 0 entrées';
          $('#btnPrevAudit').disabled = true;
          $('#btnNextAudit').disabled = true;
          return;
        }

        const actionLabels = {
          LOGIN: '<span class="tag tag-actif">Connexion</span>',
          CHANGE_PASSWORD: '<span class="tag tag-attente">Changement MDP</span>',
          CREATE_USER: '<span class="tag tag-gold">Création Utilisateur</span>',
          EDIT_USER_ROLE: '<span class="tag tag-attente">Modification Rôle</span>',
          EDIT_USER_PASSWORD: '<span class="tag tag-attente">Réinitialisation MDP</span>',
          DELETE_USER: '<span class="tag tag-inactif">Suppression Utilisateur</span>',
          CREATE_ADHERENT: '<span class="tag tag-actif">Création Adhérent</span>',
          EDIT_ADHERENT: '<span class="tag tag-attente">Modification Adhérent</span>',
          DELETE_ADHERENT: '<span class="tag tag-inactif">Suppression Adhérent</span>',
          PRINT_CARTE: '<span class="tag tag-type">Impression Carte</span>',
          PRINT_DOSSIER: '<span class="tag tag-type">Impression Dossier</span>',
          CREATE_BLACKLIST: '<span class="tag tag-inactif">Ajout Blacklist</span>',
          EDIT_BLACKLIST: '<span class="tag tag-suspendu">Modification Blacklist</span>',
          DELETE_BLACKLIST: '<span class="tag tag-actif">Retrait Blacklist</span>',
          EDIT_DEMANDE: '<span class="tag tag-attente">Modification Demande</span>',
          CLOSE_DEMANDE: '<span class="tag tag-actif">Clôture Demande</span>',
          DELETE_DEMANDE: '<span class="tag tag-inactif">Suppression Demande</span>',
          MERGE_PDF: '<span class="tag tag-type">Fusion PDF</span>',
          DELETE_PDF_GROUP: '<span class="tag tag-inactif">Suppression PDF</span>',
          BACKUP_CREATE: '<span class="tag tag-gold">Sauvegarde BDD</span>',
          BACKUP_DOWNLOAD: '<span class="tag tag-type">Téléchargement</span>'
        };

        body.innerHTML = logs.map(l => {
          const actionBadge = actionLabels[l.action_type] || `<span class="tag">${esc(l.action_type)}</span>`;
          return `
            <tr>
              <td class="cell-strong">${esc(l.created_at.replace('T', ' ').slice(0, 19))}</td>
              <td><span style="font-weight:600;color:var(--gold-soft);">${esc(l.user_email)}</span></td>
              <td>${actionBadge}</td>
              <td style="max-width:350px;white-space:normal;word-break:break-word;">${esc(l.description)}</td>
            </tr>
          `;
        }).join('');

        const startIdx = offset + 1;
        const endIdx = Math.min(offset + logs.length, total);
        $('#auditPaginationInfo').textContent = `Affichage de ${startIdx} à ${endIdx} sur ${total} entrées`;
        $('#btnPrevAudit').disabled = page === 0;
        $('#btnNextAudit').disabled = endIdx >= total;
      } catch (err) {
        toast(err.message, 'error');
      }
    }

    $('#auditSearch').oninput = UI.debounce(() => { page = 0; loadLogs(); }, 300);
    $('#auditActionFilter').onchange = () => { page = 0; loadLogs(); };
    $('#btnRefreshAudit').onclick = () => { loadLogs(); };
    $('#btnPrevAudit').onclick = () => { if (page > 0) { page--; loadLogs(); } };
    $('#btnNextAudit').onclick = () => { page++; loadLogs(); };

    await loadLogs();
  }

  async function showAuditDetail(id) {
    try {
      const res = await API.audit({ q: String(id) });
      const log = res.logs.find(l => l.id === id);
      if (!log) {
        toast('Détail introuvable', 'error');
        return;
      }

      openModal('Détails du Log d’Audit', `
        <div style="padding:10px 0;">
          <div class="detail-grid">
            ${detailItem('ID du Log', log.id)}
            ${detailItem('Date / Heure', log.created_at.replace('T', ' ').slice(0, 19))}
            ${detailItem('Utilisateur', log.user_email)}
            ${detailItem('Type d’Action', log.action_type)}
            ${detailItem('Cible ID', log.target_id || '—')}
            ${detailItem('Cible Type', log.target_type || '—')}
            ${detailItem('Adresse IP', log.ip_address || '—')}
          </div>
          <div class="panel" style="margin-top:20px;">
            <div class="panel-head"><h3>Description</h3></div>
            <div style="padding:14px;line-height:1.6;font-size:14px;background:var(--bg);border-radius:8px;word-break:break-word;">
              ${esc(log.description)}
            </div>
          </div>
          <div class="modal-foot">
            <button class="btn btn-gold" onclick="UI.closeModal()">Fermer</button>
          </div>
        </div>
      `);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  /* ============ FINANCES ============ */

  function fmtDA(v) {
    const n = Number(v) || 0;
    return n.toLocaleString('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' DA';
  }

  function compteTag(code) {
    const map = { BDL: '#1d4ed8', CPA: '#7c3aed', CAISSE: '#b45309' };
    const color = map[code] || 'var(--gold-2)';
    return `<span class="tag" style="background:${color}18;color:${color};border:1px solid ${color}44">${esc(code)}</span>`;
  }

  function natureTag(sens, nature) {
    if (sens === 'sortie') {
      const labels = {
        paiement_employe: 'Paiement employé', loyer: 'Loyer', charges: 'Charges',
        fournitures: 'Fournitures', deplacement: 'Déplacement',
        commission_tva: 'Commissions et TVA', commission: 'Commission', tva: 'TVA',
        ebanking: 'ebanking', frais_application: "Frais d'application", autre: 'Autre',
      };
      return `<span class="tag tag-inactif">${esc(labels[nature] || nature)}</span>`;
    }
    const labels = { cheque: 'Chèque', espece: 'Espèce', virement: 'Virement', autre: 'Autre entrée' };
    const cls = nature === 'cheque' ? 'tag-type' : nature === 'virement' ? 'tag-actif' : 'tag-attente';
    return `<span class="tag ${cls}">${esc(labels[nature] || nature)}</span>`;
  }

  async function finances() {
    const c = container();
    if (!(ROLE === 'admin' || ROLE === 'president')) {
      c.innerHTML = UI.emptyState('🔒', 'Accès réservé à l’administrateur et au président.');
      return;
    }
    c.innerHTML = '<div class="muted">Chargement des finances…</div>';

    let tab = 'dashboard';
    let meta = { comptes: [], naturesEntree: [], motifsSortie: [] };

    try {
      meta = await API.financesMeta();
    } catch (err) {
      c.innerHTML = `<div class="empty"><div class="empty-ico">⚠️</div><p>${esc(err.message)}</p></div>`;
      return;
    }

    function compteOptions(sel) {
      return (meta.comptes || []).map((x) =>
        `<option value="${esc(x.code)}" ${x.code === sel ? 'selected' : ''}>${esc(x.label)}</option>`
      ).join('');
    }

    c.innerHTML = `
      <style>
        .fin-tabs { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:20px; }
        .fin-tab {
          border:1px solid var(--border-strong); background:var(--panel); color:var(--text-dim);
          padding:9px 16px; border-radius:20px; font-size:13px; font-weight:600; cursor:pointer; font-family:inherit;
        }
        .fin-tab.active { background:var(--gold-grad); color:#fff; border-color:transparent; }
        .fin-kpi { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:14px; margin-bottom:22px; }
        .fin-account-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:16px; margin-bottom:22px; }
        .fin-account {
          background:var(--panel); border:1px solid var(--border); border-radius:14px; padding:18px 18px 16px;
          box-shadow:var(--shadow); position:relative; overflow:hidden;
        }
        .fin-account::before { content:''; position:absolute; top:0; left:0; right:0; height:4px; background:var(--gold-grad); }
        .fin-account h4 { font-size:14px; margin-bottom:4px; }
        .fin-solde { font-size:24px; font-weight:800; color:var(--text); margin:8px 0 4px; }
        .fin-obs { font-size:12.5px; color:var(--text-mute); min-height:18px; white-space:pre-wrap; }
        .amt-in { color:#257a48; font-weight:700; }
        .amt-out { color:#a83232; font-weight:700; }
      </style>
      <div class="fin-tabs">
        <button class="fin-tab active" data-tab="dashboard">📊 Tableau de bord</button>
        <button class="fin-tab" data-tab="encaisser">📥 Encaissements</button>
        <button class="fin-tab" data-tab="sorties">📤 Sorties</button>
        <button class="fin-tab" data-tab="mouvements">📒 Mouvements</button>
        <button class="fin-tab" data-tab="comptes">🏦 Comptes</button>
      </div>
      <div id="finBody"><div class="muted">Chargement…</div></div>
    `;

    c.querySelectorAll('.fin-tab').forEach((btn) => {
      btn.onclick = () => {
        tab = btn.dataset.tab;
        c.querySelectorAll('.fin-tab').forEach((b) => b.classList.toggle('active', b === btn));
        renderTab();
      };
    });

    async function renderTab() {
      const body = $('#finBody');
      body.innerHTML = '<div class="muted">Chargement…</div>';
      try {
        if (tab === 'dashboard') await renderDashboard(body);
        else if (tab === 'encaisser') await renderEncaissements(body);
        else if (tab === 'sorties') await renderSorties(body);
        else if (tab === 'mouvements') await renderMouvements(body);
        else await renderComptes(body);
      } catch (err) {
        body.innerHTML = `<div class="empty"><div class="empty-ico">⚠️</div><p>${esc(err.message)}</p></div>`;
      }
    }

    async function renderDashboard(body) {
      const d = await API.financesDashboard();
      const t = d.totaux || {};
      body.innerHTML = `
        <div class="fin-kpi">
          ${kpiCard('bdl', '🏦', fmtDA(t.bdl), 'Solde BDL', `Virements : ${fmtDA(t.virementsBdl)}`, '#1d4ed8')}
          ${kpiCard('cpa', '🏦', fmtDA(t.cpa), 'Solde CPA', `Virements : ${fmtDA(t.virementsCpa)}`, '#7c3aed')}
          ${kpiCard('caisse', '💵', fmtDA(t.caisse), 'Solde Caisse', 'Espèces', '#b45309')}
          ${kpiCard('banques', '🏛️', fmtDA(t.banques), 'Total banques (BDL + CPA)', `Virements : ${fmtDA(t.virementsBanques)}`, '#c49b2e')}
          ${kpiCard('all', '💎', fmtDA(t.general), 'Total général', 'Les trois comptes ensemble', '#1a1a1a')}
        </div>
        <div class="fin-account-grid">
          ${(d.comptes || []).map((acc) => `
            <div class="fin-account">
              <h4>${esc(acc.label)}</h4>
              <div class="fin-solde">${fmtDA(acc.solde)}</div>
              <div class="muted" style="font-size:12px;margin-bottom:10px">
                Initial ${fmtDA(acc.montant_initial)} · Entrées <span class="amt-in">+${fmtDA(acc.entrees)}</span> · Sorties <span class="amt-out">−${fmtDA(acc.sorties)}</span>
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
                ${natureTag('entree', 'cheque')} <span class="muted">${fmtDA(acc.cheques)}</span>
                ${natureTag('entree', 'virement')} <span class="muted">${fmtDA(acc.virements)}</span>
                ${natureTag('entree', 'espece')} <span class="muted">${fmtDA(acc.especes)}</span>
              </div>
              <div class="fin-obs">${acc.observation ? esc(acc.observation) : 'Aucune observation.'}</div>
            </div>
          `).join('')}
        </div>
        <div class="panel">
          <div class="panel-head"><h3>Derniers mouvements</h3></div>
          ${renderMouvTable(d.recent || [], { compact: true })}
        </div>
      `;
      bindMouvActions(body, renderTab);
    }

    async function renderComptes(body) {
      const comptes = await API.financesComptes();
      body.innerHTML = `
        <p class="muted" style="margin-bottom:16px">Renseignez le <b>montant initial</b> et une <b>observation</b> pour BDL, CPA et la Caisse. Le solde = initial + entrées − sorties.</p>
        <div class="fin-account-grid">
          ${comptes.map((acc) => `
            <form class="fin-account" data-compte="${esc(acc.code)}">
              <h4>${esc(acc.label)}</h4>
              <div class="fin-solde">${fmtDA(acc.solde)}</div>
              <div class="field" style="margin-top:12px">
                <label>Montant initial (DA)</label>
                <input type="number" name="montant_initial" min="0" step="0.01" value="${esc(acc.montant_initial)}" />
              </div>
              <div class="field">
                <label>Observation</label>
                <textarea name="observation" rows="3" placeholder="Notes, n° de compte, agence…">${esc(acc.observation || '')}</textarea>
              </div>
              <button type="submit" class="btn btn-gold btn-sm btn-block">Enregistrer ${esc(acc.code)}</button>
            </form>
          `).join('')}
        </div>
      `;
      body.querySelectorAll('form[data-compte]').forEach((form) => {
        form.onsubmit = async (e) => {
          e.preventDefault();
          try {
            await API.updateFinanceCompte(form.dataset.compte, {
              montant_initial: form.montant_initial.value,
              observation: form.observation.value,
            });
            toast('Compte ' + form.dataset.compte + ' mis à jour.');
            renderTab();
          } catch (err) { toast(err.message, 'error'); }
        };
      });
    }

    async function renderEncaissements(body) {
      body.innerHTML = `
        <div class="panel" style="margin-bottom:18px">
          <div class="panel-head">
            <h3>Encaisser un paiement</h3>
            <button type="button" class="btn btn-gold btn-sm" id="encAddAdhBtn">+ Ajouter un adhérent</button>
          </div>
          <p class="muted" style="margin-bottom:12px">Choisissez le compte (<b>BDL</b>, <b>CPA</b> ou <b>Caisse</b>) dans la liste. Ce choix n’est pas modifié quand vous sélectionnez un adhérent.</p>
          <form id="encForm">
            <div class="form-grid">
              <div class="field">
                <label>Compte d’encaissement *</label>
                <select name="compte_code" id="encCompte" required>
                  <option value="BDL">BDL</option>
                  <option value="CPA">CPA</option>
                  <option value="CAISSE">Caisse</option>
                </select>
              </div>
              <div class="field">
                <label>Mode *</label>
                <select name="nature" id="encNature">
                  ${(meta.naturesEntree || []).map((n) => `<option value="${esc(n.code)}">${esc(n.label)}</option>`).join('')}
                </select>
              </div>
              <div class="field" id="encAdherentWrap">
                <label>Adhérent (ayant payé)</label>
                <select name="adherent_id" id="encAdherent"><option value="">— Sans adhérent —</option></select>
              </div>
              <div class="field">
                <label>Montant (DA) *</label>
                <input type="number" name="montant" min="0.01" step="0.01" required placeholder="0.00" />
              </div>
              <div class="field" id="encChequeWrap">
                <label>N° de chèque</label>
                <input name="cheque_numero" id="encCheque" maxlength="7" placeholder="7 chiffres" />
              </div>
              <div class="field">
                <label>Date</label>
                <input type="date" name="date_mouvement" value="${esc(new Date().toISOString().slice(0, 10))}" />
              </div>
              <div class="field full">
                <label>Observation</label>
                <input name="observation" placeholder="Agence, bordereau, remarque…" />
              </div>
            </div>
            <div id="encNewAdhFields" style="display:none;margin-top:16px;padding-top:14px;border-top:1px solid var(--border, #e2e8f0)">
              <p class="muted" style="margin-bottom:12px">Personne absente de l’application : renseignez nom, prénom et matricule. L’encaissement ci-dessus lui sera rattaché.</p>
              <div class="form-grid">
                <div class="field"><label>Nom *</label><input name="new_nom" id="encNewNom" /></div>
                <div class="field"><label>Prénom *</label><input name="new_prenom" id="encNewPrenom" /></div>
                <div class="field"><label>Matricule *</label><input name="new_matricule" id="encNewMatricule" maxlength="40" placeholder="Matricule" /></div>
              </div>
            </div>
            <div class="form-error" id="encErr"></div>
            <div class="modal-foot" style="margin-top:8px">
              <button type="button" class="btn btn-ghost" id="encAddAdhCancel" style="display:none">Annuler l’ajout</button>
              <button type="submit" class="btn btn-gold">Enregistrer l’encaissement</button>
            </div>
          </form>
        </div>
        <div class="toolbar" style="flex-wrap:wrap;gap:10px">
          <input type="search" id="encSearch" placeholder="Rechercher (nom, prénom, matricule)…" />
          <select id="encMode">
            <option value="">Tous les modes</option>
            <option value="cheque">Chèques</option>
            <option value="espece">Espèces</option>
            <option value="virement">Virements</option>
          </select>
          <button class="btn btn-dark" id="encRefresh">⟳ Rafraîchir</button>
        </div>
        <div id="encTable"><div class="muted">Chargement…</div></div>
      `;

      async function loadPayes() {
        const params = {};
        const q = $('#encSearch').value.trim(); if (q) params.q = q;
        const mode = $('#encMode').value; if (mode) params.mode = mode;
        const list = await API.financesAdherentsPayes(params);
        const sel = $('#encAdherent');
        const current = sel.value;
        sel.innerHTML = `<option value="">— Sans adhérent —</option>` + list.map((a) =>
          `<option value="${a.id}" data-mode="${esc(a.paiement_mode || '')}" data-ref="${esc(a.paiement_ref || '')}">${esc(a.nom)} ${esc(a.prenom)} — ${esc(a.matricule || 'sans matricule')}</option>`
        ).join('');
        if (current) sel.value = current;

        const t = $('#encTable');
        if (!list.length) { t.innerHTML = UI.emptyState('👥', 'Aucun adhérent avec un paiement renseigné.'); return; }
        t.innerHTML = `<div class="table-wrap"><table class="data">
          <thead><tr>
            <th>Adhérent</th><th>Matricule</th><th>Mode</th><th>N° chèque / réf.</th><th>Banque adhérent</th><th>Encaissé</th><th></th>
          </tr></thead><tbody>
          ${list.map((a) => `
            <tr>
              <td class="cell-strong">${esc(a.nom)} ${esc(a.prenom)}</td>
              <td><span class="mono">${esc(a.matricule || '—')}</span></td>
              <td>${natureTag('entree', a.paiement_mode)}</td>
              <td class="mono">${esc(a.paiement_ref || '—')}</td>
              <td>${esc(a.paiement_banque || '—')}</td>
              <td>${a.n_encaissements
                ? `<span class="tag tag-actif">✓ ${a.n_encaissements} · ${fmtDA(a.total_encaisse)}</span>`
                : '<span class="tag tag-inactif">Non encaissé</span>'}</td>
              <td><button class="btn btn-gold btn-sm" data-pick="${a.id}">Encaisser</button></td>
            </tr>
          `).join('')}
          </tbody></table></div>`;
        t.querySelectorAll('[data-pick]').forEach((btn) => {
          btn.onclick = () => {
            $('#encAdherent').value = btn.dataset.pick;
            fillFromAdherent();
            $('#encForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
          };
        });
      }

      function fillFromAdherent() {
        const opt = $('#encAdherent').selectedOptions[0];
        if (!opt || !opt.value) return;
        const mode = opt.dataset.mode || '';
        if (['cheque', 'espece', 'virement'].includes(mode)) $('#encNature').value = mode;
        if (mode === 'cheque') $('#encCheque').value = opt.dataset.ref || '';
        else $('#encCheque').value = '';
        toggleCheque();
      }

      function toggleCheque() {
        $('#encChequeWrap').style.display = $('#encNature').value === 'cheque' ? '' : 'none';
      }

      $('#encNature').onchange = toggleCheque;
      $('#encAdherent').onchange = fillFromAdherent;
      toggleCheque();

      function setAddAdherentMode(on) {
        const fields = $('#encNewAdhFields');
        const wrap = $('#encAdherentWrap');
        const cancel = $('#encAddAdhCancel');
        const btn = $('#encAddAdhBtn');
        if (fields) fields.style.display = on ? '' : 'none';
        if (wrap) wrap.style.display = on ? 'none' : '';
        if (cancel) cancel.style.display = on ? '' : 'none';
        if (btn) btn.textContent = on ? 'Adhérent existant' : '+ Ajouter un adhérent';
        if (on) {
          if ($('#encAdherent')) $('#encAdherent').value = '';
          $('#encNewNom')?.focus();
        } else {
          if ($('#encNewNom')) $('#encNewNom').value = '';
          if ($('#encNewPrenom')) $('#encNewPrenom').value = '';
          if ($('#encNewMatricule')) $('#encNewMatricule').value = '';
        }
      }
      $('#encAddAdhBtn').onclick = () => {
        const fields = $('#encNewAdhFields');
        setAddAdherentMode(fields && fields.style.display === 'none');
      };
      $('#encAddAdhCancel').onclick = () => setAddAdherentMode(false);

      $('#encForm').onsubmit = async (e) => {
        e.preventDefault();
        $('#encErr').textContent = '';
        const f = e.target;
        const compteCode = String($('#encCompte').value || '').toUpperCase().trim();
        if (!['BDL', 'CPA', 'CAISSE'].includes(compteCode)) {
          $('#encErr').textContent = 'Choisissez le compte (BDL, CPA ou Caisse).';
          return;
        }
        const adding = $('#encNewAdhFields') && $('#encNewAdhFields').style.display !== 'none';
        let adherentId = f.adherent_id.value || null;
        try {
          if (adding) {
            const nom = String($('#encNewNom')?.value || '').trim();
            const prenom = String($('#encNewPrenom')?.value || '').trim();
            const matricule = String($('#encNewMatricule')?.value || '').trim();
            if (!nom || !prenom || !matricule) {
              $('#encErr').textContent = 'Nom, prénom et matricule sont obligatoires pour ajouter un adhérent.';
              return;
            }
            const created = await API.createFinanceAdherent({ nom, prenom, matricule });
            adherentId = created?.id || null;
          }
          const saved = await API.createFinanceMouvement({
            compte_code: compteCode,
            sens: 'entree',
            nature: f.nature.value,
            montant: f.montant.value,
            date_mouvement: f.date_mouvement.value,
            adherent_id: adherentId,
            cheque_numero: f.nature.value === 'cheque' ? f.cheque_numero.value : '',
            observation: f.observation.value,
          });
          toast('Encaissement enregistré sur ' + (saved.compte_code || compteCode) + '.');
          const keepCompte = compteCode;
          f.reset();
          $('#encCompte').value = keepCompte;
          f.date_mouvement.value = new Date().toISOString().slice(0, 10);
          setAddAdherentMode(false);
          toggleCheque();
          loadPayes();
        } catch (err) { $('#encErr').textContent = err.message; }
      };

      let timer;
      $('#encSearch').oninput = () => { clearTimeout(timer); timer = setTimeout(loadPayes, 280); };
      $('#encMode').onchange = loadPayes;
      $('#encRefresh').onclick = () => { loadPayes(); toast('Liste actualisée.'); };
      await loadPayes();
    }

    async function renderSorties(body) {
      const list = await API.financesMouvements({ sens: 'sortie' });
      const causesManuelles = (meta.motifsSortie || []).filter((m) => !['ebanking', 'frais_application', 'commission', 'tva', 'commission_tva'].includes(m.code));
      body.innerHTML = `
        <div class="panel" style="margin-bottom:18px">
          <div class="panel-head"><h3>Nouvelle sortie</h3></div>
          <form id="outForm">
            <div class="form-grid">
              <div class="field">
                <label>Compte débité *</label>
                <select name="compte_code" id="outCompte" required>${compteOptions('CAISSE')}</select>
              </div>
              <div class="field">
                <label>Cause *</label>
                <select name="nature">
                  ${causesManuelles.map((m) => `<option value="${esc(m.code)}">${esc(m.label)}</option>`).join('')}
                </select>
              </div>
              <div class="field">
                <label>Montant (DA)</label>
                <input type="number" name="montant" min="0" step="0.01" placeholder="0.00" />
              </div>
              <div class="field">
                <label>Date</label>
                <input type="date" name="date_mouvement" value="${esc(new Date().toISOString().slice(0, 10))}" />
              </div>
              <div class="field" id="outCommTvaWrap" style="display:none">
                <label id="outCommTvaLabel">Commissions et TVA</label>
                <input type="number" name="commission_tva" id="outCommTva" min="0" step="0.01" placeholder="0.00" />
              </div>
              <div class="field full">
                <label>Détail / bénéficiaire</label>
                <input name="motif" placeholder="Ex. salaire mars, loyer local Alger…" />
              </div>
              <div class="field full">
                <label>Observation</label>
                <input name="observation" />
              </div>
            </div>
            <p class="muted" style="margin-top:8px"><b>Frais mensuels automatiques :</b> Frais ebanking BDL (2 000 DA) et Frais d’application CPA (1 071 DA) réduits automatiquement à chaque fin de mois (28, 29, 30 ou 31).</p>
            <div class="form-error" id="outErr"></div>
            <div class="modal-foot" style="margin-top:8px">
              <button type="submit" class="btn btn-gold">Enregistrer la sortie</button>
            </div>
          </form>
        </div>
        <div class="panel">
          <div class="panel-head"><h3>Historique des sorties</h3></div>
          ${renderMouvTable(list)}
        </div>
      `;
      function toggleCommTva() {
        const code = String($('#outCompte')?.value || '').toUpperCase();
        const isBdlOrCpa = code === 'BDL' || code === 'CPA';
        const wrap = $('#outCommTvaWrap');
        const label = $('#outCommTvaLabel');
        if (wrap) wrap.style.display = isBdlOrCpa ? '' : 'none';
        if (label) {
          label.textContent = code === 'CPA' ? 'TVA (CPA)' : 'Commissions et TVA (BDL)';
        }
        if (!isBdlOrCpa && $('#outCommTva')) $('#outCommTva').value = '';
      }
      $('#outCompte').onchange = toggleCommTva;
      toggleCommTva();
      $('#outForm').onsubmit = async (e) => {
        e.preventDefault();
        $('#outErr').textContent = '';
        const f = e.target;
        const compteCode = String(f.compte_code.value || '').toUpperCase();
        const montant = Number(f.montant.value);
        const commTva = (compteCode === 'BDL' || compteCode === 'CPA') ? Number(f.commission_tva.value) : 0;
        if (!(montant > 0) && !(commTva > 0)) {
          $('#outErr').textContent = 'Indiquez un montant, ou commissions et TVA.';
          return;
        }
        try {
          if (montant > 0) {
            await API.createFinanceMouvement({
              compte_code: compteCode,
              sens: 'sortie',
              nature: f.nature.value,
              montant,
              date_mouvement: f.date_mouvement.value,
              motif: f.motif.value,
              observation: f.observation.value,
            });
          }
          if (commTva > 0) {
            await API.createFinanceMouvement({
              compte_code: compteCode,
              sens: 'sortie',
              nature: 'commission_tva',
              montant: commTva,
              date_mouvement: f.date_mouvement.value,
              motif: compteCode === 'CPA' ? 'TVA (CPA)' : 'Commissions et TVA',
              observation: f.observation.value,
            });
          }
          toast('Sortie enregistrée.');
          renderTab();
        } catch (err) { $('#outErr').textContent = err.message; }
      };
      bindMouvActions(body, renderTab);
    }

    async function renderMouvements(body) {
      body.innerHTML = `
        <div class="toolbar">
          <input type="search" id="mvSearch" placeholder="Rechercher (adhérent, chèque, motif)…" />
          <select id="mvSens">
            <option value="">Entrées & sorties</option>
            <option value="entree">Entrées</option>
            <option value="sortie">Sorties</option>
          </select>
          <select id="mvCompte">
            <option value="">Tous les comptes</option>
            ${(meta.comptes || []).map((x) => `<option value="${esc(x.code)}">${esc(x.code)}</option>`).join('')}
          </select>
          <select id="mvNature">
            <option value="">Toutes natures</option>
            ${(meta.naturesEntree || []).map((n) => `<option value="${esc(n.code)}">${esc(n.label)}</option>`).join('')}
            ${(meta.motifsSortie || []).map((n) => `<option value="${esc(n.code)}">${esc(n.label)}</option>`).join('')}
          </select>
          <button class="btn btn-dark" id="mvRefresh">⟳</button>
        </div>
        <div id="mvTable"><div class="muted">Chargement…</div></div>
      `;
      async function load() {
        const params = {};
        const q = $('#mvSearch').value.trim(); if (q) params.q = q;
        const s = $('#mvSens').value; if (s) params.sens = s;
        const cpt = $('#mvCompte').value; if (cpt) params.compte = cpt;
        const n = $('#mvNature').value; if (n) params.nature = n;
        const list = await API.financesMouvements(params);
        $('#mvTable').innerHTML = renderMouvTable(list);
        bindMouvActions($('#mvTable'), load);
      }
      let timer;
      $('#mvSearch').oninput = () => { clearTimeout(timer); timer = setTimeout(load, 280); };
      $('#mvSens').onchange = load;
      $('#mvCompte').onchange = load;
      $('#mvNature').onchange = load;
      $('#mvRefresh').onclick = load;
      await load();
    }

    function renderMouvTable(list, { compact = false } = {}) {
      if (!list.length) return UI.emptyState('📒', 'Aucun mouvement.');
      return `<div class="table-wrap"><table class="data">
        <thead><tr>
          <th>Date</th><th>Compte</th><th>Type</th><th>Nature / cause</th>
          <th>Adhérent / détail</th><th>Chèque</th><th>Montant</th>${compact ? '' : '<th></th>'}
        </tr></thead><tbody>
        ${list.map((m) => {
          const who = m.adherent_id
            ? `${esc(m.adherent_nom || '')} ${esc(m.adherent_prenom || '')}`.trim() + (m.adherent_matricule ? ` · ${esc(m.adherent_matricule)}` : '')
            : esc(m.motif || m.observation || '—');
          const amtCls = m.sens === 'entree' ? 'amt-in' : 'amt-out';
          const sign = m.sens === 'entree' ? '+' : '−';
          return `<tr>
            <td class="muted">${esc(fmtDate(m.date_mouvement))}</td>
            <td>${compteTag(m.compte_code)}</td>
            <td>${m.sens === 'entree' ? '<span class="tag tag-actif">Entrée</span>' : '<span class="tag tag-inactif">Sortie</span>'}</td>
            <td>${natureTag(m.sens, m.nature)}</td>
            <td>${who}</td>
            <td class="mono">${esc(m.cheque_numero || '—')}</td>
            <td class="${amtCls}">${sign}${fmtDA(m.montant)}</td>
            ${compact ? '' : `<td><div class="row-actions">
              <button class="btn btn-dark btn-sm" data-edit-mouv="${m.id}">✎</button>
              <button class="btn btn-danger btn-sm" data-del-mouv="${m.id}">✕</button>
            </div></td>`}
          </tr>`;
        }).join('')}
        </tbody></table></div>`;
    }

    function bindMouvActions(root, reload) {
      root.querySelectorAll('[data-del-mouv]').forEach((btn) => {
        btn.onclick = () => confirm('Supprimer ce mouvement ?', async () => {
          try {
            await API.deleteFinanceMouvement(btn.dataset.delMouv);
            toast('Mouvement supprimé.');
            reload && reload();
          } catch (err) { toast(err.message, 'error'); }
        });
      });
      root.querySelectorAll('[data-edit-mouv]').forEach((btn) => {
        btn.onclick = async () => {
          const all = await API.financesMouvements();
          const m = all.find((x) => String(x.id) === String(btn.dataset.editMouv));
          if (!m) return;
          openMouvEdit(m, reload);
        };
      });
    }

    function openMouvEdit(m, reload) {
      const natures = m.sens === 'sortie' ? (meta.motifsSortie || []) : (meta.naturesEntree || []);
      openModal('Modifier le mouvement', `
        <form id="mvEditForm">
          <div class="form-grid">
            <div class="field"><label>Compte</label><select name="compte_code">${compteOptions(m.compte_code)}</select></div>
            <div class="field"><label>Nature / cause</label>
              <select name="nature">${natures.map((n) => `<option value="${esc(n.code)}" ${n.code === m.nature ? 'selected' : ''}>${esc(n.label)}</option>`).join('')}</select>
            </div>
            <div class="field"><label>Montant (DA)</label><input type="number" name="montant" min="0.01" step="0.01" value="${esc(m.montant)}" required /></div>
            <div class="field"><label>Date</label><input type="date" name="date_mouvement" value="${esc(fmtDate(m.date_mouvement))}" /></div>
            <div class="field"><label>N° chèque</label><input name="cheque_numero" value="${esc(m.cheque_numero || '')}" maxlength="7" /></div>
            <div class="field"><label>Détail</label><input name="motif" value="${esc(m.motif || '')}" /></div>
            <div class="field full"><label>Observation</label><textarea name="observation" rows="2">${esc(m.observation || '')}</textarea></div>
          </div>
          <div class="form-error" id="mvEditErr"></div>
          <div class="modal-foot">
            <button type="button" class="btn btn-ghost" id="mvEditCancel">Annuler</button>
            <button type="submit" class="btn btn-gold">Enregistrer</button>
          </div>
        </form>
      `, true);
      $('#mvEditCancel').onclick = closeModal;
      $('#mvEditForm').onsubmit = async (e) => {
        e.preventDefault();
        const f = e.target;
        try {
          await API.updateFinanceMouvement(m.id, {
            compte_code: f.compte_code.value,
            nature: f.nature.value,
            montant: f.montant.value,
            date_mouvement: f.date_mouvement.value,
            cheque_numero: f.cheque_numero.value,
            motif: f.motif.value,
            observation: f.observation.value,
          });
          toast('Mouvement mis à jour.');
          closeModal();
          reload && reload();
        } catch (err) { $('#mvEditErr').textContent = err.message; }
      };
    }

    await renderTab();
  }

  /* ============ SERVICES AUX ADHÉRENTS ============ */

  function serviceTypeTag(type) {
    return `<span class="tag tag-type">${esc(type || 'Général')}</span>`;
  }

  async function servicesAdherents() {
    const c = container();
    c.innerHTML = '<div class="muted">Chargement de la rubrique Services…</div>';

    let currentTab = 'adherents'; // 'adherents' | 'services'
    let stats = null;
    let allAdherents = [];
    let allServices = [];
    let adherentServicesMap = {};

    async function loadData() {
      try {
        const [statsData, adhRes, servicesData] = await Promise.all([
          API.servicesStats(),
          API.adherents({ limit: 1000 }),
          API.services()
        ]);
        stats = statsData;
        allAdherents = Array.isArray(adhRes) ? adhRes : (adhRes.rows || adhRes.data || []);
        allServices = Array.isArray(servicesData) ? servicesData : [];

        adherentServicesMap = {};
        for (const s of allServices) {
          if (!adherentServicesMap[s.adherent_id]) {
            adherentServicesMap[s.adherent_id] = [];
          }
          adherentServicesMap[s.adherent_id].push(s);
        }
      } catch (err) {
        toast(err.message, 'error');
      }
    }

    await loadData();

    function renderMain() {
      c.innerHTML = `
        <style>
          .kpi-row-small {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 16px;
            margin-bottom: 22px;
          }
          .kpi-small {
            background: var(--panel);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 16px 20px;
            position: relative;
            overflow: hidden;
            box-shadow: var(--shadow);
            transition: box-shadow 0.2s;
          }
          .kpi-small:hover { box-shadow: 0 4px 18px rgba(0,0,0,0.06); }
          .kpi-small-accent {
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            width: 4px;
            border-radius: 4px 0 0 4px;
          }
          .kpi-small .kpi-ico {
            width: 38px;
            height: 38px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            margin-bottom: 10px;
          }
          .kpi-small .kpi-val {
            font-size: 26px;
            font-weight: 800;
            color: var(--text);
            line-height: 1;
          }
          .kpi-small .kpi-lbl {
            font-size: 12.5px;
            color: var(--text-mute);
            margin-top: 6px;
            font-weight: 600;
          }
          .kpi-small .kpi-sub {
            font-size: 11px;
            color: var(--text-mute);
            margin-top: 3px;
          }
        </style>

        <div class="kpi-row-small">
          <div class="kpi-small">
            <div class="kpi-small-accent" style="background:#c49b2e"></div>
            <div class="kpi-ico" style="background:rgba(196,155,46,0.12);color:#c49b2e">🛠️</div>
            <div class="kpi-val">${stats?.total || 0}</div>
            <div class="kpi-lbl">Total services rendus</div>
            <div class="kpi-sub">${stats?.total_adherents || 0} adhérent(s) bénéficiaire(s)</div>
          </div>

          <div class="kpi-small">
            <div class="kpi-small-accent" style="background:#257a48"></div>
            <div class="kpi-ico" style="background:rgba(37,122,72,0.12);color:#257a48">👥</div>
            <div class="kpi-val">${stats?.total_adherents || 0}</div>
            <div class="kpi-lbl">Adhérents servis</div>
            <div class="kpi-sub">Adhérents uniques</div>
          </div>
        </div>

        <div class="panel" style="margin-bottom:18px">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
            <div style="display:flex;gap:10px">
              <button class="btn ${currentTab === 'adherents' ? 'btn-gold' : 'btn-dark'}" id="srvTabAdherents">👥 Par Adhérent</button>
              <button class="btn ${currentTab === 'services' ? 'btn-gold' : 'btn-dark'}" id="srvTabServices">📋 Tous les Services (${allServices.length})</button>
            </div>
            <button class="btn btn-gold" id="srvAddBtn">+ Ajouter un service</button>
          </div>
        </div>

        <div id="srvBody"></div>
      `;

      c.querySelector('#srvTabAdherents').onclick = () => { currentTab = 'adherents'; renderMain(); };
      c.querySelector('#srvTabServices').onclick = () => { currentTab = 'services'; renderMain(); };
      c.querySelector('#srvAddBtn').onclick = () => openServiceModal();

      const body = c.querySelector('#srvBody');
      if (currentTab === 'adherents') {
        renderAdherentsTab(body);
      } else {
        renderServicesTab(body);
      }
    }

    function renderAdherentsTab(body) {
      body.innerHTML = `
        <div class="toolbar" style="margin-bottom:16px">
          <input type="search" id="adhSrvSearch" placeholder="Rechercher un adhérent (nom, prénom, matricule, wilaya)…" />
          <span class="muted" id="adhSrvCount">${allAdherents.length} adhérent(s)</span>
        </div>
        <div id="adhSrvList" style="display:flex;flex-direction:column;gap:14px"></div>
      `;

      const listEl = body.querySelector('#adhSrvList');
      const searchInput = body.querySelector('#adhSrvSearch');

      function filterAndDraw() {
        const q = String(searchInput.value || '').toLowerCase().trim();
        const filtered = allAdherents.filter((a) => {
          if (!q) return true;
          return (
            (a.nom || '').toLowerCase().includes(q) ||
            (a.prenom || '').toLowerCase().includes(q) ||
            (a.matricule || '').toLowerCase().includes(q) ||
            (a.wilaya_code || '').includes(q) ||
            (a.niveau || '').toLowerCase().includes(q)
          );
        });

        body.querySelector('#adhSrvCount').textContent = `${filtered.length} adhérent(s)`;

        if (!filtered.length) {
          listEl.innerHTML = `<div class="empty"><div class="empty-ico">🔍</div><p>Aucun adhérent trouvé.</p></div>`;
          return;
        }

        listEl.innerHTML = filtered.map((a) => {
          const services = adherentServicesMap[a.id] || [];
          const photoHtml = a.photo
            ? `<img src="/uploads/${esc(a.photo)}" class="profile-photo" style="width:48px;height:48px;border-radius:10px;" />`
            : `<div class="profile-photo-ph" style="width:48px;height:48px;border-radius:10px;font-size:18px;">${esc((a.prenom || 'A')[0].toUpperCase())}</div>`;

          return `
            <div class="panel" style="margin-bottom:0;padding:16px 20px" data-adh-card="${a.id}">
              <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
                <div style="display:flex;align-items:center;gap:14px">
                  ${photoHtml}
                  <div>
                    <div style="font-size:15px;font-weight:700;color:var(--text)">${esc(a.nom)} ${esc(a.prenom)}</div>
                    <div class="muted" style="font-size:12.5px;margin-top:2px">
                      Matricule : <span class="mono">${esc(a.matricule || '—')}</span> ·
                      ${esc(a.niveau || 'Adhérent')} ·
                      Wilaya : <b>${esc(a.wilaya_code || '16')}</b>
                    </div>
                  </div>
                </div>
                <div style="display:flex;align-items:center;gap:10px">
                  <span class="tag ${services.length ? 'tag-actif' : 'tag-normale'}">${services.length} service(s) rendu(s)</span>
                  <button class="btn btn-gold btn-sm" data-add-service="${a.id}">+ Ajouter service</button>
                  <button class="btn btn-ghost btn-sm" data-toggle-services="${a.id}">${services.length ? '▼ Voir historique' : 'Détails'}</button>
                </div>
              </div>

              <div id="adhServicesWrap-${a.id}" style="display:none;margin-top:16px;padding-top:14px;border-top:1px dashed var(--border)">
                <div style="font-weight:700;font-size:13.5px;color:var(--gold-2);margin-bottom:10px">
                  📋 Services rendus à ${esc(a.prenom)} ${esc(a.nom)} :
                </div>
                ${!services.length ? `
                  <div class="muted" style="font-size:13px;padding:8px 0">Aucun service enregistré pour le moment. Cliquez sur "+ Ajouter service" pour en créer un.</div>
                ` : `
                  <div class="table-wrap" style="margin-bottom:0">
                    <table class="data" style="font-size:13px">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Titre du service</th>
                          <th>Type</th>
                          <th>Description</th>
                          <th style="width:100px">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${services.map((s) => `
                          <tr>
                            <td class="mono">${esc(fmtDate(s.date_service))}</td>
                            <td class="cell-strong">${esc(s.titre)}</td>
                            <td>${serviceTypeTag(s.type_service)}</td>
                            <td>${esc(s.description || '—')}</td>
                            <td>
                              <div class="row-actions">
                                <button class="btn btn-ghost btn-sm" data-edit-srv="${s.id}">✏️</button>
                                <button class="btn btn-danger btn-sm" data-del-srv="${s.id}">🗑️</button>
                              </div>
                            </td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                  </div>
                `}
              </div>
            </div>
          `;
        }).join('');

        listEl.querySelectorAll('[data-add-service]').forEach((btn) => {
          btn.onclick = () => openServiceModal(parseInt(btn.dataset.addService, 10));
        });

        listEl.querySelectorAll('[data-toggle-services]').forEach((btn) => {
          btn.onclick = () => {
            const adhId = btn.dataset.toggleServices;
            const wrap = listEl.querySelector(`#adhServicesWrap-${adhId}`);
            if (wrap) {
              const isHidden = wrap.style.display === 'none';
              wrap.style.display = isHidden ? 'block' : 'none';
              btn.textContent = isHidden ? '▲ Masquer' : (adherentServicesMap[adhId]?.length ? '▼ Voir historique' : 'Détails');
            }
          };
        });

        listEl.querySelectorAll('[data-edit-srv]').forEach((btn) => {
          btn.onclick = () => {
            const srvId = parseInt(btn.dataset.editSrv, 10);
            const srv = allServices.find((s) => s.id === srvId);
            if (srv) openServiceModal(srv.adherent_id, srv);
          };
        });

        listEl.querySelectorAll('[data-del-srv]').forEach((btn) => {
          btn.onclick = () => deleteServiceConfirm(parseInt(btn.dataset.delSrv, 10));
        });
      }

      searchInput.oninput = filterAndDraw;
      filterAndDraw();
    }

    function renderServicesTab(body) {
      const types = stats?.types || [];

      body.innerHTML = `
        <div class="toolbar">
          <input type="search" id="srvGlobalSearch" placeholder="Rechercher (adhérent, titre, description)…" />
          <select id="srvTypeFilter">
            <option value="">Tous les types de service</option>
            ${types.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join('')}
          </select>
          <span class="muted" id="srvGlobalCount">${allServices.length} service(s)</span>
        </div>

        <div class="panel" style="padding:0">
          <div class="table-wrap">
            <table class="data">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Adhérent</th>
                  <th>Titre du service</th>
                  <th>Type</th>
                  <th>Agent / Créateur</th>
                  <th style="width:110px">Actions</th>
                </tr>
              </thead>
              <tbody id="srvGlobalTbody"></tbody>
            </table>
          </div>
        </div>
      `;

      const tbody = body.querySelector('#srvGlobalTbody');
      const searchInput = body.querySelector('#srvGlobalSearch');
      const typeSelect = body.querySelector('#srvTypeFilter');

      function filterAndDrawGlobal() {
        const q = String(searchInput.value || '').toLowerCase().trim();
        const selectedType = typeSelect.value;

        const filtered = allServices.filter((s) => {
          if (selectedType && s.type_service !== selectedType) return false;
          if (!q) return true;

          const adhName = `${s.adherent_nom || ''} ${s.adherent_prenom || ''}`.toLowerCase();
          const mat = (s.adherent_matricule || '').toLowerCase();
          const titre = (s.titre || '').toLowerCase();
          const desc = (s.description || '').toLowerCase();

          return adhName.includes(q) || mat.includes(q) || titre.includes(q) || desc.includes(q);
        });

        body.querySelector('#srvGlobalCount').textContent = `${filtered.length} service(s)`;

        if (!filtered.length) {
          tbody.innerHTML = `<tr><td colspan="7" class="empty">Aucun service ne correspond à la recherche.</td></tr>`;
          return;
        }

        tbody.innerHTML = filtered.map((s) => `
          <tr>
            <td class="mono">${esc(fmtDate(s.date_service))}</td>
            <td>
              <div class="cell-strong">${esc(s.adherent_nom)} ${esc(s.adherent_prenom)}</div>
              <div class="mono" style="font-size:11.5px">${esc(s.adherent_matricule || '—')}</div>
            </td>
            <td class="cell-strong">${esc(s.titre)}</td>
            <td>${serviceTypeTag(s.type_service)}</td>
            <td class="muted" style="font-size:12px">${esc(s.created_by_email || '—')}</td>
            <td>
              <div class="row-actions">
                <button class="btn btn-ghost btn-sm" data-edit-srv-g="${s.id}">✏️ Éditer</button>
                <button class="btn btn-danger btn-sm" data-del-srv-g="${s.id}">🗑️</button>
              </div>
            </td>
          </tr>
        `).join('');

        tbody.querySelectorAll('[data-edit-srv-g]').forEach((btn) => {
          btn.onclick = () => {
            const srvId = parseInt(btn.dataset.editSrvG, 10);
            const srv = allServices.find((s) => s.id === srvId);
            if (srv) openServiceModal(srv.adherent_id, srv);
          };
        });

        tbody.querySelectorAll('[data-del-srv-g]').forEach((btn) => {
          btn.onclick = () => deleteServiceConfirm(parseInt(btn.dataset.delSrvG, 10));
        });
      }

      searchInput.oninput = filterAndDrawGlobal;
      typeSelect.onchange = filterAndDrawGlobal;

      filterAndDrawGlobal();
    }

    function openServiceModal(defaultAdherentId = null, serviceToEdit = null) {
      const isEdit = !!serviceToEdit;
      const types = stats?.types || [
        'Accompagnement / Conseil',
        'Attestation / Document',
        'Assistance administrative',
        'Formation / Atelier',
        'Événement / Networking',
        'Médiation / Contentieux',
        'Autre service'
      ];

      const titleText = isEdit ? 'Modifier le service' : 'Ajouter un service rendu à un adhérent';

      // Determine initial selected adherent
      const initialAdhId = serviceToEdit?.adherent_id || defaultAdherentId;
      const initialAdh = initialAdhId ? allAdherents.find((a) => a.id === initialAdhId) : null;

      openModal(titleText, `
        <form id="serviceForm">
          <div class="form-grid">
            <div class="field full">
              <label>Adhérent bénéficiaire *</label>
              <input type="hidden" name="adherent_id" id="selectedAdherentId" value="${initialAdh ? initialAdh.id : ''}" required />

              <div id="adhSelectedBox" style="${initialAdh ? '' : 'display:none;'}margin-bottom:8px;">
                <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--panel-2);border:1px solid var(--gold);border-radius:10px;">
                  <div>
                    <strong id="selectedAdhName" style="color:var(--text);font-size:14px;">${initialAdh ? esc(initialAdh.nom) + ' ' + esc(initialAdh.prenom) : ''}</strong>
                    <span class="mono" id="selectedAdhMat" style="margin-left:10px;font-size:12px;">${initialAdh ? esc(initialAdh.matricule || '') : ''}</span>
                  </div>
                  ${isEdit ? '' : `<button type="button" class="btn btn-ghost btn-sm" id="btnChangeAdherent">Changer</button>`}
                </div>
              </div>

              <div id="adhSearchBox" style="${initialAdh ? 'display:none;' : ''}">
                <input type="search" id="adhInputSearch" placeholder="Nom, prénom ou matricule" autocomplete="off" />
                <div id="adhSearchResults" style="max-height:220px;overflow-y:auto;border:1px solid var(--border-strong);border-radius:10px;margin-top:6px;background:var(--panel);display:none;box-shadow:var(--shadow);"></div>
              </div>
            </div>

            <div class="field full">
              <label>Titre / Libellé du service *</label>
              <input name="titre" required  value="${esc(serviceToEdit?.titre || '')}" />
            </div>

            <div class="field">
              <label>Type de service *</label>
              <select name="type_service">
                ${types.map((t) => `<option value="${esc(t)}" ${(serviceToEdit?.type_service || 'Accompagnement / Conseil') === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}
              </select>
            </div>

            <div class="field">
              <label>Date du service *</label>
              <input type="date" name="date_service" value="${esc(serviceToEdit ? fmtDate(serviceToEdit.date_service) : new Date().toISOString().slice(0, 10))}" required />
            </div>

            <div class="field full">
              <label>Description / Détails du service rendu</label>
              <textarea name="description" rows="3" >${esc(serviceToEdit?.description || '')}</textarea>
            </div>
          </div>

          <div class="form-error" id="serviceErr"></div>

          <div class="modal-foot">
            <button type="button" class="btn btn-ghost" onclick="UI.closeModal()">Annuler</button>
            <button type="submit" class="btn btn-gold">${isEdit ? 'Enregistrer les modifications' : 'Créer le service'}</button>
          </div>
        </form>
      `);

      // Bind search behavior
      const input = $('#adhInputSearch');
      const results = $('#adhSearchResults');
      const hiddenId = $('#selectedAdherentId');
      const selectedBox = $('#adhSelectedBox');
      const searchBox = $('#adhSearchBox');
      const selectedName = $('#selectedAdhName');
      const selectedMat = $('#selectedAdhMat');
      const btnChange = $('#btnChangeAdherent');

      if (btnChange) {
        btnChange.onclick = () => {
          hiddenId.value = '';
          selectedBox.style.display = 'none';
          searchBox.style.display = 'block';
          if (input) {
            input.value = '';
            input.focus();
          }
        };
      }

      if (input) {
        input.oninput = () => {
          const query = input.value.toLowerCase().trim();
          if (!query) {
            results.style.display = 'none';
            results.innerHTML = '';
            return;
          }
          const matches = allAdherents.filter((a) => {
            return (
              (a.nom || '').toLowerCase().includes(query) ||
              (a.prenom || '').toLowerCase().includes(query) ||
              (a.matricule || '').toLowerCase().includes(query)
            );
          }).slice(0, 15);

          if (!matches.length) {
            results.style.display = 'block';
            results.innerHTML = `<div class="muted" style="padding:12px;text-align:center;">Aucun adhérent trouvé.</div>`;
            return;
          }

          results.style.display = 'block';
          results.innerHTML = matches.map((a) => `
            <div class="adh-search-item" data-id="${a.id}" style="padding:10px 14px;border-bottom:1px solid var(--border);cursor:pointer;display:flex;align-items:center;justify-content:space-between;">
              <div>
                <strong style="color:var(--text);">${esc(a.nom)} ${esc(a.prenom)}</strong>
                <span class="muted" style="font-size:12px;margin-left:8px;">Wilaya ${esc(a.wilaya_code || '16')}</span>
              </div>
              <span class="mono" style="font-size:12px;">${esc(a.matricule || 'Sans mat.')}</span>
            </div>
          `).join('');

          results.querySelectorAll('.adh-search-item').forEach((item) => {
            item.onmouseenter = () => item.style.background = 'var(--panel-2)';
            item.onmouseleave = () => item.style.background = 'transparent';
            item.onclick = () => {
              const adhId = parseInt(item.dataset.id, 10);
              const adh = allAdherents.find((a) => a.id === adhId);
              if (adh) {
                hiddenId.value = adh.id;
                selectedName.textContent = `${adh.nom} ${adh.prenom}`;
                selectedMat.textContent = adh.matricule || '';
                results.style.display = 'none';
                searchBox.style.display = 'none';
                selectedBox.style.display = 'block';
              }
            };
          });
        };
      }

      const form = $('#serviceForm');
      form.onsubmit = async (e) => {
        e.preventDefault();
        $('#serviceErr').textContent = '';
        const f = e.target;

        const adhIdVal = parseInt(hiddenId.value, 10);
        if (!adhIdVal) {
          $('#serviceErr').textContent = 'Veuillez rechercher et sélectionner un adhérent.';
          return;
        }

        const payload = {
          adherent_id: adhIdVal,
          titre: f.titre.value,
          type_service: f.type_service.value,
          date_service: f.date_service.value,
          description: f.description.value,
        };

        try {
          if (isEdit) {
            await API.updateService(serviceToEdit.id, payload);
            toast('Service mis à jour avec succès.');
          } else {
            await API.createService(payload);
            toast('Nouveau service enregistré avec succès.');
          }
          closeModal();
          await loadData();
          renderMain();
        } catch (err) {
          $('#serviceErr').textContent = err.message;
        }
      };
    }

    async function deleteServiceConfirm(id) {
      if (!confirm('Voulez-vous vraiment supprimer cet enregistrement de service ?')) return;
      try {
        await API.deleteService(id);
        toast('Service supprimé.');
        await loadData();
        renderMain();
      } catch (err) {
        toast(err.message, 'error');
      }
    }

    renderMain();
  }

  return { setRef, setRole, setPermissions, dashboard, adherentsList, bureauExecutifList, demandesList, documentsList, parametres, saisieAjout, comptesList, blacklistList, auditList, showAuditDetail, finances, servicesAdherents };
})();
