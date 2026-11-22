// Page des paramètres de l'application installée : langue, aide, mises à jour,
// échelle, arrière-plan, fenêtre au lancement, raccourcis, connexion à Claude,
// modèles, profils, dossier des données, synchronisation, à propos.
// Textes : dictionnaires de src/i18n (clés « p. »), chargés avant tout.

import {
  h,
  icone,
  bouton,
  carte,
  etat,
  note,
  confirmer,
  antiRebond,
  messageErreur,
  chargerTextes,
  t,
  tn,
  locale,
  messageCreation,
  libelleLieu,
} from './outils.js';
import { creerCadre } from './cadre-fenetre.js';

const api = window.studies;
const MIN = { width: 640, height: 480 };

const textes = await chargerTextes();
let info = await api.info();
let reglages = await api.reglages();

async function enregistrer(partiel) {
  reglages = await api.modifier(partiel);
  return reglages;
}

document.title = t('p.titreFenetre');
document.getElementById('titre').textContent = t('p.titre');
document.getElementById('sous-titre').textContent =
  `Universal Learn Academy ${info.version}${info.installee ? '' : ' ' + t('p.developpement')} · Electron ${info.electron}`;
// Changement de langue (ici, dans le paramétrage guidé ou ailleurs) : la page se refait
api.i18n.surChangement(() => location.reload());

/* -- Ouverture dans la fenêtre des cours (2.6.2) ------------------------------------ */

// Les paramètres sont posés par-dessus la page des cours : la croix, Échap (sauf
// pendant une confirmation, qui se ferme d'abord) et un clic sur le voile les referment.
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
document.getElementById('panneau').setAttribute('aria-label', t('p.titre'));
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || e.defaultPrevented || document.querySelector('dialog[open]')) return;
  e.preventDefault();
  fermer();
});

/* -- Langue ------------------------------------------------------------------- */

function carteLangue() {
  const option = (l) =>
    h(
      'label',
      {},
      h('input', {
        type: 'radio',
        name: 'langue',
        value: l.code,
        checked: l.code === textes.langue,
        onChange: async () => {
          await api.i18n.definir(l.code);
        },
      }),
      h(
        'span',
        {},
        h('strong', { lang: l.code }, l.nom),
        h('span', { lang: l.code }, l.code === 'fr' ? 'Interface en français' : 'English interface'),
      ),
    );
  return carte(
    'langue',
    'langue',
    t('p.langue.titre'),
    t('p.langue.description'),
    h('div', { class: 'choix' }, ...textes.langues.map(option)),
    h('p', { class: 'aide' }, t('p.langue.aide')),
  );
}

/* -- Aide : documentation et paramétrage guidé ----------------------------------- */

function carteAide() {
  return carte(
    'aide',
    'aide',
    t('p.aide.titre'),
    t('p.aide.description'),
    h(
      'div',
      { class: 'ligne' },
      bouton(t('p.aide.guide'), { genre: 'principal', onClick: () => api.aide.guide() }),
      bouton(t('p.aide.documentation'), { onClick: () => api.aide.documentation() }),
    ),
    h('p', { class: 'aide' }, t('p.aide.raccourci')),
  );
}

/* -- Mises à jour ------------------------------------------------------------ */

export function decrireMaj(s) {
  switch (s && s.etat) {
    case 'recherche':
      return ['', t('p.maj.recherche')];
    case 'disponible':
      return ['', t('p.maj.disponible', { version: s.version })];
    case 'telechargement':
      return ['', t('p.maj.telechargement', { pourcent: s.pourcent ?? 0 })];
    case 'pret':
      return ['ok', t('p.maj.pret', { version: s.version })];
    case 'a-jour':
      return ['ok', t(s.viaGh ? 'p.maj.aJourGh' : 'p.maj.aJour')];
    case 'indisponible':
      return ['', s.message];
    case 'erreur':
      return ['erreur', t('p.maj.erreur', { message: s.message })];
    default:
      return ['', t('p.maj.jamais')];
  }
}

// « 6 heures », « 20 minutes »
function duree(ms) {
  const heures = ms / 3600000;
  if (heures >= 1) return tn('commun.heures', Math.round(heures));
  return tn('commun.minutes', Math.max(1, Math.round(ms / 60000)));
}

function carteMisesAJour() {
  const zone = h('div', {});
  const installer = bouton(t('p.maj.installer'), { genre: 'principal', onClick: () => api.maj.installer() });
  const peindre = (s) => {
    const [genre, texte] = decrireMaj(s);
    zone.replaceChildren(etat(genre, texte));
    installer.hidden = !s || s.etat !== 'pret';
  };
  api.maj.statut().then(peindre);
  api.maj.surStatut(peindre);

  const auto = h('input', {
    type: 'checkbox',
    checked: reglages.miseAJourAuto,
    onChange: async (e) => {
      await enregistrer({ miseAJourAuto: e.target.checked });
      note(t(e.target.checked ? 'p.maj.noteActive' : 'p.maj.noteDesactive'));
    },
  });

  return carte(
    'mises-a-jour',
    'maj',
    t('p.maj.titre'),
    t('p.maj.description', { version: info.version }),
    h(
      'label',
      { class: 'interrupteur' },
      auto,
      h(
        'span',
        {},
        h('strong', {}, t('p.maj.auto')),
        h('br'),
        h('span', { class: 'aide' }, t('p.maj.autoAide', { duree: duree(info.intervalleMaj || 21600000) })),
      ),
    ),
    h(
      'div',
      { class: 'ligne' },
      bouton(t('p.maj.rechercher'), { onClick: () => api.maj.verifier() }),
      installer,
      bouton(t('p.maj.versions'), { genre: 'leger', onClick: () => api.ouvrirReleases() }),
    ),
    zone,
    h('p', { class: 'aide' }, t('p.maj.aide')),
  );
}

/* -- Fenêtre au lancement ------------------------------------------------------- */

function carteFenetre() {
  const hote = h('div', {});
  const champs = {};
  let cadre = null;

  const garder = antiRebond((bornes) => enregistrer({ fenetre: { mode: 'personnalisee', bornes } }), 250);
  const synchroniser = (b) => {
    for (const k of ['width', 'height', 'x', 'y']) if (document.activeElement !== champs[k]) champs[k].value = b[k];
  };

  const champ = (cle, libelle) => {
    champs[cle] = h('input', {
      class: 'saisie',
      type: 'number',
      step: 1,
      value: reglages.fenetre.bornes[cle],
      onInput: (e) => {
        const v = Number.parseInt(e.target.value, 10);
        if (!Number.isFinite(v) || !cadre) return;
        garder(cadre.fixer({ [cle]: v }));
      },
      onBlur: () => cadre && synchroniser(cadre.bornes()),
    });
    return h('label', { class: 'champ' }, h('span', {}, libelle + ' (px)'), champs[cle]);
  };

  const perso = h(
    'div',
    { class: 'carte-perso' },
    h('p', { class: 'aide' }, t('p.fenetre.cadreAide')),
    hote,
    h(
      'div',
      { class: 'grille-4' },
      champ('width', t('p.fenetre.largeur')),
      champ('height', t('p.fenetre.hauteur')),
      champ('x', t('p.fenetre.x')),
      champ('y', t('p.fenetre.y')),
    ),
    h(
      'div',
      { class: 'ligne' },
      bouton(t('p.fenetre.reprendre'), {
        onClick: async () => {
          const b = await api.bornesActuelles();
          if (!b || !cadre) return;
          const r = cadre.fixer(b);
          synchroniser(r);
          await enregistrer({ fenetre: { mode: 'personnalisee', bornes: r } });
          note(t('p.fenetre.noteReprise'));
        },
      }),
    ),
  );

  async function preparerCadre() {
    if (cadre) return;
    cadre = creerCadre({
      ecrans: await api.ecrans(),
      bornes: reglages.fenetre.bornes,
      min: MIN,
      surChangement: synchroniser,
      surFin: garder,
    });
    hote.replaceChildren(cadre.element);
    synchroniser(cadre.bornes());
  }

  const option = (valeur, titre, description) =>
    h(
      'label',
      {},
      h('input', {
        type: 'radio',
        name: 'fenetre',
        value: valeur,
        checked: reglages.fenetre.mode === valeur,
        onChange: async () => {
          await enregistrer({ fenetre: { mode: valeur } });
          perso.hidden = valeur !== 'personnalisee';
          if (valeur === 'personnalisee') preparerCadre();
          note(t('p.fenetre.noteProchain'));
        },
      }),
      h('span', {}, h('strong', {}, titre), h('span', {}, description)),
    );

  perso.hidden = reglages.fenetre.mode !== 'personnalisee';
  if (!perso.hidden) preparerCadre();

  return carte(
    'fenetre',
    'ecran',
    t('p.fenetre.titre'),
    t('p.fenetre.description'),
    h(
      'div',
      { class: 'choix' },
      option('agrandie', t('p.fenetre.agrandie'), t('p.fenetre.agrandieAide')),
      option('personnalisee', t('p.fenetre.perso'), t('p.fenetre.persoAide')),
    ),
    perso,
  );
}

/* -- Arrière-plan (fermeture de la fenêtre) -------------------------------------- */

function carteArrierePlan() {
  const actif = !reglages.arrierePlan || reglages.arrierePlan.fermeture !== false;
  const caseFermeture = h('input', {
    type: 'checkbox',
    checked: actif,
    disabled: !info.zoneNotification,
    onChange: async (e) => {
      await enregistrer({ arrierePlan: { fermeture: e.target.checked } });
      note(t(e.target.checked ? 'p.arriere.noteGarde' : 'p.arriere.noteQuitte'));
    },
  });
  return carte(
    'arriere-plan',
    'arriere',
    t('p.arriere.titre'),
    t('p.arriere.description'),
    h(
      'label',
      { class: 'interrupteur' },
      caseFermeture,
      h('span', {}, h('strong', {}, t('p.arriere.garder')), h('br'), h('span', { class: 'aide' }, t('p.arriere.aide'))),
    ),
    info.zoneNotification ? null : etat('alerte', t('p.arriere.sansZone')),
  );
}

/* -- Échelle de l'interface ------------------------------------------------------ */

function carteAffichage() {
  const actuelle = (reglages.affichage && reglages.affichage.echelle) || 0;
  const options = [h('option', { value: '0' }, t('p.echelle.auto'))];
  for (let p = 50; p <= 200; p += 10) options.push(h('option', { value: String(p) }, `${p} %`));
  const choix = h(
    'select',
    {
      class: 'saisie',
      id: 'echelle',
      onChange: async (e) => {
        const r = await enregistrer({ affichage: { echelle: Number(e.target.value) } });
        const v = (r.affichage && r.affichage.echelle) || 0;
        note(v ? t('p.echelle.note', { v }) : t('p.echelle.noteAuto'));
      },
    },
    ...options,
  );
  choix.value = String(actuelle);
  return carte(
    'affichage',
    'echelle',
    t('p.echelle.titre'),
    t('p.echelle.description'),
    h('label', { class: 'champ' }, h('span', {}, t('p.echelle.libelle')), choix),
    h('p', { class: 'aide' }, t('p.echelle.aide')),
  );
}

/* -- Raccourcis ------------------------------------------------------------------ */

export function decrireRaccourci(l) {
  const nom = t('commun.guillemets', { texte: l.name || l.fichier });
  const cible = l.currentTarget ? ` (${l.currentTarget})` : '';
  switch (l.status) {
    case 'ok':
      return ['ok', t('p.racc.ok', { nom })];
    case 'other-name':
      return ['ok', t('p.racc.autreNom', { nom })];
    case 'outdated':
      return ['alerte', t('p.racc.ancien', { nom, cible })];
    case 'broken':
      return ['alerte', t('p.racc.casse', { nom, cible })];
    case 'foreign':
      return ['alerte', l.currentTarget ? t('p.racc.etranger', { nom, cible }) : t('p.racc.illisible', { nom })];
    default:
      return ['', l.dirExiste === false ? t('p.racc.dossierAbsent') : t('p.racc.aucun')];
  }
}

function resultatRaccourci(r, libelle) {
  switch (r.outcome) {
    case 'created':
      return t('p.racc.cree', { libelle });
    case 'repaired':
      return t('p.racc.repare', { libelle });
    case 'replaced':
      return t('p.racc.remplace', { libelle });
    case 'already':
      return t('p.racc.deja', { libelle, nom: r.location.name });
    case 'removed':
      return t('p.racc.supprime', { libelle });
    case 'missing':
      return t('p.racc.manquant', { libelle });
    default:
      return t('p.racc.impossible', { libelle });
  }
}

function carteRaccourcis() {
  const liste = h('div', { class: 'raccourcis' }, h('p', { class: 'aide' }, t('p.racc.recherche')));
  const pied = h('p', { class: 'aide' });
  let occupe = false;

  async function executer(l, genre) {
    if (occupe) return;
    occupe = true;
    const libelle = libelleLieu(l, info);
    try {
      let r;
      if (genre === 'supprimer') {
        if (
          !(await confirmer({
            titre: t('p.racc.supprimerTitre'),
            message: t('p.racc.supprimerTexte', { nom: l.name, libelle }),
            valider: t('commun.supprimer'),
            danger: true,
          }))
        )
          return;
        r = await api.raccourcis.supprimer(l.id);
      } else {
        r = await api.raccourcis.creer(l.id);
        if (r.outcome === 'conflict') {
          if (
            !(await confirmer({
              titre: t('p.racc.remplacerTitre'),
              message: `${decrireRaccourci(r.location)[1]} ${t('p.racc.remplacerTexte')}`,
              valider: t('p.racc.remplacer'),
              danger: true,
            }))
          ) {
            note(t('p.racc.conserve'));
            return;
          }
          r = await api.raccourcis.creer(l.id, { confirmReplace: true });
        }
      }
      note(resultatRaccourci(r, libelle), { duree: 5000 });
    } catch (e) {
      note(t('p.racc.erreur', { message: messageErreur(e) }), { erreur: true, duree: 6000 });
    } finally {
      occupe = false;
      actualiser();
    }
  }

  function ligne(l) {
    const [genre, texte] = decrireRaccourci(l);
    const actions = [];
    if (l.action === 'create')
      actions.push(bouton(t('p.racc.creer'), { genre: 'principal', onClick: () => executer(l, 'creer') }));
    if (l.action === 'repair')
      actions.push(bouton(t('p.racc.reparer'), { genre: 'principal', onClick: () => executer(l, 'creer') }));
    if (l.action === 'replace')
      actions.push(bouton(t('p.racc.remplacer') + '…', { onClick: () => executer(l, 'creer') }));
    if (l.file || l.dirExiste)
      actions.push(
        bouton(t('p.racc.afficher'), {
          genre: 'leger',
          titre: t('p.racc.afficherTitre'),
          onClick: () => api.raccourcis.afficher(l.id),
        }),
      );
    if (l.removable)
      actions.push(bouton(t('commun.supprimer'), { genre: 'discret-danger', onClick: () => executer(l, 'supprimer') }));
    if (l.choisi)
      actions.push(
        bouton(t('p.racc.oublier'), {
          genre: 'leger',
          titre: t('p.racc.oublierTitre'),
          onClick: async () => {
            await api.raccourcis.oublier(l.id);
            actualiser();
          },
        }),
      );
    const autres =
      l.others && l.others.length
        ? h(
            'span',
            { class: 'aide' },
            t('p.racc.autres', { liste: l.others.map((n) => t('commun.guillemets', { texte: n })).join(', ') }),
          )
        : null;
    return h(
      'div',
      { class: `raccourci ${genre}`.trim() },
      icone(l.id === 'bureau' ? 'ecran' : l.id === 'menu' ? 'menu' : 'dossier', 18),
      h(
        'div',
        { class: 'texte' },
        h('strong', {}, libelleLieu(l, info)),
        h('span', {}, texte),
        autres,
        h('span', { class: 'chemin', title: l.dir }, l.dir),
      ),
      h('div', { class: 'ligne' }, actions),
    );
  }

  async function actualiser() {
    try {
      const s = await api.raccourcis.statut();
      if (!s.supported) {
        liste.replaceChildren(h('p', { class: 'aide' }, t('p.racc.nonPris')));
        return;
      }
      liste.replaceChildren(...s.locations.map(ligne));
      pied.textContent = !s.packaged
        ? t('p.racc.piedDev')
        : s.plateforme === 'win32'
          ? t('p.racc.piedWindows')
          : s.appImage
            ? t('p.racc.piedAppImage')
            : '';
    } catch (e) {
      liste.replaceChildren(etat('erreur', t('p.racc.lecture', { message: messageErreur(e) })));
    }
  }

  window.addEventListener('focus', () => {
    if (!occupe) actualiser();
  });
  actualiser();

  return carte(
    'raccourcis',
    'raccourci',
    t('p.racc.titre'),
    t('p.racc.description'),
    liste,
    h(
      'div',
      { class: 'ligne' },
      bouton(t('p.racc.autreDossier'), {
        onClick: async () => {
          if (occupe) return;
          occupe = true;
          try {
            const r = await api.raccourcis.choisir();
            if (r.outcome !== 'canceled')
              note(resultatRaccourci(r, r.location ? r.location.label : t('p.racc.dossierChoisi')), { duree: 5000 });
          } catch (e) {
            note(t('p.racc.erreur', { message: messageErreur(e) }), { erreur: true, duree: 6000 });
          } finally {
            occupe = false;
            actualiser();
          }
        },
      }),
      bouton(t('commun.actualiser'), { genre: 'leger', onClick: actualiser }),
    ),
    pied,
  );
}

/* -- Claude ------------------------------------------------------------------------- */

function carteClaude() {
  const zoneEtat = h('div', { class: 'choix-etat' });
  const zoneCle = h('div', {});
  let statut = null;

  const saisie = h('input', {
    class: 'saisie',
    type: 'password',
    placeholder: 'sk-ant-…',
    autocomplete: 'off',
    spellcheck: false,
  });

  function peindre() {
    const s = statut;
    const blocs = [];
    if (!s.claudeCode) {
      blocs.push(
        etat('alerte', t('p.claude.absent')),
        h(
          'div',
          { class: 'ligne' },
          bouton(t('p.claude.installer'), { genre: 'principal', onClick: () => api.claude.lien('installation') }),
          bouton(t('p.claude.reverifier'), { genre: 'leger', onClick: actualiser }),
        ),
      );
    } else {
      blocs.push(
        h(
          'p',
          { class: 'aide' },
          'Claude Code ',
          h('code', {}, s.claudeCode.version),
          ' : ',
          h('code', {}, s.claudeCode.executable),
        ),
      );
      if (reglages.claude.mode === 'compte') {
        const c = s.compte || {};
        if (c.connecte && c.methode === 'claude.ai')
          blocs.push(
            etat(
              'ok',
              t(c.abonnement ? 'p.claude.connecteAbonnement' : 'p.claude.connecteCompte', {
                email: c.email || '',
                abonnement: c.abonnement,
              }),
            ),
          );
        else if (c.connecte)
          blocs.push(
            etat(
              'ok',
              t('p.claude.connecteAutre', {
                methode: c.methode || t('p.claude.methodeInconnue'),
                email: c.email ? ', ' + c.email : '',
              }),
            ),
          );
        else blocs.push(etat('alerte', t('p.claude.deconnecte')));
        blocs.push(
          h(
            'div',
            { class: 'ligne' },
            bouton(t(c.connecte ? 'p.claude.changerCompte' : 'p.claude.seConnecter'), {
              genre: c.connecte ? '' : 'principal',
              onClick: async () => {
                try {
                  await api.claude.connecter();
                  note(t('p.claude.noteTerminal'), { duree: 8000 });
                } catch (e) {
                  note(messageErreur(e), { erreur: true });
                }
              },
            }),
            c.connecte
              ? bouton(t('p.claude.seDeconnecter'), {
                  genre: 'discret-danger',
                  onClick: async () => {
                    if (
                      !(await confirmer({
                        titre: t('p.claude.deconnecterTitre'),
                        message: t('p.claude.deconnecterTexte'),
                        valider: t('p.claude.deconnecter'),
                        danger: true,
                      }))
                    )
                      return;
                    try {
                      await api.claude.deconnecter();
                      note(t('p.claude.noteDeconnecte'));
                    } catch (e) {
                      note(messageErreur(e), { erreur: true });
                    }
                    actualiser();
                  },
                })
              : null,
            bouton(t('p.claude.verifier'), { genre: 'leger', onClick: actualiser }),
          ),
        );
      }
    }
    zoneEtat.replaceChildren(...blocs);

    zoneCle.hidden = reglages.claude.mode !== 'cle';
    const cle = [];
    if (s.cleEnregistree && s.cleLisible)
      cle.push(etat('ok', t(s.cleActive ? 'p.claude.cleActive' : 'p.claude.cleApresRedemarrage')));
    else if (s.cleEnregistree) cle.push(etat('erreur', t('p.claude.cleIllisible')));
    else cle.push(etat('alerte', t('p.claude.cleAucune')));
    if (!s.chiffrementDisponible) cle.push(etat('erreur', t('p.claude.sansChiffrement')));
    zoneCle.replaceChildren(
      h('label', { class: 'champ' }, h('span', {}, t('p.claude.cleLibelle')), saisie),
      h(
        'p',
        { class: 'aide' },
        t('p.claude.cleAide') + ' ',
        h(
          'a',
          {
            href: '#',
            onClick: (e) => {
              e.preventDefault();
              api.claude.lien('cles');
            },
          },
          t('p.claude.creerCle'),
        ),
        '.',
      ),
      h(
        'div',
        { class: 'ligne' },
        bouton(t('p.claude.enregistrerCle'), {
          genre: 'principal',
          desactive: !s.chiffrementDisponible,
          onClick: async () => {
            const v = saisie.value.trim();
            if (!v) {
              note(t('p.claude.collerCle'), { erreur: true });
              return;
            }
            try {
              const r = await api.claude.enregistrerCle(v);
              saisie.value = '';
              note(
                r.avertissement
                  ? t('p.claude.cleEnregistreeAvert', { avertissement: r.avertissement })
                  : t('p.claude.cleEnregistree'),
                { duree: 5000 },
              );
              proposerRedemarrage();
            } catch (e) {
              note(messageErreur(e), { erreur: true, duree: 6000 });
            }
            actualiser();
          },
        }),
        s.cleEnregistree
          ? bouton(t('p.claude.supprimerCle'), {
              genre: 'discret-danger',
              onClick: async () => {
                if (
                  !(await confirmer({
                    titre: t('p.claude.supprimerCleTitre'),
                    message: t('p.claude.supprimerCleTexte'),
                    valider: t('commun.supprimer'),
                    danger: true,
                  }))
                )
                  return;
                await api.claude.enregistrerCle('');
                note(t('p.claude.cleSupprimee'));
                actualiser();
              },
            })
          : null,
      ),
      ...cle,
    );
  }

  async function actualiser() {
    zoneEtat.replaceChildren(etat('', t('p.claude.verification')));
    try {
      statut = await api.claude.statut();
      peindre();
    } catch (e) {
      zoneEtat.replaceChildren(etat('erreur', messageErreur(e)));
    }
  }

  const option = (valeur, titre, description) =>
    h(
      'label',
      {},
      h('input', {
        type: 'radio',
        name: 'claude',
        value: valeur,
        checked: reglages.claude.mode === valeur,
        onChange: async () => {
          await enregistrer({ claude: { mode: valeur } });
          if (statut) peindre();
          proposerRedemarrage();
        },
      }),
      h('span', {}, h('strong', {}, titre), h('span', {}, description)),
    );

  actualiser();
  return carte(
    'claude',
    'claude',
    t('p.claude.titre'),
    t('p.claude.description'),
    h(
      'div',
      { class: 'choix' },
      option('compte', t('p.claude.modeCompte'), t('p.claude.modeCompteAide')),
      option('cle', t('p.claude.modeCle'), t('p.claude.modeCleAide')),
    ),
    zoneEtat,
    zoneCle,
    h('p', { class: 'aide' }, t('p.claude.aide')),
  );
}

/* -- Modèles de Claude et exécution du code (ex-« Réglages » des quiz) ------------------- */

// Libellés des usages connus dans la langue de l'interface (le serveur les donne en français)
function libelleUsage(id, usage) {
  const cle = `p.modeles.usage.${id}`;
  const titre = t(cle);
  return titre === cle
    ? { libelle: usage.libelle, description: usage.description }
    : { libelle: titre, description: t(cle + '.aide') };
}

function libelleModele(m) {
  const cle = `p.modeles.modele.${m.id || 'defaut'}`;
  const texte = t(cle);
  return texte === cle ? m.libelle : texte;
}

function carteModeles() {
  const zone = h('div', { class: 'modeles' }, etat('', t('p.modeles.lecture')));
  let r = null;

  const chemin = h('input', {
    class: 'saisie',
    type: 'text',
    placeholder: t('p.modeles.cheminExemple'),
    spellcheck: false,
  });

  async function enregistrer() {
    r.claude.executable = chemin.value.trim();
    await api.quiz.reglages(r);
  }

  function ligneUsage(id, usage, e) {
    const reglage = r.usages[id];
    const { libelle, description } = libelleUsage(id, usage);
    const connu = e.modeles.some((m) => m.id === reglage.modele);
    const libre = h('input', {
      class: 'saisie',
      type: 'text',
      placeholder: 'claude-sonnet-5…',
      value: connu ? '' : reglage.modele,
      onInput: (ev) => {
        reglage.modele = ev.target.value.trim();
      },
    });
    libre.hidden = connu;
    const modele = h(
      'select',
      {
        class: 'saisie',
        'aria-label': t('p.modeles.modeleAria', { usage: libelle }),
        onChange: (ev) => {
          libre.hidden = ev.target.value !== '__autre';
          reglage.modele = ev.target.value === '__autre' ? libre.value.trim() : ev.target.value;
        },
      },
      e.modeles.map((m) => h('option', { value: m.id, selected: connu && m.id === reglage.modele }, libelleModele(m))),
      h('option', { value: '__autre', selected: !connu }, t('p.modeles.autre')),
    );
    const effort = h(
      'select',
      {
        class: 'saisie',
        'aria-label': t('p.modeles.effortAria', { usage: libelle }),
        onChange: (ev) => {
          reglage.effort = ev.target.value;
        },
      },
      e.efforts.map((x) =>
        h(
          'option',
          { value: x, selected: x === reglage.effort },
          x ? t('p.modeles.effort', { x }) : t('p.modeles.effortDefaut'),
        ),
      ),
    );
    const resultat = h('span', { class: 'aide' });
    const tester = bouton(t('p.modeles.tester'), {
      genre: 'leger',
      onClick: async () => {
        tester.disabled = true;
        resultat.textContent = t('p.modeles.test');
        try {
          await enregistrer();
          const x = await api.quiz.tester(id);
          resultat.textContent = `OK · ${(x.modele || '').replace(/^claude-/, '')} · ${(x.duree / 1000).toFixed(1)} s`;
        } catch (err) {
          resultat.textContent = messageErreur(err).slice(0, 160);
        } finally {
          tester.disabled = false;
        }
      },
    });
    return h(
      'div',
      { class: 'usage' },
      h('div', {}, h('strong', {}, libelle), h('br'), h('span', { class: 'aide' }, description)),
      h('div', { class: 'ligne' }, modele, libre, effort, tester),
      resultat,
    );
  }

  async function charger() {
    try {
      const e = await api.quiz.etat();
      r = JSON.parse(JSON.stringify(e.reglages));
      chemin.value = r.claude.executable || '';
      const q = e.quota && e.quota.unifiedWindows;
      const morceaux = [];
      if (q && q.five_hour) morceaux.push(t('p.modeles.quota5h', { p: Math.round(q.five_hour.utilization * 100) }));
      if (q && q.seven_day)
        morceaux.push(t('p.modeles.quotaSemaine', { p: Math.round(q.seven_day.utilization * 100) }));
      const quota = morceaux.length ? t('p.modeles.quota', { detail: morceaux.join(' · ') }) : null;
      zone.replaceChildren(
        h(
          'div',
          { class: 'modeles' },
          h('h3', {}, t('p.modeles.claudeCode')),
          e.claude.disponible
            ? etat('ok', t('p.modeles.trouve', { version: e.claude.version, executable: e.claude.executable }))
            : etat('alerte', e.claude.erreur),
          h('label', { class: 'champ' }, h('span', {}, t('p.modeles.chemin')), chemin),
          quota ? h('p', { class: 'aide' }, quota) : null,
          h('h3', {}, t('p.modeles.parUsage')),
          h('p', { class: 'aide' }, t('p.modeles.parUsageAide')),
          h(
            'div',
            { class: 'usages' },
            Object.entries(e.usages).map(([id, u]) => ligneUsage(id, u, e)),
          ),
          h(
            'div',
            { class: 'ligne' },
            bouton(t('commun.enregistrer'), {
              genre: 'principal',
              onClick: async () => {
                try {
                  await enregistrer();
                  note(t('p.modeles.noteEnregistre'));
                  charger();
                } catch (err) {
                  note(messageErreur(err), { erreur: true });
                }
              },
            }),
            bouton(t('p.modeles.recharger'), { genre: 'leger', onClick: charger }),
          ),
          h('h3', {}, t('p.modeles.execution')),
          h(
            'ul',
            { class: 'langages' },
            Object.entries(e.executeurs).map(([k, v]) =>
              h(
                'li',
                { class: v ? 'ok' : 'ko' },
                `${{ sql: 'SQL', javascript: 'JavaScript', python: 'Python', c: 'C', 'c-posix': 'C POSIX (WSL)' }[k] || k} : ${v || t('p.modeles.indisponible')}`,
              ),
            ),
          ),
        ),
      );
    } catch (err) {
      zone.replaceChildren(
        etat('erreur', messageErreur(err)),
        h('div', { class: 'ligne' }, bouton(t('commun.reessayer'), { genre: 'leger', onClick: charger })),
      );
    }
  }

  charger();
  return carte('claude-modeles', 'claude', t('p.modeles.titre'), t('p.modeles.description'), zone);
}

/* -- Profil ---------------------------------------------------------------------------- */

function carteProfils() {
  const zone = h('div', { class: 'pile' });

  async function charger() {
    zone.replaceChildren(h('p', { class: 'aide' }, t('commun.chargement')));
    let e;
    try {
      e = await api.profils.etat();
    } catch (err) {
      zone.replaceChildren(
        etat('erreur', messageErreur(err)),
        h('div', { class: 'ligne' }, bouton(t('commun.reessayer'), { genre: 'leger', onClick: charger })),
      );
      return;
    }
    const nouveau = h('input', {
      class: 'saisie',
      type: 'text',
      value: e.profils.length ? '' : e.session,
      placeholder: e.session,
      spellcheck: 'false',
    });
    const choixCursus = h('select', { class: 'saisie' }, h('option', { value: '' }, t('p.profil.aucunCursus')));
    const telecharger = h('input', { type: 'checkbox', checked: true });
    api.profils.cursus().then((liste) => {
      for (const c of liste)
        choixCursus.append(h('option', { value: c.id }, t('p.profil.cursusOption', { titre: c.titre, n: c.nombre })));
    });
    const creer = async () => {
      try {
        const r = await api.profils.creer(nouveau.value || e.session, choixCursus.value || null, telecharger.checked);
        note(messageCreation(r), { duree: 8000, erreur: Boolean(r.cursusExemple && r.cursusExemple.erreur) });
        charger();
      } catch (err) {
        note(messageErreur(err), { erreur: true, duree: 6000 });
      }
    };
    const liste = e.profils.map((p) =>
      h(
        'label',
        {},
        h('input', {
          type: 'radio',
          name: 'profil',
          value: p.nom,
          checked: p.nom === e.profil,
          onChange: async () => {
            try {
              await api.profils.choisir(p.nom);
              note(t('p.profil.noteChoisi', { nom: p.nom }));
              charger();
            } catch (err) {
              note(messageErreur(err), { erreur: true });
            }
          },
        }),
        h(
          'span',
          {},
          h('strong', {}, p.nom),
          h('span', {}, p.nom === e.profil ? t('p.profil.actif') : t('p.profil.cree', { date: p.cree || '—' })),
        ),
      ),
    );
    const renommer = h('input', { class: 'saisie', type: 'text', value: e.profil || '', spellcheck: 'false' });
    zone.replaceChildren(
      e.profils.length ? h('div', { class: 'choix' }, ...liste) : etat('alerte', t('p.profil.aucun')),
      h(
        'div',
        { class: 'champs' },
        h('label', { class: 'champ' }, h('span', {}, t('p.profil.nouveau')), nouveau),
        h('label', { class: 'champ' }, h('span', {}, t('p.profil.cursusExemple')), choixCursus),
      ),
      h('label', { class: 'interrupteur' }, telecharger, h('span', {}, t('p.profil.telecharger'))),
      h(
        'div',
        { class: 'ligne' },
        bouton(t('p.profil.ajouter'), { genre: e.profils.length ? '' : 'principal', onClick: creer }),
      ),
      e.profil
        ? h(
            'div',
            { class: 'champs avec-bouton' },
            h('label', { class: 'champ' }, h('span', {}, t('p.profil.renommerLibelle', { nom: e.profil })), renommer),
            bouton(t('p.profil.renommer'), {
              genre: 'leger',
              onClick: async () => {
                try {
                  await api.profils.renommer(e.profil, renommer.value);
                  note(t('p.profil.noteRenomme'));
                  charger();
                } catch (err) {
                  note(messageErreur(err), { erreur: true, duree: 6000 });
                }
              },
            }),
          )
        : null,
      h('p', { class: 'aide' }, t('p.profil.aide')),
    );
  }

  charger();
  return carte('profil', 'menu', t('p.profil.titre'), t('p.profil.description'), zone);
}

/* -- Dossier des données -------------------------------------------------------------- */

function carteDonnees() {
  const v = info.versionsOutils || {};
  const date = (iso) =>
    iso ? new Date(iso).toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const mode =
    {
      depot: t('p.donnees.modeDepot'),
      installe: v.livre
        ? t('p.donnees.modeInstalleVersion', {
            date: date(v.livre.cree),
            n: v.livre.fichiers,
            dossier: info.dossierLocal,
          })
        : t('p.donnees.modeInstalle', { dossier: info.dossierLocal }),
      developpement: t('p.donnees.modeDev'),
    }[info.modeDonnees] || '';
  return carte(
    'donnees',
    'dossier',
    t('p.donnees.titre'),
    t('p.donnees.description'),
    h('p', {}, t('p.donnees.actuel') + ' ', h('code', {}, info.racine || '—')),
    h('p', { class: 'aide' }, mode),
    h(
      'div',
      { class: 'ligne' },
      bouton(t('p.donnees.choisir'), {
        onClick: async () => {
          const r = await api.donnees.choisir();
          if (!r.ok) {
            if (r.message) note(r.message, { erreur: true, duree: 6000 });
            return;
          }
          note(t(r.depot ? 'p.donnees.noteDepot' : 'p.donnees.noteChoisi'));
          proposerRedemarrage();
        },
      }),
      bouton(t('p.donnees.defaut'), {
        genre: 'leger',
        onClick: async () => {
          const r = await api.donnees.defaut();
          note(t('p.donnees.noteDefaut', { dossier: r.dossier }));
          proposerRedemarrage();
        },
      }),
      bouton(t('p.donnees.ouvrir'), { genre: 'leger', onClick: () => api.ouvrirDossier('donnees') }),
    ),
    h('p', { class: 'aide' }, t('p.donnees.aide', { dossier: info.dossierParDefaut })),
  );
}

/* -- Synchronisation ------------------------------------------------------------------ */

export function decrireSynchro(s) {
  if (!s) return ['', t('commun.chargement')];
  if (s.enCours) return ['', t('p.synchro.enCours')];
  const d = s.dernier;
  if (!d) return ['', t(s.auto ? 'p.synchro.bientot' : 'p.synchro.jamais')];
  const quand = d.a
    ? new Date(d.a).toLocaleString(locale(), { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
    : '';
  const bilan = [];
  if (d.commits) bilan.push(t('p.synchro.bilanCommit'));
  if (d.recus && d.recus.length) bilan.push(tn('p.synchro.bilanRecus', d.recus.length));
  if (d.envoyes) bilan.push(tn('p.synchro.bilanEnvoyes', d.envoyes));
  switch (d.etat) {
    case 'synchronise':
      return ['ok', t('p.synchro.synchronise', { quand, bilan: bilan.join(', ') })];
    case 'a-jour':
      return ['ok', t('p.synchro.aJour', { quand })];
    case 'hors-ligne':
      return ['alerte', t('p.synchro.horsLigne', { message: d.message, quand })];
    case 'bloque':
      return ['alerte', `${d.message} (${quand})`];
    default:
      return ['erreur', `${d.message} (${quand})`];
  }
}

function carteSynchro() {
  const zone = h('div', {});
  const caseAuto = h('input', {
    type: 'checkbox',
    onChange: async (e) => {
      peindre(await api.synchro.auto(e.target.checked));
      note(t(e.target.checked ? 'p.synchro.noteActive' : 'p.synchro.noteDesactive'));
    },
  });
  const maintenant = bouton(t('p.synchro.maintenant'), { genre: 'principal', onClick: () => api.synchro.maintenant() });

  function peindre(s) {
    if (!s.visible) {
      caseAuto.checked = false;
      caseAuto.disabled = true;
      maintenant.disabled = true;
      zone.replaceChildren(
        etat('', s.raison || t('p.synchro.pasDepot')),
        h('p', { class: 'aide' }, t(s.git ? 'p.synchro.commentFaire' : 'p.synchro.sansGit')),
      );
      return;
    }
    caseAuto.checked = s.auto === true;
    caseAuto.disabled = false;
    maintenant.disabled = s.enCours;
    const [genre, texte] = decrireSynchro(s);
    const d = s.dernier;
    const conflits =
      d && d.conflits && d.conflits.length
        ? h(
            'ul',
            { class: 'aide' },
            ...d.conflits.map((c) =>
              h(
                'li',
                {},
                h('code', {}, c.chemin),
                ` : ${c.regle}`,
                c.copie
                  ? h('span', {}, ` (${t('p.synchro.copie')} `, h('code', {}, c.copie.split('/').pop()), ')')
                  : null,
              ),
            ),
          )
        : null;
    const ignores =
      d && d.ignores && d.ignores.length
        ? etat('alerte', tn('p.synchro.ignores', d.ignores.length, { liste: d.ignores.join(', ') }))
        : null;
    const avertissement = d && d.avertissement ? etat('alerte', d.avertissement) : null;
    zone.replaceChildren(
      ...[
        h(
          'p',
          {},
          t('p.synchro.depot') + ' ',
          h('code', {}, s.adresse || s.distant),
          ' ' + t('p.synchro.branche', { branche: s.branche, distant: s.distant, git: s.git }),
        ),
        etat(genre, texte),
        avertissement,
        conflits,
        ignores,
        h(
          'p',
          { class: 'aide' },
          t(s.mode === 'progression' ? 'p.synchro.perimetreProgression' : 'p.synchro.perimetreTout'),
        ),
      ].filter(Boolean),
    );
  }

  api.synchro.statut().then(peindre);
  api.synchro.surStatut(peindre);

  return carte(
    'synchro',
    'nuage',
    t('p.synchro.titre'),
    t('p.synchro.description'),
    h(
      'label',
      { class: 'interrupteur' },
      caseAuto,
      h(
        'span',
        {},
        h('strong', {}, t('p.synchro.auto')),
        h('br'),
        h('span', { class: 'aide' }, t('p.synchro.autoAide')),
      ),
    ),
    h(
      'div',
      { class: 'ligne' },
      maintenant,
      bouton(t('p.synchro.ouvrirDonnees'), { genre: 'leger', onClick: () => api.ouvrirDossier('donnees') }),
    ),
    zone,
    h('p', { class: 'aide' }, t('p.synchro.aide')),
  );
}

/* -- À propos ------------------------------------------------------------------------- */

function carteAPropos() {
  return carte(
    'a-propos',
    'info',
    t('p.apropos.titre'),
    null,
    h(
      'p',
      {},
      t(info.installee ? 'p.apropos.versionInstallee' : 'p.apropos.versionDev', {
        version: info.version,
        electron: info.electron,
      }),
    ),
    h('p', { class: 'aide' }, t('p.apropos.parametres') + ' ', h('code', {}, info.donnees)),
    info.journaux ? h('p', { class: 'aide' }, t('p.apropos.journaux') + ' ', h('code', {}, info.journaux)) : null,
    h(
      'div',
      { class: 'ligne' },
      bouton(t('p.apropos.ouvrirParametres'), { genre: 'leger', onClick: () => api.ouvrirDossier('parametres') }),
      info.journaux
        ? bouton(t('p.apropos.ouvrirJournaux'), { genre: 'leger', onClick: () => api.ouvrirDossier('journaux') })
        : null,
      bouton(t('p.apropos.redemarrer'), { genre: 'leger', onClick: () => api.redemarrer() }),
    ),
  );
}

/* -- Redémarrage ---------------------------------------------------------------------- */

let proposition = null;
function proposerRedemarrage() {
  if (proposition) return;
  proposition = h(
    'div',
    { class: 'carte large' },
    etat('alerte', t('p.redemarrage.texte')),
    h(
      'div',
      { class: 'ligne' },
      bouton(t('p.redemarrage.maintenant'), { genre: 'principal', onClick: () => api.redemarrer() }),
      bouton(t('commun.plusTard'), {
        genre: 'leger',
        onClick: () => {
          proposition.remove();
          proposition = null;
        },
      }),
    ),
  );
  document.getElementById('cartes').prepend(proposition);
  ranger();
  defilement.scrollTo({ top: 0 });
}

/* -- Page ------------------------------------------------------------------------------- */

// Sections, dans l'ordre des cartes : id de la carte et clé de son lien de navigation
const SECTIONS = [
  ['langue', 'p.nav.langue', carteLangue],
  ['aide', 'p.nav.aide', carteAide],
  ['mises-a-jour', 'p.nav.maj', carteMisesAJour],
  ['affichage', 'p.nav.echelle', carteAffichage],
  ['arriere-plan', 'p.nav.arriere', carteArrierePlan],
  ['fenetre', 'p.nav.fenetre', carteFenetre],
  ['raccourcis', 'p.nav.raccourcis', carteRaccourcis],
  ['claude', 'p.nav.claude', carteClaude],
  ['claude-modeles', 'p.nav.modeles', carteModeles],
  ['profil', 'p.nav.profil', carteProfils],
  ['donnees', 'p.nav.donnees', carteDonnees],
  ['synchro', 'p.nav.synchro', carteSynchro],
  ['a-propos', 'p.nav.apropos', carteAPropos],
];

const sommaire = document.querySelector('.sommaire');
sommaire.setAttribute('aria-label', t('p.nav.aria'));
sommaire.replaceChildren(...SECTIONS.map(([id, cle]) => h('a', { href: '#' + id }, t(cle))));

const cartes = document.getElementById('cartes');
cartes.append(...SECTIONS.map(([, , fabriquer]) => fabriquer()));
// Cartes qui gardent toute la largeur (cadre des écrans, modèles par usage)
for (const id of ['fenetre', 'claude-modeles']) document.getElementById(id)?.classList.add('large');

/* Rangement en colonnes, sans trous (même logique que les blocs de l'accueil) :
   1 colonne sous 860 px de panneau, puis autant de colonnes d'au moins 420 px que
   la largeur en permet (3 au plus). L'ordre est gardé ; une carte large prend toute
   la ligne, et la dernière petite carte d'une ligne incomplète s'élargit jusqu'au
   bord. Toutes les cartes d'une ligne ont la même hauteur. */
const LARGEUR_MIN_CARTE = 420;
function colonnes() {
  if (document.getElementById('panneau').clientWidth < 860) return 1;
  const ecart = parseFloat(getComputedStyle(cartes).columnGap) || 16;
  return Math.max(1, Math.min(3, Math.floor((cartes.clientWidth + ecart) / (LARGEUR_MIN_CARTE + ecart))));
}
export function plan(larges, n) {
  // larges : [bool…] dans l'ordre ; renvoie la largeur (en colonnes) de chaque carte
  const tailles = larges.map((l) => (l ? n : 1));
  let pris = 0;
  const finirLigne = (fin) => {
    if (pris > 0 && pris < n) tailles[fin] += n - pris;
    pris = 0;
  };
  larges.forEach((large, i) => {
    if (large) {
      finirLigne(i - 1);
      return;
    }
    if (pris === n) pris = 0;
    pris += 1;
    if (i === larges.length - 1 || larges[i + 1]) finirLigne(i);
  });
  return tailles;
}
let dernierPlan = '';
function ranger() {
  const liste = [...cartes.children].filter((c) => c.classList.contains('carte'));
  const n = colonnes();
  const tailles = plan(
    liste.map((c) => c.classList.contains('large')),
    n,
  );
  const cle = n + ':' + tailles.join(',');
  if (cle === dernierPlan) return;
  dernierPlan = cle;
  cartes.style.setProperty('--colonnes', String(n));
  liste.forEach((c, i) => {
    c.style.gridColumn = `span ${tailles[i]}`;
  });
}
ranger();
new ResizeObserver(() => ranger()).observe(cartes);

/* Navigation : sur le côté dès 860 px de panneau, section courante surlignée */
const liens = [...document.querySelectorAll('.sommaire a')];
function sectionCourante() {
  const seuil = defilement.getBoundingClientRect().top + 60;
  // La carte passée sous le haut de la fenêtre la plus basse ; sur une même ligne
  // de cartes, la première
  let courant = liens[0],
    haut = -Infinity;
  for (const a of liens) {
    const el = document.getElementById(a.getAttribute('href').slice(1));
    const top = el ? el.getBoundingClientRect().top : Infinity;
    if (top <= seuil && top > haut + 1) {
      courant = a;
      haut = top;
    }
  }
  // En bas de page : la dernière section
  if (defilement.clientHeight + defilement.scrollTop >= defilement.scrollHeight - 4) courant = liens[liens.length - 1];
  for (const a of liens) {
    const actif = a === courant;
    a.classList.toggle('actif', actif);
    if (actif) a.setAttribute('aria-current', 'location');
    else a.removeAttribute('aria-current');
  }
}
let attenteSection = false;
defilement.addEventListener(
  'scroll',
  () => {
    if (attenteSection) return;
    attenteSection = true;
    requestAnimationFrame(() => {
      attenteSection = false;
      sectionCourante();
    });
  },
  { passive: true },
);
window.addEventListener('resize', sectionCourante);

// Section demandée (lien de la documentation, notification…) : les cartes se
// remplissent après coup (profils, synchronisation…), elle est donc gardée en haut
// pendant un instant, sauf si l'utilisateur fait défiler lui-même
let cible = null,
  finCible = 0;
const montrer = () => cible && cible.scrollIntoView({ behavior: 'instant', block: 'start' });
const aller = (section) => {
  const el = section && document.getElementById(section);
  if (el) {
    cible = el;
    finCible = Date.now() + 2000;
    montrer();
  }
  sectionCourante();
};
new ResizeObserver(() => {
  if (cible && Date.now() < finCible) montrer();
  else cible = null;
}).observe(cartes);
for (const ev of ['wheel', 'keydown', 'pointerdown'])
  window.addEventListener(
    ev,
    () => {
      cible = null;
    },
    { passive: true },
  );
aller(location.hash.slice(1));
api.surSection(aller);
sectionCourante();
