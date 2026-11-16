// Paramétrage guidé (2.6.0) : les réglages de l'application présentés un par un,
// avec une courte explication et l'endroit où les retrouver ensuite dans les
// paramètres. Chaque choix s'applique tout de suite, par les mêmes canaux que la
// page des paramètres ; « Suivant » fait en plus l'action d'une étape qui en a une
// (création du profil). Les étapes sans objet sur ce poste sont sautées (pas de
// zone de notification, dossier des données qui n'est pas un dépôt Git…).
//
// L'étape courante est gardée dans l'adresse (#langue…) : changer de langue
// recharge la page et le guide reprend au même endroit.

import { h, icone, bouton, etat, note, chargerTextes, t, messageErreur, messageCreation, libelleLieu } from '../parametres/outils.js';

const api = window.studies;
const textes = await chargerTextes();
api.i18n.surChangement(() => location.reload());
document.title = t('g.titreFenetre');

let info = await api.info();
let reglages = await api.reglages();
const enregistrer = async (partiel) => { reglages = await api.modifier(partiel); return reglages; };
let redemarrageNecessaire = sessionStorage.getItem('guide:redemarrage') === '1';
const demanderRedemarrage = () => { redemarrageNecessaire = true; sessionStorage.setItem('guide:redemarrage', '1'); };

// État partagé entre étapes (profil à créer)
const brouillon = JSON.parse(sessionStorage.getItem('guide:brouillon') || '{}');
const garderBrouillon = () => sessionStorage.setItem('guide:brouillon', JSON.stringify(brouillon));

let profils = null;
async function etatProfils(forcer) {
  if (!profils || forcer) {
    try { profils = await api.profils.etat(); } catch (e) { profils = { erreur: messageErreur(e), profils: [] }; }
  }
  return profils;
}
let synchro = null;
try { synchro = await api.synchro.statut(); } catch (e) { synchro = { visible: false }; }

/* -- Petits éléments ------------------------------------------------------------- */

const option = (nom, valeur, coche, titre, description, surChoix) => h('label', {},
  h('input', { type: 'radio', name: nom, value: valeur, checked: coche, onChange: surChoix }),
  h('span', {}, h('strong', {}, titre), description ? h('span', {}, description) : null));

// « Plus tard : Paramètres › Échelle » (lien vers la carte des paramètres)
const ou = (section, cleNav) => h('p', { class: 'ou' }, icone('info', 14),
  h('span', {}, t('g.ou') + ' ', h('a', { onClick: () => api.aide.parametres(section) }, `${t('p.titre')} › ${t(cleNav)}`)));

/* -- Étapes ------------------------------------------------------------------------ */

const ETAPES = [
  {
    id: 'bienvenue', icone: 'guide',
    contenu: () => [
      h('p', {}, t('g.bienvenue.texte')),
      h('ul', { class: 'bienvenue-liste' }, ETAPES.filter((e) => e.id !== 'bienvenue' && e.id !== 'fin' && visible(e)).map((e) => h('li', {}, t(`g.${e.id}.titre`)))),
      h('p', { class: 'aide' }, t('g.bienvenue.aide'))
    ]
  },
  {
    id: 'langue', icone: 'langue', section: ['langue', 'p.nav.langue'],
    contenu: () => [h('div', { class: 'choix' }, textes.langues.map((l) => option('langue', l.code, l.code === textes.langue, l.nom,
      l.code === 'fr' ? 'Interface en français' : 'English interface', () => api.i18n.definir(l.code))))]
  },
  {
    id: 'profil', icone: 'menu', section: ['profil', 'p.nav.profil'],
    async contenu() {
      const e = await etatProfils();
      if (e.erreur) return [etat('erreur', e.erreur), h('p', { class: 'aide' }, t('g.profil.serveur'))];
      if (!e.profils.length) {
        if (brouillon.nom === undefined) brouillon.nom = e.session || '';
        const champ = h('input', { class: 'saisie', type: 'text', value: brouillon.nom, placeholder: e.session, spellcheck: 'false',
          onInput: (ev) => { brouillon.nom = ev.target.value; garderBrouillon(); } });
        return [h('label', { class: 'champ' }, h('span', {}, t('g.profil.nom')), champ), h('p', { class: 'aide' }, t('g.profil.nomAide'))];
      }
      return [
        h('div', { class: 'choix' }, e.profils.map((p) => option('profil', p.nom, p.nom === e.profil, p.nom,
          p.nom === e.profil ? t('g.profil.actif') : null, async () => {
            try { await api.profils.choisir(p.nom); await etatProfils(true); note(t('g.profil.noteChoisi', { nom: p.nom })); }
            catch (err) { note(messageErreur(err), { erreur: true }); }
          }))),
        h('p', { class: 'aide' }, t('g.profil.existant'))
      ];
    }
  },
  {
    // Seulement s'il n'y a pas encore de profil : le cursus exemple accompagne sa création.
    // L'étape reste dans la liste une fois le profil créé par le guide (compteur stable,
    // retour en arrière possible) et montre alors ce qui a été fait.
    id: 'cursus', icone: 'livre', section: ['profil', 'p.nav.profil'],
    visible: () => Boolean(brouillon.profilCree) || (profils && !profils.erreur && !profils.profils.length),
    async contenu() {
      if (brouillon.profilCree) return [etat('ok', brouillon.profilCree)];
      const liste = await api.profils.cursus().catch(() => []);
      if (brouillon.cursus === undefined) brouillon.cursus = liste[0] ? liste[0].id : '';
      if (brouillon.telecharger === undefined) brouillon.telecharger = true;
      const choix = h('div', { class: 'choix' },
        ...liste.map((c) => option('cursus', c.id, brouillon.cursus === c.id, c.titre, t('g.cursus.nombre', { n: c.nombre }) + (c.description ? ' · ' + c.description : ''),
          () => { brouillon.cursus = c.id; garderBrouillon(); })),
        option('cursus', '', brouillon.cursus === '', t('g.cursus.aucun'), t('g.cursus.aucunAide'), () => { brouillon.cursus = ''; garderBrouillon(); }));
      const caseTelecharger = h('input', { type: 'checkbox', checked: brouillon.telecharger, onChange: (ev) => { brouillon.telecharger = ev.target.checked; garderBrouillon(); } });
      return [
        liste.length ? null : etat('alerte', t('g.cursus.horsLigne')),
        choix,
        h('label', { class: 'interrupteur' }, caseTelecharger, h('span', {}, h('strong', {}, t('p.profil.telecharger')), h('br'), h('span', { class: 'aide' }, t('g.cursus.telechargerAide'))))
      ];
    },
    // Création du profil en quittant l'étape vers l'avant
    async valider() {
      if (brouillon.profilCree) return;
      const e = await etatProfils();
      const r = await api.profils.creer((brouillon.nom || '').trim() || e.session, brouillon.cursus || null, brouillon.telecharger !== false);
      brouillon.profilCree = messageCreation(r);
      garderBrouillon();
      note(brouillon.profilCree, { duree: 8000, erreur: Boolean(r.cursusExemple && r.cursusExemple.erreur) });
      await etatProfils(true);
    }
  },
  {
    id: 'claude', icone: 'claude', section: ['claude', 'p.nav.claude'],
    async contenu() {
      const zone = h('div', { class: 'pile' }, etat('', t('p.claude.verification')));
      const peindre = async () => {
        let s;
        try { s = await api.claude.statut(); } catch (e) { zone.replaceChildren(etat('erreur', messageErreur(e))); return; }
        const blocs = [];
        if (!s.claudeCode) {
          blocs.push(etat('alerte', t('g.claude.absent')),
            h('div', { class: 'ligne' }, bouton(t('p.claude.installer'), { genre: 'principal', onClick: () => api.claude.lien('installation') }), bouton(t('p.claude.reverifier'), { genre: 'leger', onClick: peindre })));
        } else if (reglages.claude.mode === 'compte') {
          const c = s.compte || {};
          blocs.push(c.connecte ? etat('ok', c.email ? t('g.claude.connecte', { compte: c.email }) : t('g.claude.connecteSimple')) : etat('alerte', t('p.claude.deconnecte')),
            h('div', { class: 'ligne' },
              c.connecte ? null : bouton(t('p.claude.seConnecter'), { genre: 'principal', onClick: async () => {
                try { await api.claude.connecter(); note(t('p.claude.noteTerminal'), { duree: 8000 }); } catch (e) { note(messageErreur(e), { erreur: true }); }
              } }),
              bouton(t('p.claude.verifier'), { genre: 'leger', onClick: peindre })));
        } else {
          const saisie = h('input', { class: 'saisie', type: 'password', placeholder: 'sk-ant-…', autocomplete: 'off', spellcheck: false });
          blocs.push(s.cleEnregistree && s.cleLisible ? etat('ok', t('g.claude.cleOk')) : etat('alerte', t('p.claude.cleAucune')),
            h('label', { class: 'champ' }, h('span', {}, t('p.claude.cleLibelle')), saisie),
            h('div', { class: 'ligne' }, bouton(t('p.claude.enregistrerCle'), { genre: 'principal', desactive: !s.chiffrementDisponible, onClick: async () => {
              const v = saisie.value.trim();
              if (!v) { note(t('p.claude.collerCle'), { erreur: true }); return; }
              try { await api.claude.enregistrerCle(v); note(t('p.claude.cleEnregistree')); demanderRedemarrage(); peindre(); }
              catch (e) { note(messageErreur(e), { erreur: true, duree: 6000 }); }
            } }), h('a', { href: '#', onClick: (e) => { e.preventDefault(); api.claude.lien('cles'); } }, t('p.claude.creerCle'))));
        }
        zone.replaceChildren(...blocs.filter(Boolean));
      };
      const choisir = (mode) => async () => { await enregistrer({ claude: { mode } }); demanderRedemarrage(); peindre(); };
      peindre();
      return [
        h('div', { class: 'choix' },
          option('claude', 'compte', reglages.claude.mode === 'compte', t('p.claude.modeCompte'), t('p.claude.modeCompteAide'), choisir('compte')),
          option('claude', 'cle', reglages.claude.mode === 'cle', t('p.claude.modeCle'), t('p.claude.modeCleAide'), choisir('cle'))),
        zone,
        h('p', { class: 'aide' }, t('g.claude.facultatif'))
      ];
    }
  },
  {
    id: 'echelle', icone: 'echelle', section: ['affichage', 'p.nav.echelle'],
    contenu() {
      const actuelle = (reglages.affichage && reglages.affichage.echelle) || 0;
      const options = [h('option', { value: '0' }, t('p.echelle.auto'))];
      for (let p = 50; p <= 200; p += 10) options.push(h('option', { value: String(p) }, `${p} %`));
      const choix = h('select', { class: 'saisie', onChange: (e) => enregistrer({ affichage: { echelle: Number(e.target.value) } }) }, ...options);
      choix.value = String(actuelle);
      choix.style.maxWidth = '16rem';
      return [h('label', { class: 'champ' }, h('span', {}, t('p.echelle.libelle')), choix), h('p', { class: 'aide' }, t('g.echelle.aide'))];
    }
  },
  {
    id: 'fenetre', icone: 'ecran', section: ['fenetre', 'p.nav.fenetre'],
    contenu() {
      return [h('div', { class: 'choix' },
        option('fenetre', 'agrandie', reglages.fenetre.mode === 'agrandie', t('p.fenetre.agrandie'), t('g.fenetre.agrandieAide'), () => enregistrer({ fenetre: { mode: 'agrandie' } })),
        option('fenetre', 'personnalisee', reglages.fenetre.mode === 'personnalisee', t('g.fenetre.actuelle'), t('g.fenetre.actuelleAide'), async () => {
          const b = await api.bornesActuelles();
          await enregistrer({ fenetre: b ? { mode: 'personnalisee', bornes: b } : { mode: 'personnalisee' } });
          note(t('p.fenetre.noteReprise'));
        }))];
    }
  },
  {
    id: 'arriere', icone: 'arriere', section: ['arriere-plan', 'p.nav.arriere'],
    visible: () => info.zoneNotification,
    contenu() {
      const actif = !reglages.arrierePlan || reglages.arrierePlan.fermeture !== false;
      return [h('div', { class: 'choix' },
        option('arriere', 'garder', actif, t('g.arriere.garder'), t('g.arriere.garderAide'), () => enregistrer({ arrierePlan: { fermeture: true } })),
        option('arriere', 'quitter', !actif, t('g.arriere.quitter'), t('g.arriere.quitterAide'), () => enregistrer({ arrierePlan: { fermeture: false } })))];
    }
  },
  {
    id: 'maj', icone: 'maj', section: ['mises-a-jour', 'p.nav.maj'],
    contenu() {
      return [h('div', { class: 'choix' },
        option('maj', 'auto', reglages.miseAJourAuto !== false, t('g.maj.auto'), t('g.maj.autoAide'), () => enregistrer({ miseAJourAuto: true })),
        option('maj', 'manuel', reglages.miseAJourAuto === false, t('g.maj.manuel'), t('g.maj.manuelAide'), () => enregistrer({ miseAJourAuto: false }))),
        info.installee ? null : h('p', { class: 'aide' }, t('g.maj.dev'))];
    }
  },
  {
    id: 'raccourcis', icone: 'raccourci', section: ['raccourcis', 'p.nav.raccourcis'],
    async contenu() {
      const zone = h('div', { class: 'lieux' }, h('p', { class: 'aide' }, t('p.racc.recherche')));
      const peindre = async () => {
        let s;
        try { s = await api.raccourcis.statut(); } catch (e) { zone.replaceChildren(etat('erreur', messageErreur(e))); return; }
        if (!s.supported) { zone.replaceChildren(h('p', { class: 'aide' }, t('p.racc.nonPris'))); return; }
        zone.replaceChildren(...s.locations.filter((l) => !l.choisi).map((l) => {
          const present = l.status === 'ok' || l.status === 'other-name';
          const action = l.action === 'create' || l.action === 'repair';
          return h('div', { class: 'lieu' + (present ? ' ok' : '') },
            icone(present ? 'ok' : l.id === 'bureau' ? 'ecran' : 'menu', 18),
            h('div', { class: 'texte' }, h('strong', {}, libelleLieu(l, info)), h('span', {}, present ? t('g.raccourcis.present') : l.status === 'none' || !l.status ? t('g.raccourcis.absent') : t('g.raccourcis.aReparer'))),
            action ? bouton(t(l.action === 'repair' ? 'p.racc.reparer' : 'g.raccourcis.creer'), { genre: 'principal', onClick: async () => {
              try { await api.raccourcis.creer(l.id); note(t('p.racc.cree', { libelle: libelleLieu(l, info) })); }
              catch (e) { note(t('p.racc.erreur', { message: messageErreur(e) }), { erreur: true }); }
              peindre();
            } }) : null);
        }));
      };
      peindre();
      return [zone, h('p', { class: 'aide' }, t('g.raccourcis.aide'))];
    }
  },
  {
    id: 'donnees', icone: 'dossier', section: ['donnees', 'p.nav.donnees'],
    contenu() {
      const actuel = h('code', {}, info.racine || '—');
      return [
        h('p', {}, t('p.donnees.actuel') + ' ', actuel),
        h('div', { class: 'ligne' },
          bouton(t('p.donnees.choisir'), { onClick: async () => {
            const r = await api.donnees.choisir();
            if (!r.ok) return;
            actuel.textContent = r.dossier;
            note(t(r.depot ? 'p.donnees.noteDepot' : 'p.donnees.noteChoisi'));
            demanderRedemarrage();
          } }),
          info.racine !== info.dossierParDefaut ? bouton(t('p.donnees.defaut'), { genre: 'leger', onClick: async () => {
            const r = await api.donnees.defaut();
            actuel.textContent = r.dossier;
            demanderRedemarrage();
          } }) : null),
        h('p', { class: 'aide' }, t('g.donnees.aide'))
      ];
    }
  },
  {
    id: 'synchro', icone: 'nuage', section: ['synchro', 'p.nav.synchro'],
    visible: () => synchro && synchro.visible,
    contenu() {
      return [
        h('p', {}, t('p.synchro.depot') + ' ', h('code', {}, synchro.adresse || synchro.distant)),
        h('div', { class: 'choix' },
          option('synchro', 'oui', synchro.auto === true, t('g.synchro.oui'), t('p.synchro.autoAide'), async () => { synchro = await api.synchro.auto(true); }),
          option('synchro', 'non', synchro.auto !== true, t('g.synchro.non'), t('g.synchro.nonAide'), async () => { synchro = await api.synchro.auto(false); }))
      ];
    }
  },
  {
    id: 'fin', icone: 'ok',
    async contenu() {
      reglages = await api.reglages();
      const e = await etatProfils(true);
      const ligne = (cle, valeur) => h('li', {}, h('span', {}, t(cle)), h('span', {}, valeur));
      const echelle = (reglages.affichage && reglages.affichage.echelle) || 0;
      const lignes = [
        ligne('p.nav.langue', (textes.langues.find((l) => l.code === textes.langue) || {}).nom),
        ligne('p.nav.profil', e.profil || '—'),
        ligne('p.nav.claude', t(reglages.claude.mode === 'cle' ? 'p.claude.modeCle' : 'p.claude.modeCompte')),
        ligne('p.nav.echelle', echelle ? `${echelle} %` : t('p.echelle.auto')),
        ligne('p.nav.fenetre', t(reglages.fenetre.mode === 'personnalisee' ? 'g.fenetre.actuelle' : 'p.fenetre.agrandie')),
        info.zoneNotification ? ligne('p.nav.arriere', t(reglages.arrierePlan.fermeture !== false ? 'g.arriere.garder' : 'g.arriere.quitter')) : null,
        ligne('p.nav.maj', t(reglages.miseAJourAuto !== false ? 'g.maj.auto' : 'g.maj.manuel')),
        ligne('p.nav.donnees', (reglages.donnees && reglages.donnees.dossier) || info.dossierParDefaut),
        synchro && synchro.visible ? ligne('p.nav.synchro', t(synchro.auto === true ? 'g.synchro.oui' : 'g.synchro.non')) : null
      ];
      return [
        h('ul', { class: 'recap' }, lignes),
        redemarrageNecessaire ? etat('alerte', t('p.redemarrage.texte')) : null,
        h('div', { class: 'ligne' },
          redemarrageNecessaire ? bouton(t('p.redemarrage.maintenant'), { genre: 'principal', onClick: () => api.redemarrer() }) : null,
          bouton(t('g.fin.parametres'), { onClick: () => api.aide.parametres() }),
          bouton(t('g.fin.documentation'), { genre: 'leger', onClick: () => api.aide.documentation() }))
      ];
    }
  }
];

function visible(e) { return !e.visible || e.visible(); }

/* -- Navigation ---------------------------------------------------------------------- */

const zone = document.getElementById('etape');
const compteur = document.getElementById('compteur');
const barre = document.getElementById('barre');
const precedent = document.getElementById('precedent');
const suivant = document.getElementById('suivant');
const quitter = document.getElementById('quitter');
precedent.textContent = '← ' + t('commun.precedent');
quitter.textContent = t('g.quitter');
quitter.addEventListener('click', () => api.aide.fermer());

await etatProfils();
const visibles = () => ETAPES.filter(visible);
let courante = visibles().find((e) => e.id === location.hash.slice(1)) || ETAPES[0];
let occupe = false;

async function afficher(etape) {
  courante = etape;
  history.replaceState(null, '', '#' + etape.id);
  const liste = visibles();
  const i = liste.indexOf(etape);
  const total = liste.length;
  compteur.textContent = etape.id === 'bienvenue' ? t('g.compteurDebut', { n: total - 2 }) : etape.id === 'fin' ? t('g.compteurFin') : t('g.compteur', { i, n: total - 2 });
  barre.style.width = `${Math.round((i / (total - 1)) * 100)}%`;
  precedent.hidden = i === 0;
  suivant.textContent = etape.id === 'bienvenue' ? t('g.commencer') : etape.id === 'fin' ? t('commun.terminer') : t('commun.suivant') + ' →';
  quitter.hidden = etape.id === 'fin';
  let contenu;
  try { contenu = await etape.contenu(); } catch (e) { contenu = [etat('erreur', messageErreur(e))]; }
  if (courante !== etape) return;
  zone.replaceChildren(
    h('div', { class: 'etape-tete' }, icone(etape.icone, 24),
      h('div', {}, h('h1', {}, t(`g.${etape.id}.titre`)), h('p', {}, t(`g.${etape.id}.explication`)))),
    ...[contenu].flat().filter((x) => x != null && x !== false),
    ...(etape.section ? [ou(...etape.section)] : []));
  zone.scrollTop = 0;
  zone.focus({ preventScroll: true });
}

async function avancer(pas) {
  if (occupe) return;
  occupe = true;
  suivant.disabled = precedent.disabled = true;
  try {
    if (pas > 0 && courante.valider) await courante.valider();
    if (pas > 0 && courante.id === 'fin') { api.aide.fermer(); return; }
    // Étape visible suivante (ou précédente) dans l'ordre du guide : la liste des
    // étapes visibles peut avoir changé pendant valider()
    const pos = ETAPES.indexOf(courante);
    const cible = pas > 0
      ? ETAPES.slice(pos + 1).find(visible) || courante
      : ETAPES.slice(0, pos).reverse().find(visible) || ETAPES[0];
    await afficher(cible);
  } catch (e) {
    note(messageErreur(e), { erreur: true, duree: 7000 });
  } finally {
    occupe = false;
    suivant.disabled = precedent.disabled = false;
  }
}

suivant.addEventListener('click', () => avancer(1));
precedent.addEventListener('click', () => avancer(-1));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') api.aide.fermer();
  // Entrée hors d'un champ de saisie : étape suivante
  if (e.key === 'Enter' && !e.target.closest('input[type=text], input[type=password], textarea, button, a, select')) avancer(1);
});
afficher(courante);
