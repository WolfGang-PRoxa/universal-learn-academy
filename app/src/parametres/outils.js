// Petits utilitaires de la page des paramètres.

/** h('button', { class: 'bouton', onClick: f }, 'Libellé') */
export function h(balise, props = {}, ...enfants) {
  const el = document.createElement(balise);
  for (const [cle, valeur] of Object.entries(props || {})) {
    if (valeur === null || valeur === undefined || valeur === false) continue;
    if (cle === 'class') el.className = valeur;
    else if (cle === 'dataset') Object.assign(el.dataset, valeur);
    else if (cle.startsWith('on') && typeof valeur === 'function') el.addEventListener(cle.slice(2).toLowerCase(), valeur);
    else if (['value', 'checked', 'disabled'].includes(cle)) el[cle] = valeur;
    else if (valeur === true) el.setAttribute(cle, '');
    else el.setAttribute(cle, String(valeur));
  }
  for (const e of enfants.flat(Infinity)) {
    if (e === null || e === undefined || e === false) continue;
    el.append(e instanceof Node ? e : document.createTextNode(String(e)));
  }
  return el;
}

const ICONES = {
  maj: '<path d="M21 12a9 9 0 0 1-15.5 6.3L3 16"/><path d="M3 12A9 9 0 0 1 18.5 5.7L21 8"/><path d="M21 3v5h-5M3 21v-5h5"/>',
  ecran: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  raccourci: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 15V12a3 3 0 0 1 3-3h4m-2.5-2.5L16 9l-2.5 2.5"/>',
  menu: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  dossier: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2Z"/>',
  claude: '<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8Z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8Z"/>',
  livre: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5Z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  arriere: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M7 20h10"/><circle cx="17.5" cy="16.5" r="3.5" fill="currentColor" stroke="none" opacity=".25"/><path d="M17.5 15v1.5l1 1"/>',
  echelle: '<path d="M4 20 20 4"/><path d="M14 4h6v6M10 20H4v-6"/>',
  ok: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  attention: '<path d="M12 3 2 21h20Z"/><path d="M12 10v5M12 18v.5"/>',
};

export function icone(nom, taille = 18) {
  const s = document.createElement('span');
  s.className = 'icone';
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = `<svg viewBox="0 0 24 24" width="${taille}" height="${taille}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${ICONES[nom] || ''}</svg>`;
  return s;
}

export function bouton(libelle, { genre = '', onClick, titre, desactive } = {}) {
  return h('button', { type: 'button', class: `bouton ${genre}`.trim(), title: titre, disabled: desactive, onClick }, libelle);
}

export function carte(id, nomIcone, titre, description, ...contenu) {
  return h('section', { class: 'carte', id },
    h('div', { class: 'carte-tete' }, icone(nomIcone, 19), h('div', {}, h('h2', {}, titre), description ? h('p', {}, description) : null)),
    ...contenu);
}

/** Bandeau d'état : genre « ok », « alerte », « erreur » ou neutre. */
export function etat(genre, texte) {
  const nom = { ok: 'ok', alerte: 'attention', erreur: 'x' }[genre] || 'info';
  return h('div', { class: `etat ${genre || ''}`.trim() }, icone(nom, 16), h('span', {}, texte));
}

export function note(message, { erreur = false, duree = 3500 } = {}) {
  const hote = document.getElementById('notes');
  const n = h('div', { class: `note${erreur ? ' erreur' : ''}` }, message);
  hote.append(n);
  requestAnimationFrame(() => n.classList.add('visible'));
  setTimeout(() => { n.classList.remove('visible'); setTimeout(() => n.remove(), 300); }, duree);
}

export function confirmer({ titre, message, valider = 'Confirmer', danger = false }) {
  return new Promise((resolve) => {
    const d = h('dialog', {});
    const fermer = (v) => { d.close(); d.remove(); resolve(v); };
    d.append(h('h2', {}, titre), message ? h('p', {}, message) : null,
      h('div', { class: 'ligne' }, bouton('Annuler', { onClick: () => fermer(false) }),
        bouton(valider, { genre: danger ? 'discret-danger' : 'principal', onClick: () => fermer(true) })));
    d.addEventListener('cancel', (e) => { e.preventDefault(); fermer(false); });
    document.body.append(d);
    d.showModal();
  });
}

export function antiRebond(fn, delai) {
  let t = null;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delai); };
}

/** Message d'une erreur du processus principal, sans le préfixe d'Electron. */
export function messageErreur(e) {
  return String((e && e.message) || e || 'erreur inconnue').replace(/^Error invoking remote method '[^']+':\s*(Error:\s*)?/, '');
}
