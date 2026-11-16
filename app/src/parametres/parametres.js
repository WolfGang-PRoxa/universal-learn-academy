// Page des paramètres de l'application installée : mises à jour, fenêtre au
// lancement, raccourcis, connexion à Claude, profils, dossier des données, à propos.

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
  `Universal Learn Academy ${info.version}${info.installee ? '' : ' (développement)'} · Electron ${info.electron}`;

/* -- Mises à jour ------------------------------------------------------------ */

export function decrireMaj(s) {
  switch (s && s.etat) {
    case 'recherche': return ['', 'Recherche d’une mise à jour…'];
    case 'disponible': return ['', `Version ${s.version} disponible : téléchargement en cours…`];
    case 'telechargement': return ['', `Téléchargement de la mise à jour : ${s.pourcent ?? 0} %`];
    case 'pret': return ['ok', `Version ${s.version} prête : elle s’installera quand tu quitteras Universal Learn Academy (icône de la zone de notification › Quitter), ou tout de suite avec « Redémarrer et installer ».`];
    case 'a-jour': return ['ok', `Universal Learn Academy est à jour${s.viaGh ? ' (dépôt privé, lu avec GitHub CLI)' : ''}.`];
    case 'indisponible': return ['', s.message];
    case 'erreur': return ['erreur', `Échec de la recherche : ${s.message}`];
    default: return ['', 'Aucune recherche depuis le lancement.'];
  }
}

// « 6 heures », « 20 minutes »
function duree(ms) {
  const heures = ms / 3600000;
  if (heures >= 1) return `${Math.round(heures)} heure${Math.round(heures) > 1 ? 's' : ''}`;
  const minutes = Math.max(1, Math.round(ms / 60000));
  return `${minutes} minute${minutes > 1 ? 's' : ''}`;
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
      h('span', {}, h('strong', {}, 'Rechercher et installer les mises à jour automatiquement'),
        h('br'), h('span', { class: 'aide' }, `Au démarrage, puis toutes les ${duree(info.intervalleMaj || 21600000)} et au réveil du PC, même fenêtre fermée. La nouvelle version se télécharge en arrière-plan, une notification le dit, et elle s’installe quand tu quittes Universal Learn Academy (ou tout de suite avec « Redémarrer et installer »).`))),
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

  return carte('fenetre', 'ecran', 'Fenêtre au lancement', 'Taille et position de la fenêtre de Universal Learn Academy à chaque ouverture.',
    h('div', { class: 'choix' },
      option('agrandie', 'Grande fenêtre', 'Universal Learn Academy s’ouvre agrandi sur l’écran principal (réglage par défaut).'),
      option('personnalisee', 'Taille et position personnalisées', 'Universal Learn Academy s’ouvre exactement à l’endroit choisi ci-dessous ; si cet endroit n’est plus visible (écran débranché), il s’ouvre agrandi.')),
    perso);
}

/* -- Arrière-plan (fermeture de la fenêtre) -------------------------------------- */

function carteArrierePlan() {
  const actif = !reglages.arrierePlan || reglages.arrierePlan.fermeture !== false;
  const caseFermeture = h('input', { type: 'checkbox', checked: actif, disabled: !info.zoneNotification, onChange: async (e) => {
    await enregistrer({ arrierePlan: { fermeture: e.target.checked } });
    note(e.target.checked ? 'La croix gardera Universal Learn Academy en arrière-plan' : 'La croix quittera Universal Learn Academy');
  } });
  return carte('arriere-plan', 'arriere', 'Arrière-plan', 'Ce que fait la croix de la fenêtre.',
    h('label', { class: 'interrupteur' }, caseFermeture,
      h('span', {}, h('strong', {}, 'Garder Universal Learn Academy en arrière-plan quand je ferme la fenêtre'),
        h('br'), h('span', { class: 'aide' }, 'La fenêtre se cache et se rouvre aussitôt, à la même page, par l’icône de la zone de notification (en bas à droite de l’écran) ou en relançant l’application. Le serveur local continue : une génération de quiz va à son terme. Pour quitter : clic droit sur l’icône, puis Quitter (ou Ctrl+Q).'))),
    info.zoneNotification ? null : etat('alerte', 'Ce bureau n’a pas de zone de notification : la croix ferme l’application.'));
}

/* -- Échelle de l'interface ------------------------------------------------------ */

function carteAffichage() {
  const actuelle = (reglages.affichage && reglages.affichage.echelle) || 0;
  const options = [h('option', { value: '0' }, 'Automatique (100 %)')];
  for (let p = 50; p <= 200; p += 10) options.push(h('option', { value: String(p) }, `${p} %`));
  const choix = h('select', { class: 'saisie', id: 'echelle', onChange: async (e) => {
    const r = await enregistrer({ affichage: { echelle: Number(e.target.value) } });
    const v = (r.affichage && r.affichage.echelle) || 0;
    note(v ? `Échelle de l’interface : ${v} %` : 'Échelle automatique (100 %)');
  } }, ...options);
  choix.value = String(actuelle);
  return carte('affichage', 'echelle', 'Échelle de l’interface', 'Taille des textes, des boutons et des fiches dans toutes les fenêtres, paramètres compris.',
    h('label', { class: 'champ' }, h('span', {}, 'Échelle'), choix),
    h('p', { class: 'aide' }, 'En automatique, les pages s’adaptent seules à la largeur de la fenêtre : les accueils occupent toute la largeur et tout grandit sur un grand écran. Un pourcentage agrandit ou réduit tout en plus, tout de suite et à chaque lancement. Ctrl + et Ctrl − (ou Ctrl et la molette) ajustent en plus, jusqu’à la fermeture ; Ctrl 0 revient à l’échelle choisie ici.'));
}

/* -- Raccourcis ------------------------------------------------------------------ */

export function decrireRaccourci(l) {
  const nom = `« ${l.name || l.fichier} »`;
  const cible = l.currentTarget ? ` (${l.currentTarget})` : '';
  switch (l.status) {
    case 'ok': return ['ok', `Raccourci présent : ${nom}.`];
    case 'other-name': return ['ok', `Un raccourci vers Universal Learn Academy existe déjà sous un autre nom : ${nom}.`];
    case 'outdated': return ['alerte', `${nom} ouvre une autre copie de Universal Learn Academy${cible}. Il peut être réparé pour ouvrir cette installation.`];
    case 'broken': return ['alerte', `${nom} ne fonctionne plus : le programme qu’il ouvre n’existe plus${cible}.`];
    case 'foreign': return ['alerte', l.currentTarget ? `Un fichier ${nom} existe déjà, mais il ouvre un autre programme${cible}.` : `Un fichier ${nom} existe déjà, mais ce n’est pas un raccourci lisible.`];
    default: return ['', l.dirExiste === false ? 'Dossier introuvable.' : 'Aucun raccourci.'];
  }
}

function resultatRaccourci(r, libelle) {
  switch (r.outcome) {
    case 'created': return `Raccourci créé (${libelle}).`;
    case 'repaired': return `Raccourci réparé (${libelle}) : il ouvre maintenant cette installation.`;
    case 'replaced': return `L’ancien fichier a été remplacé par un raccourci vers Universal Learn Academy (${libelle}).`;
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
        if (!await confirmer({ titre: 'Supprimer le raccourci ?', message: `« ${l.name} » (${l.label}) sera mis à la corbeille. Universal Learn Academy n’est pas désinstallé.`, valider: 'Supprimer', danger: true })) return;
        r = await api.raccourcis.supprimer(l.id);
      } else {
        r = await api.raccourcis.creer(l.id);
        if (r.outcome === 'conflict') {
          if (!await confirmer({ titre: 'Remplacer le fichier existant ?', message: `${decrireRaccourci(r.location)[1]} Le remplacer par un raccourci vers Universal Learn Academy ?`, valider: 'Remplacer', danger: true })) { note('Le fichier existant a été conservé.'); return; }
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
    const autres = l.others && l.others.length ? h('span', { class: 'aide' }, `Autres raccourcis vers Universal Learn Academy : ${l.others.map((n) => `« ${n} »`).join(', ')}.`) : null;
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

  return carte('raccourcis', 'raccourci', 'Raccourcis', 'Ouvrir Universal Learn Academy depuis le Bureau, le menu Démarrer ou un dossier de ton choix.',
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
            if (!await confirmer({ titre: 'Déconnecter Claude Code ?', message: 'Claude Code sera déconnecté sur ce poste, pour Universal Learn Academy comme pour tes autres usages.', valider: 'Déconnecter', danger: true })) return;
            try { await api.claude.deconnecter(); note('Claude Code est déconnecté.'); } catch (e) { note(messageErreur(e), { erreur: true }); }
            actualiser();
          } }) : null,
          bouton('Vérifier', { genre: 'leger', onClick: actualiser })));
      }
    }
    zoneEtat.replaceChildren(...blocs);

    zoneCle.hidden = reglages.claude.mode !== 'cle';
    const cle = [];
    if (s.cleEnregistree && s.cleLisible) cle.push(etat('ok', s.cleActive ? 'Clé d’API enregistrée et utilisée.' : 'Clé d’API enregistrée : elle sera utilisée après le redémarrage de Universal Learn Academy.'));
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
      option('compte', 'Mon compte Claude, via Claude Code', 'Tu te connectes toi-même à Claude Code avec ton abonnement Claude (Pro, Max…). Universal Learn Academy ne voit jamais tes identifiants.'),
      option('cle', 'Une clé d’API Anthropic', 'Pour utiliser Claude sans abonnement : l’usage est facturé à la clé. Claude Code reste nécessaire.')),
    zoneEtat, zoneCle,
    h('p', { class: 'aide' }, 'Anthropic n’autorise pas une application tierce à proposer la connexion avec un compte claude.ai ni à conserver ses identifiants : la connexion par compte passe donc par Claude Code, chez Anthropic.'));
}

/* -- Modèles de Claude et exécution du code (ex-« Réglages » des quiz) ------------------- */

function carteModeles() {
  const zone = h('div', { class: 'modeles' }, etat('', 'Lecture des réglages du serveur local…'));
  let r = null;

  const chemin = h('input', { class: 'saisie', type: 'text', placeholder: 'Recherche automatique : PATH, extension VS Code…', spellcheck: false });

  async function enregistrer() {
    r.claude.executable = chemin.value.trim();
    await api.quiz.reglages(r);
  }

  function ligneUsage(id, usage, e) {
    const reglage = r.usages[id];
    const connu = e.modeles.some((m) => m.id === reglage.modele);
    const libre = h('input', { class: 'saisie', type: 'text', placeholder: 'claude-sonnet-5…', value: connu ? '' : reglage.modele,
      onInput: (ev) => { reglage.modele = ev.target.value.trim(); } });
    libre.hidden = connu;
    const modele = h('select', { class: 'saisie', 'aria-label': `Modèle · ${usage.libelle}`, onChange: (ev) => {
      libre.hidden = ev.target.value !== '__autre';
      reglage.modele = ev.target.value === '__autre' ? libre.value.trim() : ev.target.value;
    } },
    e.modeles.map((m) => h('option', { value: m.id, selected: connu && m.id === reglage.modele }, m.libelle)),
    h('option', { value: '__autre', selected: !connu }, 'Autre…'));
    const effort = h('select', { class: 'saisie', 'aria-label': `Effort · ${usage.libelle}`, onChange: (ev) => { reglage.effort = ev.target.value; } },
      e.efforts.map((x) => h('option', { value: x, selected: x === reglage.effort }, x ? `effort ${x}` : 'effort par défaut')));
    const resultat = h('span', { class: 'aide' });
    const tester = bouton('Tester', { genre: 'leger', onClick: async () => {
      tester.disabled = true;
      resultat.textContent = 'Enregistrement et test…';
      try {
        await enregistrer();
        const x = await api.quiz.tester(id);
        resultat.textContent = `OK · ${(x.modele || '').replace(/^claude-/, '')} · ${(x.duree / 1000).toFixed(1)} s`;
      } catch (err) { resultat.textContent = messageErreur(err).slice(0, 160); }
      finally { tester.disabled = false; }
    } });
    return h('div', { class: 'usage' },
      h('div', {}, h('strong', {}, usage.libelle), h('br'), h('span', { class: 'aide' }, usage.description)),
      h('div', { class: 'ligne' }, modele, libre, effort, tester),
      resultat);
  }

  async function charger() {
    try {
      const e = await api.quiz.etat();
      r = JSON.parse(JSON.stringify(e.reglages));
      chemin.value = r.claude.executable || '';
      const q = e.quota && e.quota.unifiedWindows;
      const quota = q ? `Abonnement : ${q.five_hour ? Math.round(q.five_hour.utilization * 100) + ' % de la fenêtre de 5 h' : ''}${q.seven_day ? ' · ' + Math.round(q.seven_day.utilization * 100) + ' % de la semaine' : ''}` : null;
      zone.replaceChildren(h('div', { class: 'modeles' },
        h('h3', {}, 'Claude Code utilisé par les quiz'),
        e.claude.disponible ? etat('ok', `Trouvé : version ${e.claude.version} (${e.claude.executable})`) : etat('alerte', e.claude.erreur),
        h('label', { class: 'champ' }, h('span', {}, 'Chemin de l’exécutable (vide : recherche automatique)'), chemin),
        quota ? h('p', { class: 'aide' }, quota) : null,
        h('h3', {}, 'Modèle pour chaque usage'),
        h('p', { class: 'aide' }, 'Avec un abonnement Pro, Sonnet, Opus et Haiku sont inclus ; Fable demande des crédits en plus. Opus donne les meilleures réponses mais consomme le quota plus vite ; l’effort règle le temps de réflexion. Avec une clé d’API, chaque appel est facturé.'),
        h('div', { class: 'usages' }, Object.entries(e.usages).map(([id, u]) => ligneUsage(id, u, e))),
        h('div', { class: 'ligne' },
          bouton('Enregistrer', { genre: 'principal', onClick: async () => {
            try { await enregistrer(); note('Réglages de Claude enregistrés.'); charger(); }
            catch (err) { note(messageErreur(err), { erreur: true }); }
          } }),
          bouton('Recharger', { genre: 'leger', onClick: charger })),
        h('h3', {}, 'Exécution du code des questions'),
        h('ul', { class: 'langages' }, Object.entries(e.executeurs).map(([k, v]) => h('li', { class: v ? 'ok' : 'ko' }, `${{ sql: 'SQL', javascript: 'JavaScript', python: 'Python', c: 'C', 'c-posix': 'C POSIX (WSL)' }[k] || k} : ${v || 'indisponible'}`)))));
    } catch (err) {
      zone.replaceChildren(etat('erreur', messageErreur(err)), h('div', { class: 'ligne' }, bouton('Réessayer', { genre: 'leger', onClick: charger })));
    }
  }

  charger();
  return carte('claude-modeles', 'claude', 'Modèles de Claude et exécution du code', 'Modèle et effort pour l’aide, la correction, l’évaluation et la génération de quiz ; langages exécutables dans les questions de code.', zone);
}

/* -- Profil ---------------------------------------------------------------------------- */

function carteProfils() {
  const zone = h('div', { class: 'pile' });

  async function charger() {
    zone.replaceChildren(h('p', { class: 'aide' }, 'Chargement…'));
    let e;
    try { e = await api.profils.etat(); }
    catch (err) { zone.replaceChildren(etat('erreur', messageErreur(err)), h('div', { class: 'ligne' }, bouton('Réessayer', { genre: 'leger', onClick: charger }))); return; }
    const nouveau = h('input', { class: 'saisie', type: 'text', value: e.profils.length ? '' : e.session, placeholder: e.session, spellcheck: 'false' });
    const choixCursus = h('select', { class: 'saisie' }, h('option', { value: '' }, 'Aucun : je compose mon cursus'));
    const telecharger = h('input', { type: 'checkbox', checked: true });
    api.profils.cursus().then((liste) => {
      for (const c of liste) choixCursus.append(h('option', { value: c.id }, `${c.titre} (${c.nombre} cours)`));
    });
    const creer = async () => {
      try {
        const r = await api.profils.creer(nouveau.value || e.session, choixCursus.value || null, telecharger.checked);
        const x = r.cursusExemple;
        note(x && x.erreur ? x.erreur : x ? `Profil créé : cursus « ${x.titre} » rangé (${x.cours} cours)${x.telechargement ? ', téléchargement en cours (suivi sur l’accueil)' : ''}.` : 'Profil créé et choisi.', { duree: 8000, erreur: Boolean(x && x.erreur) });
        charger();
      } catch (err) { note(messageErreur(err), { erreur: true, duree: 6000 }); }
    };
    const liste = e.profils.map((p) => h('label', {},
      h('input', { type: 'radio', name: 'profil', value: p.nom, checked: p.nom === e.profil, onChange: async () => {
        try { await api.profils.choisir(p.nom); note(`Profil « ${p.nom} » choisi : recharger les pages ouvertes.`); charger(); }
        catch (err) { note(messageErreur(err), { erreur: true }); }
      } }),
      h('span', {}, h('strong', {}, p.nom), h('span', {}, p.nom === e.profil ? 'Profil actif : la progression s’écrit dans son dossier.' : `Créé le ${p.cree || '—'}.`))));
    const renommer = h('input', { class: 'saisie', type: 'text', value: e.profil || '', spellcheck: 'false' });
    zone.replaceChildren(
      e.profils.length ? h('div', { class: 'choix' }, ...liste) : etat('alerte', 'Aucun profil : en créer un pour enregistrer ta progression.'),
      h('div', { class: 'champs' },
        h('label', { class: 'champ' }, h('span', {}, 'Nouveau profil (nom d’utilisateur)'), nouveau),
        h('label', { class: 'champ' }, h('span', {}, 'Cursus exemple'), choixCursus)),
      h('label', { class: 'interrupteur' }, telecharger, h('span', {}, 'Télécharger les cours maintenant')),
      h('div', { class: 'ligne' }, bouton('Ajouter', { genre: e.profils.length ? '' : 'principal', onClick: creer })),
      e.profil ? h('div', { class: 'champs avec-bouton' },
        h('label', { class: 'champ' }, h('span', {}, `Renommer « ${e.profil} »`), renommer),
        bouton('Renommer', { genre: 'leger', onClick: async () => {
          try { await api.profils.renommer(e.profil, renommer.value); note('Profil renommé.'); charger(); }
          catch (err) { note(messageErreur(err), { erreur: true, duree: 6000 }); }
        } })) : null,
      h('p', { class: 'aide' }, 'Chaque profil a son dossier dans le dossier des données : son cursus (dossiers libres et cours), ses tentatives, ses TD, ses TP et son suivi. Le profil choisi est mémorisé sur ce poste ; l’accueil permet aussi d’en changer.'));
  }

  charger();
  return carte('profil', 'menu', 'Profil', 'Qui travaille sur ce poste : la progression s’écrit dans le dossier du profil actif.', zone);
}

/* -- Dossier des données -------------------------------------------------------------- */

function carteDonnees() {
  const v = info.versionsOutils || {};
  const date = (iso) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
  const mode = {
    depot: 'Dépôt git d’ula : outils et catalogue sont ceux du dépôt (git pull et git push synchronisent tout).',
    installe: `Outils livrés avec l’application${v.livre ? ` (version du ${date(v.livre.cree)}, ${v.livre.fichiers} fichiers)` : ''}, copiés dans ${info.dossierLocal}.`,
    developpement: 'Développement : outils du dépôt de l’application.'
  }[info.modeDonnees] || '';
  return carte('donnees', 'dossier', 'Dossier des données', 'Le catalogue téléchargé (explore) et les dossiers des profils.',
    h('p', {}, 'En ce moment : ', h('code', {}, info.racine || '—')),
    h('p', { class: 'aide' }, mode),
    h('div', { class: 'ligne' },
      bouton('Choisir un autre dossier…', { onClick: async () => {
        const r = await api.donnees.choisir();
        if (!r.ok) { if (r.message) note(r.message, { erreur: true, duree: 6000 }); return; }
        note(r.depot ? 'Dépôt d’ula reconnu.' : 'Dossier choisi.');
        proposerRedemarrage();
      } }),
      bouton('Dossier par défaut', { genre: 'leger', onClick: async () => { const r = await api.donnees.defaut(); note(`Dossier par défaut : ${r.dossier}`); proposerRedemarrage(); } }),
      bouton('Ouvrir le dossier', { genre: 'leger', onClick: () => api.ouvrirDossier('donnees') })),
    h('p', { class: 'aide' }, `Par défaut : ${info.dossierParDefaut}. Les cours se téléchargent depuis le catalogue de l’accueil ; une mise à jour d’un cours ne touche jamais au travail rangé dans le dossier d’un profil.`));
}

/* -- Synchronisation ------------------------------------------------------------------ */

export function decrireSynchro(s) {
  if (!s) return ['', 'Chargement…'];
  if (s.enCours) return ['', 'Synchronisation en cours…'];
  const d = s.dernier;
  if (!d) return ['', s.auto ? 'Première synchronisation dans quelques secondes.' : 'Aucune synchronisation depuis le lancement.'];
  const quand = d.a ? new Date(d.a).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '';
  const bilan = [];
  if (d.commits) bilan.push('progression committée');
  if (d.recus && d.recus.length) bilan.push(`${d.recus.length} fichier${d.recus.length > 1 ? 's' : ''} reçu${d.recus.length > 1 ? 's' : ''}`);
  if (d.envoyes) bilan.push(`${d.envoyes} commit${d.envoyes > 1 ? 's' : ''} envoyé${d.envoyes > 1 ? 's' : ''}`);
  switch (d.etat) {
    case 'synchronise': return ['ok', `Synchronisé le ${quand} : ${bilan.join(', ')}.`];
    case 'a-jour': return ['ok', `À jour le ${quand}.`];
    case 'hors-ligne': return ['alerte', `${d.message} (${quand}) Nouvel essai au prochain cycle.`];
    case 'bloque': return ['alerte', `${d.message} (${quand})`];
    default: return ['erreur', `${d.message} (${quand})`];
  }
}

function carteSynchro() {
  const zone = h('div', {});
  const caseAuto = h('input', { type: 'checkbox', onChange: async (e) => {
    peindre(await api.synchro.auto(e.target.checked));
    note(e.target.checked ? 'Synchronisation automatique activée' : 'Synchronisation automatique désactivée');
  } });
  const maintenant = bouton('Synchroniser maintenant', { genre: 'principal', onClick: () => api.synchro.maintenant() });

  function peindre(s) {
    if (!s.visible) {
      caseAuto.checked = false;
      caseAuto.disabled = true;
      maintenant.disabled = true;
      zone.replaceChildren(
        etat('', s.raison || 'Le dossier des données n’est pas un dépôt Git suivi.'),
        h('p', { class: 'aide' }, s.git
          ? 'Pour synchroniser les cours entre plusieurs PC, le dossier des données doit être un dépôt Git relié à un dépôt distant (GitHub…). Le lier depuis l’application arrive dans une prochaine version ; en attendant : git init dans le dossier des données, un fichier .gitignore avec la ligne explore/ (le catalogue se retélécharge), git remote add origin <adresse>, un premier commit et git push -u origin main ; l’application le reconnaît au prochain lancement.'
          : 'Git n’est pas installé sur ce poste (git-scm.com) : la synchronisation par un dépôt Git n’est pas disponible.'));
      return;
    }
    caseAuto.checked = s.auto === true;
    caseAuto.disabled = false;
    maintenant.disabled = s.enCours;
    const [genre, texte] = decrireSynchro(s);
    const d = s.dernier;
    const conflits = d && d.conflits && d.conflits.length
      ? h('ul', { class: 'aide' }, ...d.conflits.map((c) => h('li', {}, h('code', {}, c.chemin), ` : ${c.regle}`, c.copie ? h('span', {}, ' (copie : ', h('code', {}, c.copie.split('/').pop()), ')') : null)))
      : null;
    const ignores = d && d.ignores && d.ignores.length
      ? etat('alerte', `Fichier${d.ignores.length > 1 ? 's' : ''} de plus de 50 Mo laissé${d.ignores.length > 1 ? 's' : ''} de côté : ${d.ignores.join(', ')}.`)
      : null;
    const avertissement = d && d.avertissement ? etat('alerte', d.avertissement) : null;
    zone.replaceChildren(...[
      h('p', {}, 'Dépôt : ', h('code', {}, s.adresse || s.distant), ` (branche ${s.branche} → ${s.distant}, Git ${s.git}).`),
      etat(genre, texte), avertissement, conflits, ignores,
      h('p', { class: 'aide' }, s.mode === 'progression'
        ? 'Dépôt d’ula : seule la progression faite dans l’application (quiz_results, td_results, liens du cursus) est committée automatiquement ; les autres modifications attendent un commit fait à la main. Les commits déjà faits sont envoyés avec elle. Un conflit sur un autre fichier arrête la fusion : elle est à faire à la main (git pull).'
        : 'Tout ce qui est dans les dossiers des profils est committé, jamais le catalogue (explore). Un fichier modifié sur deux postes entre deux synchros garde ses deux versions (« nom (conflit …) »), sauf la progression, fusionnée.')
    ].filter(Boolean));
  }

  api.synchro.statut().then(peindre);
  api.synchro.surStatut(peindre);

  return carte('synchro', 'nuage', 'Synchronisation', 'Retrouver ses cours et sa progression d’un PC à l’autre.',
    h('label', { class: 'interrupteur' }, caseAuto,
      h('span', {}, h('strong', {}, 'Synchroniser automatiquement'),
        h('br'), h('span', { class: 'aide' }, 'Au lancement, toutes les 30 minutes (même fenêtre fermée), au réveil du PC et en quittant Universal Learn Academy.'))),
    h('div', { class: 'ligne' }, maintenant, bouton('Ouvrir le dossier des données', { genre: 'leger', onClick: () => api.ouvrirDossier('donnees') })),
    zone,
    h('p', { class: 'aide' }, 'Git utilise les identifiants déjà enregistrés sur ce poste (Git Credential Manager, GitHub CLI, clé SSH) : l’application n’en demande ni n’en garde aucun. Un git pull fait à la main pendant que l’application tourne est repéré, et l’accueil se recharge.'));
}

/* -- À propos ------------------------------------------------------------------------- */

function carteAPropos() {
  return carte('a-propos', 'info', 'À propos', null,
    h('p', {}, `Universal Learn Academy ${info.version}, Electron ${info.electron}, ${info.installee ? 'version installée' : 'version de développement'}.`),
    h('p', { class: 'aide' }, 'Paramètres : ', h('code', {}, info.donnees)),
    info.journaux ? h('p', { class: 'aide' }, 'Journaux (dont gels.log, les blocages de l’application) : ', h('code', {}, info.journaux)) : null,
    h('div', { class: 'ligne' },
      bouton('Ouvrir le dossier des paramètres', { genre: 'leger', onClick: () => api.ouvrirDossier('parametres') }),
      info.journaux ? bouton('Ouvrir le dossier des journaux', { genre: 'leger', onClick: () => api.ouvrirDossier('journaux') }) : null,
      bouton('Redémarrer Universal Learn Academy', { genre: 'leger', onClick: () => api.redemarrer() })));
}

/* -- Redémarrage ---------------------------------------------------------------------- */

let proposition = null;
function proposerRedemarrage() {
  if (proposition) return;
  proposition = h('div', { class: 'carte large' },
    etat('alerte', 'Ce changement s’applique au prochain démarrage de Universal Learn Academy.'),
    h('div', { class: 'ligne' }, bouton('Redémarrer maintenant', { genre: 'principal', onClick: () => api.redemarrer() }), bouton('Plus tard', { genre: 'leger', onClick: () => { proposition.remove(); proposition = null; } })));
  document.getElementById('cartes').prepend(proposition);
  ranger();
  window.scrollTo({ top: 0 });
}

/* -- Page ------------------------------------------------------------------------------- */

const cartes = document.getElementById('cartes');
cartes.append(carteMisesAJour(), carteAffichage(), carteArrierePlan(), carteFenetre(), carteRaccourcis(), carteClaude(), carteModeles(), carteProfils(), carteDonnees(), carteSynchro(), carteAPropos());
// Cartes qui gardent toute la largeur (cadre des écrans, modèles par usage)
for (const id of ['fenetre', 'claude-modeles']) document.getElementById(id)?.classList.add('large');

/* Rangement en colonnes, sans trous (même logique que les blocs de l'accueil) :
   1 colonne sous 900 px de fenêtre, puis autant de colonnes d'au moins 420 px que
   la largeur en permet (3 au plus). L'ordre est gardé ; une carte large prend toute
   la ligne, et la dernière petite carte d'une ligne incomplète s'élargit jusqu'au
   bord. Toutes les cartes d'une ligne ont la même hauteur. */
const LARGEUR_MIN_CARTE = 420;
function colonnes() {
  if (window.innerWidth < 900) return 1;
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
    if (large) { finirLigne(i - 1); return; }
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
  const tailles = plan(liste.map((c) => c.classList.contains('large')), n);
  const cle = n + ':' + tailles.join(',');
  if (cle === dernierPlan) return;
  dernierPlan = cle;
  cartes.style.setProperty('--colonnes', String(n));
  liste.forEach((c, i) => { c.style.gridColumn = `span ${tailles[i]}`; });
}
ranger();
new ResizeObserver(() => ranger()).observe(cartes);

/* Navigation : sur le côté dès 900 px, section courante surlignée */
const liens = [...document.querySelectorAll('.sommaire a')];
function sectionCourante() {
  const seuil = 90;
  // La carte passée sous le haut de la fenêtre la plus basse ; sur une même ligne
  // de cartes, la première
  let courant = liens[0], haut = -Infinity;
  for (const a of liens) {
    const el = document.getElementById(a.getAttribute('href').slice(1));
    const top = el ? el.getBoundingClientRect().top : Infinity;
    if (top <= seuil && top > haut + 1) { courant = a; haut = top; }
  }
  // En bas de page : la dernière section
  if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) courant = liens[liens.length - 1];
  for (const a of liens) {
    const actif = a === courant;
    a.classList.toggle('actif', actif);
    if (actif) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
  }
}
let attenteSection = false;
window.addEventListener('scroll', () => {
  if (attenteSection) return;
  attenteSection = true;
  requestAnimationFrame(() => { attenteSection = false; sectionCourante(); });
}, { passive: true });
window.addEventListener('resize', sectionCourante);

const aller = (section) => { const el = section && document.getElementById(section); if (el) el.scrollIntoView(); sectionCourante(); };
aller(location.hash.slice(1));
api.surSection(aller);
sectionCourante();
