// Documentation intégrée (2.6.0) : sommaire (guide d'utilisation, documentation
// technique), pages Markdown mises en forme par markdown.js, recherche, et liens
// spéciaux dans les pages :
//   page:<id>[#ancre]     autre page de la documentation
//   parametres:<section>  paramètres de l'application, à la carte voulue
//   guide:                paramétrage guidé
//   https://…             navigateur du système

import {
  h,
  icone,
  bouton,
  chargerTextes,
  t,
  antiRebond,
  messageErreur,
  sommaireRepliable,
} from '../parametres/outils.js';
import { rendre } from './markdown.js';

const api = window.studies;
await chargerTextes();
api.i18n.surChangement(() => location.reload());

document.title = t('d.titreFenetre');
document.getElementById('titre').textContent = t('d.titre');
document.getElementById('sommaire').setAttribute('aria-label', t('d.sommaire'));
sommaireRepliable(document.getElementById('volet'), 'ula-doc-sommaire-replie');
const recherche = document.getElementById('recherche');
recherche.placeholder = t('d.rechercherIndice');
recherche.setAttribute('aria-label', t('d.rechercher'));

// Posée par-dessus la page des cours (2.7.0), comme les paramètres : la croix, Échap
// (une fois la recherche vidée) et un clic sur le voile la referment.
const defilement = document.getElementById('defilement');
let fermeture = false;
function fermer() {
  if (fermeture) return;
  fermeture = true;
  document.body.classList.add('fermeture');
  const reduit = matchMedia('(prefers-reduced-motion: reduce)').matches;
  setTimeout(() => api.aide.fermer(), reduit ? 0 : 130);
}
const boutonFermer = document.getElementById('fermer');
boutonFermer.append(icone('x', 20));
boutonFermer.setAttribute('aria-label', t('commun.fermer'));
boutonFermer.title = t('p.fermerAide');
boutonFermer.addEventListener('click', fermer);
document.getElementById('voile').addEventListener('click', fermer);
document.getElementById('panneau').setAttribute('aria-label', t('d.titre'));
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || e.defaultPrevented) return;
  e.preventDefault();
  fermer();
});

const boutonGuide = document.getElementById('guide');
boutonGuide.append(icone('guide', 16), t('d.guide'));
boutonGuide.addEventListener('click', () => api.aide.guide());

const nav = document.getElementById('sommaire');
const zone = document.getElementById('page');
const groupes = await api.doc.sommaire();
const ordre = groupes.flatMap((g) => g.pages.map((p) => Object.assign({ groupe: g.titre }, p)));
const ACCUEIL = ordre[0].id;

nav.replaceChildren(
  ...groupes.map((g) =>
    h(
      'section',
      {},
      h('h2', {}, g.titre),
      h(
        'ul',
        {},
        g.pages.map((p) => h('li', {}, h('a', { href: `page:${p.id}`, dataset: { page: p.id } }, p.titre))),
      ),
    ),
  ),
);

let courante = null;

async function aller(cible, { historique = true } = {}) {
  const [id, ancre] = String(cible || ACCUEIL).split('#');
  const page = ordre.find((p) => p.id === id) ? id : ACCUEIL;
  let md;
  try {
    md = (await api.doc.page(page)).markdown;
  } catch (e) {
    zone.replaceChildren(h('p', {}, messageErreur(e)));
    return;
  }
  courante = page;
  const { html, titres } = rendre(md);
  zone.innerHTML = html;
  // Page d'accueil : appel au paramétrage guidé sous le titre
  if (page === ACCUEIL) {
    const appel = h(
      'div',
      { class: 'appel-guide' },
      icone('guide', 22),
      h('div', {}, h('strong', {}, t('d.appelTitre')), h('p', {}, t('d.appelTexte'))),
      bouton(t('d.appelBouton'), { genre: 'principal', onClick: () => api.aide.guide() }),
    );
    zone.querySelector('h1')?.after(appel);
  }
  // Pages longues : « Sur cette page »
  if (titres.length >= 4) {
    const sur = h(
      'nav',
      { class: 'sur-page', 'aria-label': t('d.surPage') },
      h('strong', {}, t('d.surPage')),
      h(
        'ul',
        {},
        titres.map((x) => h('li', {}, h('a', { href: '#' + x.id }, x.texte))),
      ),
    );
    const apres = zone.querySelector('.appel-guide') || zone.querySelector('h1');
    if (apres) apres.after(sur);
    else zone.prepend(sur);
  }
  // Précédent et suivant
  const i = ordre.findIndex((p) => p.id === page);
  const lienPied = (p, classe, libelle) =>
    p ? h('a', { href: `page:${p.id}`, class: classe }, h('span', {}, libelle), p.titre) : null;
  zone.append(
    h(
      'nav',
      { class: 'pied-doc' },
      lienPied(ordre[i - 1], 'precedent', '← ' + t('commun.precedent')),
      lienPied(ordre[i + 1], 'suivant', t('commun.suivant') + ' →'),
    ),
  );

  for (const a of nav.querySelectorAll('a')) {
    const actif = a.dataset.page === page;
    a.classList.toggle('actif', actif);
    if (actif) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  if (historique) history.replaceState(null, '', '#' + page + (ancre ? '#' + ancre : ''));
  const el = ancre && document.getElementById(ancre);
  if (el) el.scrollIntoView();
  else defilement.scrollTo({ top: 0 });
  zone.focus({ preventScroll: true });
}

// Liens : dans la page, le sommaire et les résultats de recherche
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href]');
  if (!a) return;
  const href = a.getAttribute('href');
  e.preventDefault();
  if (href.startsWith('page:')) {
    recherche.value = '';
    aller(href.slice(5));
  } else if (href.startsWith('parametres:')) api.aide.parametres(href.slice(11) || undefined);
  else if (href.startsWith('guide:')) api.aide.guide();
  else if (href.startsWith('#')) document.getElementById(href.slice(1))?.scrollIntoView();
  else if (/^https:\/\//i.test(href)) api.doc.lien(href);
});

/* -- Recherche --------------------------------------------------------------------- */

function surligner(texte, mots) {
  const plat = (x) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const p = plat(texte);
  const morceaux = [];
  let i = 0;
  while (i < texte.length) {
    let trouve = null;
    for (const m of mots)
      if (m && p.startsWith(m, i)) {
        trouve = m;
        break;
      }
    if (trouve) {
      morceaux.push(h('mark', {}, texte.slice(i, i + trouve.length)));
      i += trouve.length;
    } else {
      const j = i;
      i++;
      while (i < texte.length && !mots.some((m) => m && p.startsWith(m, i))) i++;
      morceaux.push(texte.slice(j, i));
    }
  }
  return morceaux;
}

const chercher = antiRebond(async () => {
  const q = recherche.value.trim();
  if (!q) {
    aller(courante || ACCUEIL);
    return;
  }
  const resultats = await api.doc.chercher(q);
  const mots = q
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/\s+/)
    .filter((m) => m.length > 1);
  zone.replaceChildren(
    h('h1', {}, t('d.resultats', { texte: q })),
    resultats.length
      ? h(
          'ul',
          { class: 'resultats' },
          resultats.map((r) =>
            h(
              'li',
              {},
              h(
                'a',
                { href: `page:${r.id}` },
                h('strong', {}, r.titre),
                h('span', {}, r.groupe),
                h('span', {}, surligner(r.extrait, mots)),
              ),
            ),
          ),
        )
      : h('p', { class: 'discret' }, t('d.aucunResultat')),
  );
}, 200);
recherche.addEventListener('input', chercher);
recherche.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && recherche.value) {
    e.preventDefault();
    recherche.value = '';
    chercher();
  }
});
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
    e.preventDefault();
    recherche.focus();
    recherche.select();
  }
});

api.doc.surAller((page) => aller(page));
window.addEventListener('hashchange', () => aller(location.hash.slice(1), { historique: false }));
aller(location.hash.slice(1) || ACCUEIL);
