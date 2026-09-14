// ===== Client API OPA =====
const API = (() => {
  const TOKEN_KEY = 'opa_token';

  function getToken() { return localStorage.getItem(TOKEN_KEY); }
  function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
  function clearToken() { localStorage.removeItem(TOKEN_KEY); }
  
  async function request(method, url, body, isForm = false) {
    const headers = {};
    const token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
    let payload;
    if (isForm) {
      payload = body; // FormData
    } else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    const res = await fetch('/api' + url, { method, headers, body: payload });
    if (res.status === 401 && !url.includes('/auth/login')) {
      clearToken();
      window.location.reload();
      return;
    }
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur serveur.');
      return data;
    }
    if (!res.ok) throw new Error('Erreur serveur.');
    return res;
  }

  return {
    getToken, setToken, clearToken,
    login: (email, password) => request('POST', '/auth/login', { email, password }),
    me: () => request('GET', '/auth/me'),
    changePassword: (current, next) => request('POST', '/auth/change-password', { current, next }),
    reference: () => request('GET', '/reference'),
    stats: () => request('GET', '/stats'),

    users: () => request('GET', '/users'),
    createUser: (data) => request('POST', '/users', data),
    resetUserPassword: (id, password) => request('PATCH', `/users/${id}/password`, { password }),
    updateUserRole: (id, role, permissions = []) => request('PATCH', `/users/${id}/role`, { role, permissions }),
    deleteUser: (id) => request('DELETE', '/users/' + id),

    adherents: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request('GET', '/adherents' + (q ? '?' + q : ''));
    },
    adherent: (id) => request('GET', '/adherents/' + id),
    previewMatricule: (wilaya_code, type_code, annee, bureau_code = '') =>
      request('GET', `/adherents/preview/matricule?wilaya_code=${encodeURIComponent(wilaya_code)}&type_code=${encodeURIComponent(type_code)}&annee=${encodeURIComponent(annee)}&bureau_code=${encodeURIComponent(bureau_code)}`),
    createAdherent: (form) => request('POST', '/adherents', form, true),
    updateAdherent: (id, form) => request('PUT', '/adherents/' + id, form, true),
    updateAdherentRanking: (id, data) => request('PATCH', `/adherents/${id}/ranking`, data),
    deleteAdherent: (id) => request('DELETE', '/adherents/' + id),
    backup: () => request('POST', '/backup', {}),
    listBackups: () => request('GET', '/backup'),
    downloadBackup: async (name) => {
      const res = await fetch('/api/backup/download?name=' + encodeURIComponent(name), {
        headers: { Authorization: 'Bearer ' + getToken() },
      });
      if (!res.ok) throw new Error('Téléchargement impossible.');
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = name;
      link.click();
    },

    demandes: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request('GET', '/demandes' + (q ? '?' + q : ''));
    },
    demande: (id) => request('GET', '/demandes/' + id),
    updateDemande: (id, data) => request('PATCH', '/demandes/' + id, data),
    cloturerDemande: (id) => request('PATCH', `/demandes/${id}/cloturer`),
    deleteDemande: (id) => request('DELETE', '/demandes/' + id),

    // Section documents nettoyée (La suppression pointe vers ton nouveau contrôleur)
    documents: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request('GET', '/documents' + (q ? '?' + q : ''));
    },
    createDocument: (form) => request('POST', '/documents', form, true),
    deleteDocument: (id) => request('DELETE', '/documents/' + id),
    deleteGroupedDocuments: (ids) => request('POST', '/documents/suppression-groupes', { ids }),

    /* --- Méthodes pour la gestion documentaire --- */
    adherentsStatut: () => request('GET', '/documents/adherents-statut'),
    fusionnerDossier: (adherentId, formData) => request('POST', `/documents/fusionner/${adherentId}`, formData, true),

    // --- BLACKLIST ---
    blacklist: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request('GET', '/blacklist' + (q ? '?' + q : ''));
    },
    blacklistEntry: (id) => request('GET', '/blacklist/' + id),
    createBlacklist: (data) => request('POST', '/blacklist', data),
    updateBlacklist: (id, data) => request('PATCH', '/blacklist/' + id, data),
    deleteBlacklist: (id) => request('DELETE', '/blacklist/' + id),
    blacklistAdherent: (adherentId, data = {}) => request('POST', `/blacklist/adherent/${adherentId}`, data),

    // --- AUDIT ---
    audit: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request('GET', '/audit' + (q ? '?' + q : ''));
    },

    // --- FINANCES ---
    financesDashboard: () => request('GET', '/finances/dashboard'),
    financesMeta: () => request('GET', '/finances/meta'),
    financesComptes: () => request('GET', '/finances/comptes'),
    updateFinanceCompte: (code, data) => request('PATCH', '/finances/comptes/' + encodeURIComponent(code), data),
    financesMouvements: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request('GET', '/finances/mouvements' + (q ? '?' + q : ''));
    },
    createFinanceMouvement: (data) => request('POST', '/finances/mouvements', data),
    updateFinanceMouvement: (id, data) => request('PATCH', '/finances/mouvements/' + id, data),
    deleteFinanceMouvement: (id) => request('DELETE', '/finances/mouvements/' + id),
    financesAdherentsPayes: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request('GET', '/finances/adherents-payes' + (q ? '?' + q : ''));
    },
    createFinanceAdherent: (data) => request('POST', '/finances/adherents-rapides', data),

    // --- SERVICES ADHÉRENTS ---
    services: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request('GET', '/services' + (q ? '?' + q : ''));
    },
    servicesStats: () => request('GET', '/services/stats'),
    servicesAdherent: (adherentId) => request('GET', '/services/adherent/' + adherentId),
    createService: (data) => request('POST', '/services', data),
    updateService: (id, data) => request('PATCH', '/services/' + id, data),
    deleteService: (id) => request('DELETE', '/services/' + id),

    // Renvoie un blob URL authentifié pour un fichier protégé
    fileUrl: async (relPath) => {
      const res = await fetch('/uploads/' + relPath, {
        headers: { Authorization: 'Bearer ' + getToken() },
      });
      if (!res.ok) throw new Error('Fichier indisponible.');
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    },
  };
})();