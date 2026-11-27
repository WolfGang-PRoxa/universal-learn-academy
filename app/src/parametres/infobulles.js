/* Infobulles des fenêtres de l'hôte (paramètres, documentation, guide), 2.11.0
   --------------------------------------------------------------------------
   Même comportement que celles des pages (_outils/charte/assets/cours.js,
   installerInfobulles) : les title deviennent data-infobulle, montrés dans une bulle
   (#ula-infobulle, parametres.css) près du pointeur, ou sous l'élément au clavier,
   après le délai réglé dans la carte Affichage (affichage.infobulle, en ms). */

let delai = 0;
let installe = false;

/** Délai d'apparition, en ms (0 à 2500). */
export function regler(ms) {
  const n = Number(ms);
  if (Number.isFinite(n) && n >= 0) delai = Math.min(2500, n);
}

export function installer(ms = 0) {
  regler(ms);
  if (installe) return;
  installe = true;
  const bulle = document.createElement('div');
  bulle.id = 'ula-infobulle';
  bulle.setAttribute('aria-hidden', 'true');
  document.body.append(bulle);
  let cible = null;
  let minuterie = null;
  let souris = { x: 0, y: 0 };

  const convertir = (e) => {
    const t = e.getAttribute('title');
    if (t == null) return;
    e.removeAttribute('title');
    if (!t) return;
    e.dataset.infobulle = t;
    if (!e.hasAttribute('aria-label') && !e.textContent.trim()) e.setAttribute('aria-label', t);
  };
  const parcourir = (n) => {
    if (n.nodeType !== 1) return;
    if (n.hasAttribute('title')) convertir(n);
    n.querySelectorAll('[title]').forEach(convertir);
  };
  parcourir(document.body);
  new MutationObserver((liste) => {
    for (const m of liste) {
      if (m.type === 'attributes') convertir(m.target);
      else m.addedNodes.forEach(parcourir);
    }
  }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['title'] });

  const placer = (x, y, sous) => {
    const l = bulle.offsetWidth;
    const h = bulle.offsetHeight;
    let gauche = x + 12;
    let haut = y + (sous ? 8 : 16);
    if (gauche + l > innerWidth - 8) gauche = Math.max(8, innerWidth - l - 8);
    if (haut + h > innerHeight - 8) haut = Math.max(8, y - h - 12);
    bulle.style.left = gauche + 'px';
    bulle.style.top = haut + 'px';
  };
  const montrer = (e, clavier) => {
    if (!e.dataset.infobulle || !e.isConnected) return;
    bulle.textContent = e.dataset.infobulle;
    if (clavier) {
      const r = e.getBoundingClientRect();
      placer(r.left - 12, r.bottom, true);
    } else placer(souris.x, souris.y);
    bulle.classList.add('visible');
  };
  const cacher = () => {
    clearTimeout(minuterie);
    minuterie = null;
    cible = null;
    bulle.classList.remove('visible');
  };
  const programmer = (e, clavier) => {
    clearTimeout(minuterie);
    cible = e;
    if (delai > 0) minuterie = setTimeout(() => montrer(e, clavier), delai);
    else montrer(e, clavier);
  };
  // Après un appui, la bulle ne revient qu'une fois le pointeur sorti de l'élément
  let appuye = null;
  document.addEventListener('mousedown', (ev) => (appuye = ev.target.closest?.('[data-infobulle]') || null), true);
  document.addEventListener('mouseover', (ev) => {
    const e = ev.target.closest?.('[data-infobulle]') || null;
    if (e === cible || (e && e === appuye)) return;
    appuye = null;
    cacher();
    if (e) {
      souris = { x: ev.clientX, y: ev.clientY };
      programmer(e, false);
    }
  });
  document.addEventListener('mousemove', (ev) => {
    souris = { x: ev.clientX, y: ev.clientY };
    if (cible && bulle.classList.contains('visible')) placer(souris.x, souris.y);
  });
  document.addEventListener('mouseout', (ev) => {
    if (cible && !ev.relatedTarget) cacher();
  });
  document.addEventListener('focusin', (ev) => {
    const e = ev.target;
    if (e.dataset?.infobulle && e.matches(':focus-visible')) programmer(e, true);
  });
  document.addEventListener('focusout', cacher);
  for (const type of ['mousedown', 'wheel', 'keydown', 'scroll'])
    document.addEventListener(type, cacher, { passive: true, capture: true });
}
