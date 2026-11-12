// Page des paramètres de l'application installée : mises à jour, fenêtre au
// lancement, raccourcis, connexion à Claude, dossier des cours, à propos.

import { h, icone, bouton, carte, etat, note, confirmer, antiRebond, messageErreur } from './outils.js';
import { creerCadre } from './cadre-fenetre.js';

const api = window.studies;
const MIN = { width: 640, height: 480 };

let info = await api.info();
let reglages = await api.reglages();

async function enregistrer(partiel) {
  reglages = await api.modifier(partiel);
  return reglages;
}

document.getElementById('sous-titre').textContent =
  `Studies ${info.version}${info.installee ? '' : ' (développement)'} · Electron ${info.electron}`;

/* -- Mises à jour ------------------------------------------------------------ */

export function decrireMaj(s) {
  switch (s && s.etat) {
    case 'recherche': return ['', 'Recherche d’une mise à jour…'];
    case 'disponible': return ['', `Version ${s.version} disponible : téléchargement en cours…`];
    case 'telechargement': return ['', `Téléchargement de la mise à jour : ${s.pourcent ?? 0} %`];
    case 'pret': return ['ok', `Version ${s.version} prête : elle s’installera à la fermeture de Studies.`];
    case 'a-jour': return ['ok', `Studies est à jour${s.viaGh ? ' (dépôt privé, lu avec GitHub CLI)' : ''}.`];
    case 'indisponible': return ['', s.message];
    case 'erreur': return ['erreur', `Échec de la recherche : ${s.message}`];
    default: return ['', 'Aucune recherche depuis le lancement.'];
  }
}

function carteMisesAJour() {
  const zone = h('div', {});
  const installer = bouton('Redémarrer et installer', { genre: 'principal', onClick: () => api.maj.installer() });
  const peindre = (s) => {
    const [genre, texte] = decrireMaj(s);
    zone.replaceChildren(etat(genre, texte));
    installer.hidden = !s || s.etat !== 'pret';
  };
  api.maj.statut().then(peindre);
  api.maj.surStatut(peindre);

  const auto = h('input', { type: 'checkbox', checked: reglages.miseAJourAuto, onChange: async (e) => {
    await enregistrer({ miseAJourAuto: e.target.checked });
    note(e.target.checked ? 'Mises à jour automatiques activées' : 'Mises à jour automatiques désactivées');
  } });

  return carte('mises-a-jour', 'maj', 'Mises à jour', `Version installée : ${info.version}`,
    h('label', { class: 'interrupteur' }, auto,
      h('span', {}, h('strong', {}, 'Rechercher et installer les mises à jour au démarrage'),
        h('br'), h('span', { class: 'aide' }, 'La nouvelle version se télécharge en arrière-plan et s’installe à la fermeture de Studies.'))),
    h('div', { class: 'ligne' },
      bouton('Rechercher maintenant', { onClick: () => api.maj.verifier() }),
      installer,
      bouton('Voir les versions publiées', { genre: 'leger', onClick: () => api.ouvrirReleases() })),
    zone,
    h('p', { class: 'aide' }, 'Les versions sont publiées sur GitHub (WolfGang-PRoxa/universal-learn-academy). Tant que ce dépôt est privé, seule une session GitHub CLI connectée (gh auth login) permet de les lire. Aucun jeton n’est enregistré dans l’application.'));
}

/* -- Fenêtre au lancement ------------------------------------------------------- */

function carteFenetre() {
  const hote = h('div', {});
  const champs = {};
  let cadre = null;

  const garder = antiRebond((bornes) => enregistrer({ fenetre: { mode: 'personnalisee', bornes } }), 250);
  const synchroniser = (b) => { for (const k of ['width', 'height', 'x', 'y']) if (document.activeElement !== champs[k]) champs[k].value = b[k]; };

  const champ = (cle, libelle) => {
    champs[cle] = h('input', { class: 'saisie', type: 'number', step: 1, value: reglages.fenetre.bornes[cle], onInput: (e) => {
      const v = Number.parseInt(e.target.value, 10);
      if (!Number.isFinite(v) || !cadre) return;
      garder(cadre.fixer({ [cle]: v }));
    }, onBlur: () => cadre && synchroniser(cadre.bornes()) });
    return h('label', { class: 'champ' }, h('span', {}, libelle + ' (px)'), champs[cle]);
  };

  const perso = h('div', { class: 'carte-perso' },
    h('p', { class: 'aide' }, 'Déplacer le cadre bleu pour choisir la position, tirer ses bords ou ses coins pour choisir la taille (ou les flèches du clavier : Maj pour un grand pas, Alt pour la taille). Les valeurs sont en pixels du système, mise à l’échelle comprise.'),
    hote,
    h('div', { class: 'grille-4' }, champ('width', 'Largeur'), champ('height', 'Hauteur'), champ('x', 'Position X'), champ('y', 'Position Y')),
    h('div', { class: 'ligne' }, bouton('Reprendre la fenêtre actuelle', { onClick: async () => {
      const b = await api.bornesActuelles();
      if (!b || !cadre) return;
      const r = cadre.fixer(b);
      synchroniser(r);
      await enregistrer({ fenetre: { mode: 'personnalisee', bornes: r } });
      note('Taille et position de la fenêtre actuelle enregistrées');
    } })));

  async function preparerCadre() {
    if (cadre) return;
    cadre = creerCadre({ ecrans: await api.ecrans(), bornes: reglages.fenetre.bornes, min: MIN, surChangement: synchroniser, surFin: garder });
    hote.replaceChildren(cadre.element);
    synchroniser(cadre.bornes());
  }

  const option = (valeur, titre, description) => h('label', {},
    h('input', { type: 'radio', name: 'fenetre', value: valeur, checked: reglages.fenetre.mode === valeur, onChange: async () => {
      await enregistrer({ fenetre: { mode: valeur } });
      perso.hidden = valeur !== 'personnalisee';
      if (valeur === 'personnalisee') preparerCadre();
      note('Réglage appliqué au prochain lancement');
    } }),
    h('span', {}, h('strong', {}, titre), h('span', {}, description)));

  perso.hidden = reglages.fenetre.mode !== 'personnalisee';
  if (!perso.hidden) preparerCadre();

  return carte('fenetre', 'ecran', 'Fenêtre au lancement', 'Taille et position de la fenêtre de Studies à chaque ouverture.',
    h('div', { class: 'choix' },
      option('agrandie', 'Grande fenêtre', 'Studies s’ouvre agrandi sur l’écran principal (réglage par défaut).'),
      option('personnalisee', 'Taille et position personnalisées', 'Studies s’ouvre exactement à l’endroit choisi ci-dessous ; si cet endroit n’est plus visible (écran débranché), il s’ouvre agrandi.')),
    perso);
}

/* -- Raccourcis ------------------------------------------------------------------ */

export function decrireRaccourci(l) {
  const nom = `« ${l.name || l.fichier} »`;
  const cible = l.currentTarget ? ` (${l.currentTarget})` : '';
  switch (l.status) {
    case 'ok': return ['ok', `Raccourci présent : ${nom}.`];
    case 'other-name': return ['ok', `Un raccourci vers Studies existe déjà sous un autre nom : ${nom}.`];
    case 'outdated': return ['alerte', `${nom} ouvre une autre copie de Studies${cible}. Il peut être réparé pour ouvrir cette installation.`];
    case 'broken': return ['alerte', `${nom} ne fonctionne plus : le programme qu’il ouvre n’existe plus${cible}.`];
    case 'foreign': return ['alerte', l.currentTarget ? `Un fichier ${nom} existe déjà, mais il ouvre un autre programme${cible}.` : `Un fichier ${nom} existe déjà, mais ce n’est pas un raccourci lisible.`];
    default: return ['', l.dirExiste === false ? 'Dossier introuvable.' : 'Aucun raccourci.'];
  }
}

function resultatRaccourci(r, libelle) {
  switch (r.outcome) {
    case 'created': return `Raccourci créé (${libelle}).`;
    case 'repaired': return `Raccourci réparé (${libelle}) : il ouvre maintenant cette installation.`;
    case 'replaced': return `L’ancien fichier a été remplacé par un raccourci vers Studies (${libelle}).`;
    case 'already': return `Un raccourci existe déjà (${libelle}, « ${r.location.name} ») : rien n’a été modifié.`;
    case 'removed': return `Raccourci mis à la corbeille (${libelle}).`;
    case 'missing': return `Il n’y a déjà plus de raccourci (${libelle}).`;
    default: return `Opération impossible (${libelle}).`;
  }
}

function carteRaccourcis() {
  const liste = h('div', { class: 'raccourcis' }, h('p', { class: 'aide' }, 'Recherche des raccourcis…'));
  const pied = h('p', { class: 'aide' });
  let occupe = false;

  async function executer(l, genre) {
    if (occupe) return;
    occupe = true;
    try {
      let r;
      if (genre === 'supprimer') {
        if (!await confirmer({ titre: 'Supprimer le raccourci ?', message: `« ${l.name} » (${l.label}) sera mis à la corbeille. Studies n’est pas désinstallé.`, valider: 'Supprimer', danger: true })) return;
        r = await api.raccourcis.supprimer(l.id);
      } else {
        r = await api.raccourcis.creer(l.id);
        if (r.outcome === 'conflict') {
          if (!await confirmer({ titre: 'Remplacer le fichier existant ?', message: `${decrireRaccourci(r.location)[1]} Le remplacer par un raccourci vers Studies ?`, valider: 'Remplacer', danger: true })) { note('Le fichier existant a été conservé.'); return; }
          r = await api.raccourcis.creer(l.id, { confirmReplace: true });
        }
      }
      note(resultatRaccourci(r, l.label), { duree: 5000 });
    } catch (e) {
      note('Raccourci : ' + messageErreur(e), { erreur: true, duree: 6000 });
    } finally {
      occupe = false;
      actualiser();
    }
  }

  function ligne(l) {
    const [genre, texte] = decrireRaccourci(l);
    const actions = [];
    if (l.action === 'create') actions.push(bouton('Créer le raccourci', { genre: 'principal', onClick: () => executer(l, 'creer') }));
    if (l.action === 'repair') actions.push(bouton('Réparer', { genre: 'principal', onClick: () => executer(l, 'creer') }));
    if (l.action === 'replace') actions.push(bouton('Remplacer…', { onClick: () => executer(l, 'creer') }));
    if (l.file || l.dirExiste) actions.push(bouton('Afficher', { genre: 'leger', titre: 'Afficher dans l’explorateur de fichiers', onClick: () => api.raccourcis.afficher(l.id) }));
    if (l.removable) actions.push(bouton('Supprimer', { genre: 'discret-danger', onClick: () => executer(l, 'supprimer') }));
    if (l.choisi) actions.push(bouton('Retirer de la liste', { genre: 'leger', titre: 'Ne plus suivre ce dossier (le raccourci reste en place)', onClick: async () => { await api.raccourcis.oublier(l.id); actualiser(); } }));
    const autres = l.others && l.others.length ? h('span', { class: 'aide' }, `Autres raccourcis vers Studies : ${l.others.map((n) => `« ${n} »`).join(', ')}.`) : null;
    return h('div', { class: `raccourci ${genre}`.trim() },
      icone(l.id === 'bureau' ? 'ecran' : l.id === 'menu' ? 'menu' : 'dossier', 18),
      h('div', { class: 'texte' }, h('strong', {}, l.label), h('span', {}, texte), autres, h('span', { class: 'chemin', title: l.dir }, l.dir)),
      h('div', { class: 'ligne' }, actions));
  }

  async function actualiser() {
    try {
      const s = await api.raccourcis.statut();
      if (!s.supported) { liste.replaceChildren(h('p', { class: 'aide' }, 'Les raccourcis ne sont disponibles que sous Windows et Linux.')); return; }
      liste.replaceChildren(...s.locations.map(ligne));
      pied.textContent = !s.packaged
        ? 'Version de développement : le raccourci lance Electron avec ce projet.'
        : s.plateforme === 'win32'
          ? 'Les raccourcis du Bureau et du menu Démarrer portent le nom de ceux de l’installeur : la désinstallation les retire aussi.'
          : s.appImage ? 'Le raccourci ouvre ce fichier AppImage : ne pas le déplacer ensuite, ou réparer le raccourci.' : '';
    } catch (e) {
      liste.replaceChildren(etat('erreur', 'Lecture des raccourcis impossible : ' + messageErreur(e)));
    }
  }

  window.addEventListener('focus', () => { if (!occupe) actualiser(); });
  actualiser();

  return carte('raccourcis', 'raccourci', 'Raccourcis', 'Ouvrir Studies depuis le Bureau, le menu Démarrer ou un dossier de ton choix.',
    liste,
    h('div', { class: 'ligne' },
      bouton('Créer un raccourci dans un autre dossier…', { onClick: async () => {
        if (occupe) return;
        occupe = true;
        try {
          const r = await api.raccourcis.choisir();
          if (r.outcome !== 'canceled') note(resultatRaccourci(r, r.location ? r.location.label : 'dossier choisi'), { duree: 5000 });
        } catch (e) { note('Raccourci : ' + messageErreur(e), { erreur: true, duree: 6000 }); }
        finally { occupe = false; actualiser(); }
      } }),
      bouton('Actualiser', { genre: 'leger', onClick: actualiser })),
    pied);
}

/* -- Claude ------------------------------------------------------------------------- */

function carteClaude() {
  const zoneEtat = h('div', { class: 'choix-etat' });
  const zoneCle = h('div', {});
  let statut = null;

  const saisie = h('input', { class: 'saisie', type: 'password', placeholder: 'sk-ant-…', autocomplete: 'off', spellcheck: false });

  function peindre() {
    const s = statut;
    const blocs = [];
    if (!s.claudeCode) {
      blocs.push(etat('alerte', 'Claude Code n’est pas installé sur ce poste : les quiz s’affichent, mais l’aide, la correction et la génération par Claude ne fonctionneront pas.'),
        h('div', { class: 'ligne' }, bouton('Installer Claude Code', { genre: 'principal', onClick: () => api.claude.lien('installation') }), bouton('Vérifier à nouveau', { genre: 'leger', onClick: actualiser })));
    } else {
      blocs.push(h('p', { class: 'aide' }, 'Claude Code ', h('code', {}, s.claudeCode.version), ' : ', h('code', {}, s.claudeCode.executable)));
      if (reglages.claude.mode === 'compte') {
        const c = s.compte || {};
        if (c.connecte && c.methode === 'claude.ai') blocs.push(etat('ok', `Connecté à Claude Code avec le compte ${c.email || ''}${c.abonnement ? ` (abonnement ${c.abonnement})` : ''}.`));
        else if (c.connecte) blocs.push(etat('ok', `Claude Code est connecté (${c.methode || 'méthode inconnue'}${c.email ? ', ' + c.email : ''}).`));
        else blocs.push(etat('alerte', 'Claude Code n’est connecté à aucun compte.'));
        blocs.push(h('div', { class: 'ligne' },
          bouton(c.connecte ? 'Changer de compte…' : 'Se connecter…', { genre: c.connecte ? '' : 'principal', onClick: async () => {
            try { await api.claude.connecter(); note('Un terminal s’est ouvert : la connexion se fait sur le site d’Anthropic. Revenir ensuite ici et « Vérifier ».', { duree: 8000 }); }
            catch (e) { note(messageErreur(e), { erreur: true }); }
          } }),
          c.connecte ? bouton('Se déconnecter', { genre: 'discret-danger', onClick: async () => {
            if (!await confirmer({ titre: 'Déconnecter Claude Code ?', message: 'Claude Code sera déconnecté sur ce poste, pour Studies comme pour tes autres usages.', valider: 'Déconnecter', danger: true })) return;
            try { await api.claude.deconnecter(); note('Claude Code est déconnecté.'); } catch (e) { note(messageErreur(e), { erreur: true }); }
            actualiser();
          } }) : null,
          bouton('Vérifier', { genre: 'leger', onClick: actualiser })));
      }
    }
    zoneEtat.replaceChildren(...blocs);

    zoneCle.hidden = reglages.claude.mode !== 'cle';
    const cle = [];
    if (s.cleEnregistree && s.cleLisible) cle.push(etat('ok', s.cleActive ? 'Clé d’API enregistrée et utilisée.' : 'Clé d’API enregistrée : elle sera utilisée après le redémarrage de Studies.'));
    else if (s.cleEnregistree) cle.push(etat('erreur', 'La clé enregistrée ne peut plus être déchiffrée sur ce poste : la saisir à nouveau.'));
    else cle.push(etat('alerte', 'Aucune clé d’API enregistrée.'));
    if (!s.chiffrementDisponible) cle.push(etat('erreur', 'Le système ne peut pas chiffrer de secret (aucun trousseau) : la clé ne peut pas être enregistrée.'));
    zoneCle.replaceChildren(
      h('label', { class: 'champ' }, h('span', {}, 'Clé d’API Anthropic'), saisie),
      h('p', { class: 'aide' }, 'La clé est vérifiée auprès d’Anthropic, puis chiffrée par le système (Windows ou le trousseau de Linux) ; elle ne quitte pas ce poste et n’est jamais réaffichée. L’usage est facturé au compte de la clé. ',
        h('a', { href: '#', onClick: (e) => { e.preventDefault(); api.claude.lien('cles'); } }, 'Créer une clé dans la console Claude'), '.'),
      h('div', { class: 'ligne' },
        bouton('Enregistrer la clé', { genre: 'principal', desactive: !s.chiffrementDisponible, onClick: async () => {
          const v = saisie.value.trim();
          if (!v) { note('Coller d’abord une clé.', { erreur: true }); return; }
          try {
            const r = await api.claude.enregistrerCle(v);
            saisie.value = '';
            note(r.avertissement ? `Clé enregistrée. ${r.avertissement}` : 'Clé vérifiée et enregistrée.', { duree: 5000 });
            proposerRedemarrage();
          } catch (e) { note(messageErreur(e), { erreur: true, duree: 6000 }); }
          actualiser();
        } }),
        s.cleEnregistree ? bouton('Supprimer la clé', { genre: 'discret-danger', onClick: async () => {
          if (!await confirmer({ titre: 'Supprimer la clé ?', message: 'La clé est effacée de ce poste.', valider: 'Supprimer', danger: true })) return;
          await api.claude.enregistrerCle('');
          note('Clé supprimée.');
          actualiser();
        } }) : null),
      ...cle);
  }

  async function actualiser() {
    zoneEtat.replaceChildren(etat('', 'Vérification de Claude Code…'));
    try { statut = await api.claude.statut(); peindre(); }
    catch (e) { zoneEtat.replaceChildren(etat('erreur', messageErreur(e))); }
  }

  const option = (valeur, titre, description) => h('label', {},
    h('input', { type: 'radio', name: 'claude', value: valeur, checked: reglages.claude.mode === valeur, onChange: async () => {
      await enregistrer({ claude: { mode: valeur } });
      if (statut) peindre();
      proposerRedemarrage();
    } }),
    h('span', {}, h('strong', {}, titre), h('span', {}, description)));

  actualiser();
  return carte('claude', 'claude', 'Connexion à Claude', 'Aide pendant les quiz, correction des réponses rédigées et génération de nouveaux quiz.',
    h('div', { class: 'choix' },
      option('compte', 'Mon compte Claude, via Claude Code', 'Tu te connectes toi-même à Claude Code avec ton abonnement Claude (Pro, Max…). Studies ne voit jamais tes identifiants.'),
      option('cle', 'Une clé d’API Anthropic', 'Pour utiliser Claude sans abonnement : l’usage est facturé à la clé. Claude Code reste nécessaire.')),
    zoneEtat, zoneCle,
    h('p', { class: 'aide' }, 'Anthropic n’autorise pas une application tierce à proposer la connexion avec un compte claude.ai ni à conserver ses identifiants : la connexion par compte passe donc par Claude Code, chez Anthropic.'));
}

/* -- Dossier des cours ---------------------------------------------------------------- */

function carteCours() {
  const v = info.versionsCours || {};
  const date = (iso) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
  const dossierChoisi = h('p', { class: 'aide' });
  const peindreDossier = () => {
    dossierChoisi.replaceChildren(reglages.cours.dossier ? h('span', {}, 'Dossier choisi : ', h('code', {}, reglages.cours.dossier)) : 'Aucun dossier choisi.');
  };
  peindreDossier();

  const option = (valeur, titre, description, ...suite) => h('label', {},
    h('input', { type: 'radio', name: 'cours', value: valeur, checked: reglages.cours.mode === valeur, onChange: async () => {
      if (valeur === 'dossier' && !reglages.cours.dossier) {
        const r = await api.choisirCours();
        if (!r.ok) { if (r.message) note(r.message, { erreur: true, duree: 6000 }); document.querySelector('input[name=cours][value=integre]').checked = true; return; }
        reglages = await api.reglages();
        peindreDossier();
      }
      await enregistrer({ cours: { mode: valeur } });
      proposerRedemarrage();
    } }),
    h('span', {}, h('strong', {}, titre), h('span', {}, description), ...suite));

  return carte('cours', 'livre', 'Dossier des cours', `Cours affichés en ce moment : ${info.racine || '—'}`,
    h('div', { class: 'choix' },
      option('integre', 'Cours livrés avec Studies', `Mis à jour avec l’application. Copie locale : ${info.dossierLocal}.`,
        v.livre ? h('span', {}, h('br'), `Version des cours : ${date(v.livre.cree)}, ${v.livre.fichiers} fichiers.`) : null),
      option('dossier', 'Un dossier studies sur ce poste', 'Par exemple un clone git du dépôt : ton travail (tentatives, TD, suivi) y reste, et git pull le synchronise avec tes autres postes.', h('br'), dossierChoisi)),
    h('div', { class: 'ligne' },
      bouton('Choisir le dossier…', { onClick: async () => {
        const r = await api.choisirCours();
        if (!r.ok) { if (r.message) note(r.message, { erreur: true, duree: 6000 }); return; }
        reglages = await api.reglages();
        document.querySelector('input[name=cours][value=dossier]').checked = true;
        peindreDossier();
        proposerRedemarrage();
      } }),
      bouton('Ouvrir le dossier des cours', { genre: 'leger', onClick: () => api.ouvrirDossier('cours') })),
    h('p', { class: 'aide' }, 'Tes tentatives aux quiz et ton travail dans les TD sont enregistrés dans le dossier des cours (quiz_results, td_results). Ils ne font jamais partie des versions publiées de Studies.'));
}

/* -- À propos ------------------------------------------------------------------------- */

function carteAPropos() {
  return carte('a-propos', 'info', 'À propos', null,
    h('p', {}, `Studies ${info.version}, Electron ${info.electron}, ${info.installee ? 'version installée' : 'version de développement'}.`),
    h('p', { class: 'aide' }, 'Paramètres : ', h('code', {}, info.donnees)),
    h('div', { class: 'ligne' },
      bouton('Ouvrir le dossier des paramètres', { genre: 'leger', onClick: () => api.ouvrirDossier('donnees') }),
      bouton('Redémarrer Studies', { genre: 'leger', onClick: () => api.redemarrer() })));
}

/* -- Redémarrage ---------------------------------------------------------------------- */

let proposition = null;
function proposerRedemarrage() {
  if (proposition) return;
  proposition = h('div', { class: 'carte' },
    etat('alerte', 'Ce changement s’applique au prochain démarrage de Studies.'),
    h('div', { class: 'ligne' }, bouton('Redémarrer maintenant', { genre: 'principal', onClick: () => api.redemarrer() }), bouton('Plus tard', { genre: 'leger', onClick: () => { proposition.remove(); proposition = null; } })));
  document.getElementById('cartes').prepend(proposition);
  window.scrollTo({ top: 0 });
}

/* -- Page ------------------------------------------------------------------------------- */

document.getElementById('cartes').append(carteMisesAJour(), carteFenetre(), carteRaccourcis(), carteClaude(), carteCours(), carteAPropos());

const aller = (section) => { const el = section && document.getElementById(section); if (el) el.scrollIntoView(); };
aller(location.hash.slice(1));
api.surSection(aller);
