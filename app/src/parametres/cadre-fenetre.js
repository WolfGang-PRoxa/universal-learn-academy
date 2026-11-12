// Cadre de réglage de la fenêtre au lancement (repris de CV Studio) : les écrans
// sont représentés à l'échelle, et un rectangle (la future fenêtre) se déplace et se
// redimensionne à la souris ou au clavier (flèches ; Maj : pas de 50 px ; Alt :
// redimensionner).

import { h } from './outils.js';

const POIGNEES = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];

export function creerCadre({ ecrans, bornes, min, surChangement, surFin }) {
  let rect = { ...bornes };

  const bureau = ecrans.reduce((acc, e) => ({
    gauche: Math.min(acc.gauche, e.bounds.x),
    haut: Math.min(acc.haut, e.bounds.y),
    droite: Math.max(acc.droite, e.bounds.x + e.bounds.width),
    bas: Math.max(acc.bas, e.bounds.y + e.bounds.height),
  }), { gauche: Infinity, haut: Infinity, droite: -Infinity, bas: -Infinity });
  const largeurBureau = bureau.droite - bureau.gauche;
  const hauteurBureau = bureau.bas - bureau.haut;

  const surface = h('div', { class: 'cadre-surface' });
  const etiquette = h('span', { class: 'etiquette' });
  const fenetre = h('div', { class: 'cadre-fenetre', tabindex: '0', 'aria-label': 'Fenêtre de l’application (déplacer ou redimensionner)' },
    etiquette,
    POIGNEES.map((d) => h('span', { class: `poignee ${d}`, dataset: { dir: d } })),
  );
  const blocs = ecrans.map((e) => h('div', { class: `cadre-ecran${e.primary ? ' principal' : ''}` },
    h('span', {}, `Écran ${e.index}${e.primary ? ' (principal)' : ''} · ${e.bounds.width}×${e.bounds.height}`)));
  surface.append(...blocs, fenetre);
  const element = h('div', { class: 'cadre' }, surface);

  let echelle = 1;

  function disposer() {
    const dispo = element.clientWidth || 560;
    echelle = Math.min(dispo / largeurBureau, 300 / hauteurBureau);
    surface.style.width = `${largeurBureau * echelle}px`;
    surface.style.height = `${hauteurBureau * echelle}px`;
    ecrans.forEach((e, i) => Object.assign(blocs[i].style, {
      left: `${(e.bounds.x - bureau.gauche) * echelle}px`,
      top: `${(e.bounds.y - bureau.haut) * echelle}px`,
      width: `${e.bounds.width * echelle}px`,
      height: `${e.bounds.height * echelle}px`,
    }));
    peindre();
  }

  function peindre() {
    Object.assign(fenetre.style, {
      left: `${(rect.x - bureau.gauche) * echelle}px`,
      top: `${(rect.y - bureau.haut) * echelle}px`,
      width: `${rect.width * echelle}px`,
      height: `${rect.height * echelle}px`,
    });
    etiquette.textContent = `${Math.round(rect.width)} × ${Math.round(rect.height)}`;
  }

  function borner(r) {
    const width = Math.min(Math.max(r.width, min.width), largeurBureau);
    const height = Math.min(Math.max(r.height, min.height), hauteurBureau);
    const x = Math.min(Math.max(r.x, bureau.gauche), bureau.droite - width);
    const y = Math.min(Math.max(r.y, bureau.haut), bureau.bas - height);
    return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
  }

  fenetre.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    const dir = ev.target.dataset.dir || 'deplacer';
    const depart = { px: ev.clientX, py: ev.clientY, rect: { ...rect } };
    fenetre.setPointerCapture(ev.pointerId);
    fenetre.classList.add('actif');
    const bouger = (m) => {
      const dx = (m.clientX - depart.px) / echelle;
      const dy = (m.clientY - depart.py) / echelle;
      const r = { ...depart.rect };
      if (dir === 'deplacer') { r.x += dx; r.y += dy; } else {
        if (dir.includes('e')) r.width = depart.rect.width + dx;
        if (dir.includes('s')) r.height = depart.rect.height + dy;
        if (dir.includes('w')) { const w = Math.max(min.width, depart.rect.width - dx); r.x = depart.rect.x + (depart.rect.width - w); r.width = w; }
        if (dir.includes('n')) { const hh = Math.max(min.height, depart.rect.height - dy); r.y = depart.rect.y + (depart.rect.height - hh); r.height = hh; }
      }
      rect = borner(r);
      peindre();
      surChangement?.(rect);
    };
    const lacher = () => {
      fenetre.removeEventListener('pointermove', bouger);
      fenetre.removeEventListener('pointerup', lacher);
      fenetre.removeEventListener('pointercancel', lacher);
      fenetre.classList.remove('actif');
      surFin?.(rect);
    };
    fenetre.addEventListener('pointermove', bouger);
    fenetre.addEventListener('pointerup', lacher);
    fenetre.addEventListener('pointercancel', lacher);
  });

  fenetre.addEventListener('keydown', (ev) => {
    const touches = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (!touches[ev.key]) return;
    ev.preventDefault();
    const pas = ev.shiftKey ? 50 : 10;
    const [dx, dy] = touches[ev.key];
    const r = { ...rect };
    if (ev.altKey) { r.width += dx * pas; r.height += dy * pas; } else { r.x += dx * pas; r.y += dy * pas; }
    rect = borner(r);
    peindre();
    surChangement?.(rect);
    surFin?.(rect);
  });

  const observateur = new ResizeObserver(disposer);
  observateur.observe(element);

  return {
    element,
    fixer(suite) { rect = borner({ ...rect, ...suite }); peindre(); return rect; },
    bornes: () => ({ ...rect }),
    detruire: () => observateur.disconnect(),
  };
}
