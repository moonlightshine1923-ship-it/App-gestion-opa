// ===== Contrôleur principal =====
(() => {
  const { $, $$, esc } = UI;
  let CURRENT = null;

  const ROLE_LABEL = { admin: 'Administrateur', president: 'Président', saisie: 'Compte personnalisé' };

  const MENU_FULL = [
    { id: 'dashboard', label: 'Tableau de bord', icon: '📊', title: 'Tableau de bord', render: () => Views.dashboard() },
    { id: 'adherents', label: 'Adhérents', icon: '👥', title: 'Gestion des adhérents', render: () => Views.adherentsList() },
    { id: 'services', label: 'Services', icon: '🛠️', title: 'Services aux adhérents', render: () => Views.servicesAdherents() },
    { id: 'bureau-executif', label: 'Bureau exécutif', icon: '🏛️', title: 'Bureau exécutif', render: () => Views.bureauExecutifList() },
    { id: 'blacklist', label: 'Blacklist', icon: '🚫', title: 'Liste noire — Blacklist', render: () => Views.blacklistList() },
    { id: 'demandes', label: 'Demandes', icon: '📨', title: 'Demandes (site web)', render: () => Views.demandesList() },
    { id: 'documents', label: 'Documents', icon: '📁', title: 'Gestion documentaire', render: () => Views.documentsList() },
    { id: 'finances', label: 'Finances', icon: '💰', title: 'Gestion des finances', render: () => Views.finances() },
    { id: 'comptes', label: 'Comptes', icon: '🔑', title: 'Comptes utilisateurs', render: () => Views.comptesList() },
    { id: 'parametres', label: 'Paramètres', icon: '⚙️', title: 'Paramètres', render: () => Views.parametres() },
  ];

  function buildLimitedMenu(perms = []) {
    const menu = [];
    if (perms.includes('adherents_manage')) {
      menu.push({ id: 'adherents', label: 'Adhérents', icon: '👥', title: 'Gestion des adhérents', render: () => Views.adherentsList() });
    } else if (perms.includes('adherents_add')) {
      menu.push({ id: 'ajout', label: 'Ajouter un adhérent', icon: '➕', title: 'Ajouter un adhérent', render: () => Views.saisieAjout() });
    }
    if (perms.includes('demandes_view') || perms.includes('demandes_edit')) {
      menu.push({ id: 'demandes', label: 'Demandes', icon: '📨', title: 'Demandes (site web)', render: () => Views.demandesList() });
    }
    if (perms.includes('documents_view')) {
      menu.push({ id: 'documents', label: 'Documents', icon: '📁', title: 'Gestion documentaire', render: () => Views.documentsList() });
    }
    if (!menu.length) {
      menu.push({ id: 'ajout', label: 'Accueil', icon: '🔒', title: 'Accès', render: () => Views.parametres() });
    }
    return menu;
  }

  async function maybeAutoMonthlyBackup(user) {
    if (!['admin', 'president'].includes(user.role)) return;
    const key = `opa_auto_backup_${new Date().toISOString().slice(0, 7)}`;
    if (localStorage.getItem(key)) return;
    try {
      const r = await API.backup();
      await API.downloadBackup(r.file);
      localStorage.setItem(key, '1');
      UI.toast('Sauvegarde mensuelle automatique téléchargée.', 'info');
    } catch (err) {
      console.warn('Sauvegarde mensuelle auto non effectuée :', err.message);
    }
  }

  let MENU = MENU_FULL;

  function buildNav() {
    const nav = $('#navMenu');
    nav.innerHTML = MENU.map((m) => `
      <div class="nav-item" data-id="${m.id}">
        <span class="nav-ico">${m.icon}</span><span>${esc(m.label)}</span>
      </div>`).join('');
    nav.querySelectorAll('.nav-item').forEach((el) => el.onclick = () => navigate(el.dataset.id));
  }

  async function navigate(id) {
    const menu = MENU.find((m) => m.id === id) || MENU[0];
    $$('.nav-item').forEach((el) => el.classList.toggle('active', el.dataset.id === menu.id));
    $('#pageTitle').textContent = menu.title;
    $('#sidebar').classList.remove('open');
    try {
      await menu.render();
    } catch (err) {
      $('#viewContainer').innerHTML = `<div class="empty"><div class="empty-ico">⚠️</div><p>${esc(err.message)}</p></div>`;
    }
  }

  async function enterApp(session) {
    CURRENT = session;
    const role = session.user.role;
    const permissions = Array.isArray(session.user.permissions) ? session.user.permissions : [];
    const ref = await API.reference();
    Views.setRef(ref);
    Views.setRole(role);
    Views.setPermissions(permissions);

    if (role === 'president') {
      MENU = [
        ...MENU_FULL,
        { id: 'audit', label: "Journal d'audit", icon: '📋', title: "Journal d'audit des actions", render: () => Views.auditList() }
      ];
    } else if (role === 'admin') {
      MENU = MENU_FULL;
    } else {
      MENU = buildLimitedMenu(permissions);
    }

    const name = role === 'admin' ? 'Administrateur OPA' : (role === 'president' ? 'Président OPA' : 'Utilisateur autorisé');
    $('#userName').textContent = name;
    $('#userRole').textContent = ROLE_LABEL[role] || role;
    $('#userAvatar').textContent = (name[0] || 'U').toUpperCase();
    $('#topRole').textContent = ROLE_LABEL[role] || role;

    buildNav();
    $('#loginScreen').classList.add('hidden');
    $('#app').classList.remove('hidden');
    await maybeAutoMonthlyBackup(session.user);
    navigate(MENU[0].id);
  }

  function showLogin() {
    $('#app').classList.add('hidden');
    $('#loginScreen').classList.remove('hidden');
  }

  $('#loginForm').onsubmit = async (e) => {
    e.preventDefault();
    $('#loginError').textContent = '';
    const email = $('#loginEmail').value.trim();
    const pwd = $('#loginPassword').value;
    try {
      const res = await API.login(email, pwd);
      API.setToken(res.token);
      await enterApp({ user: res.user });
    } catch (err) {
      $('#loginError').textContent = err.message;
    }
  };

  const togglePwd = $('#togglePassword');
  if (togglePwd) togglePwd.onclick = () => {
    const input = $('#loginPassword');
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    togglePwd.querySelector('.eye-open').style.display = show ? 'none' : '';
    togglePwd.querySelector('.eye-closed').style.display = show ? '' : 'none';
    togglePwd.title = show ? 'Masquer le mot de passe' : 'Afficher le mot de passe';
    input.focus();
  };

  $('#logoutBtn').onclick = () => { API.clearToken(); CURRENT = null; showLogin(); };

  $('#modalClose').onclick = UI.closeModal;
  $('#modal').onclick = (e) => { if (e.target.id === 'modal') UI.closeModal(); };
  $('#menuToggle').onclick = () => $('#sidebar').classList.toggle('open');

  (async () => {
    const token = API.getToken();
    if (!token) { showLogin(); return; }
    try {
      const session = await API.me();
      await enterApp({ user: session.user });
    } catch {
      API.clearToken();
      showLogin();
    }
  })();
})();
