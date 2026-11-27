'use strict';
/* Extension ula du serveur local (_outils/quiz/serveur) : routes /api/ula/…
   (chargée par _outils/quiz/serveur/lib/extensions.js au démarrage).

     GET  etat                         racine, profils, profil actif, cours installés
     PUT  profil { nom }               choisit le profil actif (mémorisé sur le poste)
     POST profils { nom, cursus, telecharger }  crée un profil (et le choisit), avec un cursus exemple
     POST cursus/appliquer { id, telecharger }  range un cursus exemple dans l'espace du profil actif
     POST catalogue/installer-tout { ids }       téléchargements en arrière-plan ; GET catalogue/travail : leur état
     POST profils/renommer { ancien, nouveau }
     POST profils/supprimer { nom, confirmation }  supprime un profil et son espace (confirmation : le nom retapé)
     GET  cursus                       arbre du cursus du profil actif, avec les cours
     POST cursus/dossier { parent, nom }        crée un dossier de cursus
     POST cursus/renommer { chemin, nom }
     POST cursus/deplacer { chemin, vers }
     POST cursus/retirer { chemin }             dossier vide ou lien sans travail
     POST cursus/ajouter { cours, dossier, nom } ajoute un cours du catalogue (lien)
     GET  catalogue                    catalogue distant (release « catalogue ») et état local
     POST catalogue/installer { id }   télécharge (ou met à jour) un cours
     POST catalogue/installer-pack { id }  tous les cours d'un pack (reprend les manquants)
     POST cursus/ajouter-pack { cours: [ids], dossier }  range un pack dans un dossier du cursus
     POST catalogue/supprimer { id }   supprime un cours téléchargé (le travail reste)
     POST proposer { chemin, infos }   archive d'un cours de l'espace + adresse de l'issue
     POST ouvrir { chemin }            ouvre un dossier de la racine dans l'explorateur
     GET  soumissions                  soumissions du profil actif (« Mes soumissions »)
     GET  soumissions/actives          celles que montre le cadre en bas à droite
     GET  soumissions/apercu?chemin=   fiche et générations mesurées d'un cours (formulaire)
     POST soumissions { chemin, infos, declare, pseudonyme, licence }  crée et vérifie
          type pack ou cursus : { type, chemin (dossier du cursus), infos, pseudonyme, licence }
          type sources : { type, infos, pseudonyme, declarations } → brouillon, puis fichiers
     GET  soumissions/apercu-liste?type=&chemin=  pack ou cursus composé depuis un dossier
     POST soumissions/<id>/fichier { nom, donnees (base64) }  fichier d'un envoi de sources
     GET  soumissions/<id>             une soumission, avec son historique complet
     POST soumissions/<id>/action { action }  reverifier, corriger-ia, annuler, vue, envoyer,
                                       actualiser (état chez l'administrateur), exporter

   Administration des soumissions reçues (installation de l'administrateur, avec le
   jeton du service ; voir lib/admin.js) :
     GET  admin/etat                   { configure, depot }
     PUT  admin/jeton { jeton }        jeton gardé en mémoire (l'application le pose aussi
                                       dans l'environnement au démarrage) ; jamais relu
     GET  admin/soumissions?etat=      liste du service, avec l'état local (analyse, décision)
     GET  admin/soumissions/<id>       détail : manifeste, historique, analyse
     GET  admin/analyses               file des analyses en cours
     POST admin/analyser { ids, fournisseur }   analyses par l'IA choisie, une à une
     POST admin/soumissions/<id>/decision { decision, message, domaine, id, pack, remplacer }
     POST admin/soumissions/<id>/bloquer { raison }
     POST admin/soumissions/<id>/dossier       ouvre le dossier de l'archive téléchargée

   Tout ce qui s'écrit ici va dans l'espace du profil ; explore/ ne change que par
   le catalogue (installer, supprimer). Voir _outils/ula/README.md. */

const path = require('path');
const { spawn } = require('child_process');
const espace = require('../lib/espace');
const catalogue = require('../lib/catalogue');
const proposition = require('../lib/proposition');
const soumission = require('../lib/soumission');
const envoi = require('../lib/envoi');
const admin = require('../lib/admin');
const { tr } = require('../../quiz/serveur/lib/langue');

function etat(RACINE) {
  const profils = espace.profils(RACINE).map((p) => ({ nom: p.nom, cree: p.fiche.cree || null }));
  return {
    racine: RACINE,
    source: catalogue.estSource(RACINE),
    session: espace.nomSession(),
    profils,
    profil: espace.profilActif(RACINE),
    cours: espace.cours(RACINE).map((c) => ({
      id: c.id,
      domaine: c.domaine,
      chemin: c.chemin,
      titre: c.fiche.titre,
      niveau: c.fiche.niveau || '',
      origine: c.fiche.origine || '',
      teinte: c.fiche.teinte || '',
      description: c.fiche.description || '',
      accueil: require('fs').existsSync(path.join(RACINE, c.chemin, 'generated_courses', 'index.html'))
        ? c.chemin + '/generated_courses/index.html'
        : null,
    })),
  };
}

function profilRequis(RACINE) {
  const p = espace.profilActif(RACINE);
  if (!p)
    throw new Error(
      tr("Aucun profil choisi : le choisir ou le créer d'abord.", 'No profile selected: choose or create one first.'),
    );
  return p;
}

function ouvrirDossier(abs) {
  const cmd =
    process.platform === 'win32'
      ? ['explorer', [abs]]
      : process.platform === 'darwin'
        ? ['open', [abs]]
        : ['xdg-open', [abs]];
  spawn(cmd[0], cmd[1], { detached: true, stdio: 'ignore', windowsHide: false }).unref();
}

let installations = new Map(); // id -> { etat, journal, erreur }

/* Téléchargements en arrière-plan (cursus exemple, « Tout télécharger ») : une seule file
   à la fois ; des cours demandés pendant qu'elle tourne s'y ajoutent ; un cours déjà
   installé à la bonne version n'est pas retéléchargé ; un échec n'arrête pas les autres. */
let travail = null;
function lancerTravail(RACINE, ids) {
  if (travail && !travail.fin) {
    for (const id of ids) if (!travail.ids.includes(id)) travail.ids.push(id);
    return travail;
  }
  travail = { ids: [...new Set(ids)], faits: [], deja: [], erreurs: [], enCours: null, debut: Date.now(), fin: null };
  const t = travail;
  (async () => {
    for (let i = 0; i < t.ids.length; i++) {
      const id = t.ids[i];
      t.enCours = id;
      try {
        const { cours } = await catalogue.lister(RACINE);
        const c = cours.find((x) => x.id === id);
        if (!c) {
          t.erreurs.push({ id, erreur: tr('absent du catalogue', 'not in the catalogue') });
          continue;
        }
        if (c.etat === 'installe' || c.etat === 'source') {
          t.deja.push(id);
          continue;
        }
        await catalogue.installer(RACINE, id);
        t.faits.push(id);
      } catch (e) {
        t.erreurs.push({ id, erreur: e.message });
      }
    }
    t.enCours = null;
    t.fin = Date.now();
  })();
  return t;
}
function etatTravail() {
  if (!travail) return { actif: false };
  return {
    actif: !travail.fin,
    total: travail.ids.length,
    faits: travail.faits.length,
    deja: travail.deja.length,
    erreurs: travail.erreurs,
    enCours: travail.enCours,
    fin: travail.fin,
  };
}

/** Range un cursus exemple dans l'espace d'un profil (dossiers et liens), et lance au besoin
    le téléchargement de ses cours. Le catalogue en ligne doit répondre. */
async function appliquerCursus(RACINE, profil, id, telecharger) {
  const cat = await catalogue.lister(RACINE);
  const cu = cat.cursus.find((c) => c.id === id);
  if (!cu) throw new Error(tr(`Cursus exemple inconnu : ${id}`, `Unknown sample curriculum: ${id}`));
  const titres = Object.fromEntries(cat.cours.map((c) => [c.id, c.titre]));
  const dossiers = [];
  const ids = [];
  for (const l of cu.packs) {
    const r = espace.ajouterPack(RACINE, profil, l.cours, l.dossier, titres);
    dossiers.push(r.dossier);
    ids.push(...l.cours);
  }
  const aTelecharger = cat.source
    ? []
    : cat.cours.filter((c) => ids.includes(c.id) && (c.etat === 'absent' || c.etat === 'maj')).map((c) => c.id);
  if (telecharger && aTelecharger.length) lancerTravail(RACINE, aTelecharger);
  return {
    cursus: id,
    titre: cu.titre,
    dossiers,
    cours: [...new Set(ids)].length,
    aTelecharger: aTelecharger.length,
    telechargement: Boolean(telecharger && aTelecharger.length),
  };
}

// Les vérifications interrompues par l'arrêt du serveur deviennent suspendues, une fois
let soumissionsReprises = false;

async function routesSoumissions(route, m, RACINE, corps, ok, q) {
  if (!soumissionsReprises) {
    soumissionsReprises = true;
    soumission.reprendreInterrompues(RACINE);
  }
  const duProfil = (s) => s.profil === espace.profilActif(RACINE);
  if (route === 'soumissions' && m === 'GET') {
    const liste = soumission.lister(RACINE).filter(duProfil);
    envoi.actualiserAnciennes(RACINE, liste);
    return ok({ soumissions: liste.map(soumission.publique), service: envoi.service() });
  }
  if (route === 'soumissions/actives' && m === 'GET')
    return ok({ soumissions: soumission.actives(RACINE).filter(duProfil).map(soumission.publique) });
  if (route === 'soumissions/apercu' && m === 'GET')
    return ok(soumission.apercu(RACINE, profilRequis(RACINE), q.get('chemin') || ''));
  if (route === 'soumissions/apercu-liste' && m === 'GET')
    return ok(soumission.apercuListe(RACINE, profilRequis(RACINE), q.get('chemin') || '', q.get('type') || ''));
  if (route === 'soumissions' && m === 'POST') {
    const b = await corps();
    return ok(soumission.publique(soumission.creer(RACINE, profilRequis(RACINE), b, optionsSoumission(RACINE))));
  }
  const r = route.match(/^soumissions\/([0-9]{8}-[0-9]{6}-[0-9a-f]{6})(\/action|\/fichier)?$/);
  if (!r) return false;
  const s = soumission.lire(RACINE, r[1]);
  if (!duProfil(s)) throw new Error(tr('Soumission inconnue.', 'Unknown submission.'));
  if (!r[2] && m === 'GET') return ok(soumission.publique(s));
  if (r[2] === '/fichier' && m === 'POST') {
    // Un fichier de cours de profs (50 Mo au plus, en base64)
    const b = await corps(72 * 1024 * 1024);
    const x = soumission.ajouterFichier(RACINE, r[1], String(b.nom || ''), String(b.donnees || ''));
    return ok(soumission.publique(x));
  }
  if (r[2] && m === 'POST') {
    const b = await corps();
    return ok(soumission.publique(await agirSoumission(RACINE, r[1], String(b.action || ''))));
  }
  return false;
}

// Une soumission vérifiée part aussitôt vers le service de soumission
function optionsSoumission(RACINE) {
  return { apresVerification: (s) => envoi.envoyer(RACINE, s.id).catch(() => {}) };
}
async function agirSoumission(RACINE, id, action) {
  if (action === 'envoyer') {
    envoi.envoyer(RACINE, id).catch(() => {});
    await new Promise((r) => setTimeout(r, 50));
    return soumission.lire(RACINE, id);
  }
  if (action === 'actualiser') return envoi.actualiser(RACINE, id);
  if (action === 'exporter') {
    const s = soumission.lire(RACINE, id);
    ouvrirDossier(soumission.dossierDe(RACINE, id));
    return s;
  }
  return soumission.agir(RACINE, id, action, optionsSoumission(RACINE));
}

async function routesAdmin(route, m, RACINE, corps, ok, q, res, o) {
  const fs = require('fs');
  if (route === 'etat' && m === 'GET')
    return ok({
      configure: admin.configure(),
      depot: fs.existsSync(path.join(RACINE, 'app', 'scripts', 'accepter-proposition.mjs')),
    });
  if (route === 'jeton' && m === 'PUT') {
    const b = await corps();
    admin.definirJeton(b.jeton || '');
    return ok({ configure: admin.configure() });
  }
  if (route === 'soumissions' && m === 'GET')
    return ok({ soumissions: await admin.lister(RACINE, q.get('etat') || ''), service: envoi.service() });
  if (route === 'analyses' && m === 'GET') return ok(admin.etatAnalyses());
  if (route === 'analyser' && m === 'POST') {
    const b = await corps();
    return ok(admin.analyser(RACINE, (Array.isArray(b.ids) ? b.ids : []).map(String), String(b.fournisseur || '')));
  }
  const r = route.match(/^soumissions\/([0-9]{8}-[0-9a-f]{8})(?:\/(decision|bloquer|dossier))?$/);
  if (!r) return false;
  if (!r[2] && m === 'GET') return ok(await admin.detail(RACINE, r[1]));
  if (m !== 'POST') return false;
  const b = await corps();
  if (r[2] === 'decision') {
    try {
      return ok(await admin.decider(RACINE, r[1], b));
    } catch (e) {
      return o.envoyerJson(res, 422, { erreur: e.message, problemes: e.detail || [] });
    }
  }
  if (r[2] === 'bloquer') return ok(await admin.bloquer(RACINE, r[1], b.raison));
  if (r[2] === 'dossier') {
    await admin.telecharger(RACINE, r[1]);
    ouvrirDossier(admin.dossierDe(RACINE, r[1]));
    return ok({ ok: true });
  }
  return false;
}

async function api(route, req, res, o) {
  const { RACINE } = o.chemins;
  const m = req.method;
  const corps = (limite) => o.lireCorps(req, limite);
  const ok = (x) => o.envoyerJson(res, 200, x);
  try {
    if (route === 'etat' && m === 'GET') return ok(etat(RACINE));

    if (route === 'profil' && m === 'PUT') {
      const b = await corps();
      espace.choisirProfil(RACINE, b.nom === null ? null : String(b.nom));
      return ok(etat(RACINE));
    }
    if (route === 'profils' && m === 'POST') {
      const b = await corps();
      const n = espace.creerProfil(RACINE, b.nom);
      espace.choisirProfil(RACINE, n);
      // Cursus exemple : le profil est créé même si le catalogue ne répond pas
      let cursusExemple = null;
      if (b.cursus) {
        try {
          cursusExemple = await appliquerCursus(RACINE, n, String(b.cursus), b.telecharger !== false);
        } catch (e) {
          cursusExemple = {
            erreur: tr(
              `Profil créé, mais le cursus exemple n'a pas pu être rangé (${e.message}). Il s'ajoute plus tard depuis le catalogue en ligne de l'accueil.`,
              `Profile created, but the sample curriculum could not be added (${e.message}). It can be added later from the online catalogue on the home page.`,
            ),
          };
        }
      }
      return ok(Object.assign(etat(RACINE), { cursusExemple }));
    }
    if (route === 'cursus/appliquer' && m === 'POST') {
      const b = await corps();
      return ok(await appliquerCursus(RACINE, profilRequis(RACINE), String(b.id), b.telecharger !== false));
    }
    if (route === 'catalogue/installer-tout' && m === 'POST') {
      const b = await corps();
      lancerTravail(RACINE, (Array.isArray(b.ids) ? b.ids : []).map(String));
      return ok(etatTravail());
    }
    if (route === 'catalogue/travail' && m === 'GET') return ok(etatTravail());
    if (route === 'profils/renommer' && m === 'POST') {
      const b = await corps();
      espace.renommerProfil(RACINE, String(b.ancien), b.nouveau);
      return ok(etat(RACINE));
    }

    if (route === 'profils/supprimer' && m === 'POST') {
      const b = await corps();
      espace.supprimerProfil(RACINE, String(b.nom || ''), b.confirmation);
      return ok(etat(RACINE));
    }

    if (route === 'cursus' && m === 'GET') {
      const p = espace.profilActif(RACINE);
      if (!p) return ok({ profil: null, arbre: null });
      return ok({ profil: p, arbre: espace.arbre(RACINE, p) });
    }
    if (route.startsWith('cursus/') && m === 'POST') {
      const p = profilRequis(RACINE);
      const b = await corps();
      let chemin = null;
      if (route === 'cursus/dossier') chemin = espace.creerDossier(RACINE, p, b.parent || p, b.nom);
      else if (route === 'cursus/renommer') chemin = espace.renommer(RACINE, p, b.chemin, b.nom);
      else if (route === 'cursus/deplacer') chemin = espace.deplacer(RACINE, p, b.chemin, b.vers || p);
      else if (route === 'cursus/retirer') espace.retirer(RACINE, p, b.chemin);
      else if (route === 'cursus/ajouter')
        chemin = espace.ajouterCours(RACINE, p, String(b.cours), b.dossier || p, b.nom || null);
      else if (route === 'cursus/ajouter-pack') {
        const r = espace.ajouterPack(RACINE, p, (Array.isArray(b.cours) ? b.cours : []).map(String), b.dossier);
        return ok(Object.assign(r, { arbre: espace.arbre(RACINE, p) }));
      } else return false;
      return ok({ chemin, arbre: espace.arbre(RACINE, p) });
    }

    if (route === 'catalogue' && m === 'GET') {
      const r = await catalogue.lister(RACINE);
      r.installations = Object.fromEntries(installations);
      return ok(r);
    }
    if (route === 'catalogue/installer' && m === 'POST') {
      const b = await corps();
      const id = String(b.id);
      const suivi = { etat: 'en_cours', journal: [], erreur: null };
      installations.set(id, suivi);
      const r = await catalogue
        .installer(RACINE, id, (l) => suivi.journal.push(l))
        .catch((e) => {
          suivi.etat = 'erreur';
          suivi.erreur = e.message;
          throw e;
        });
      suivi.etat = 'terminee';
      return ok(r);
    }
    if (route === 'catalogue/installer-pack' && m === 'POST') {
      const b = await corps();
      return ok(await catalogue.installerPack(RACINE, String(b.id)));
    }
    if (route === 'catalogue/supprimer' && m === 'POST') {
      const b = await corps();
      return ok(catalogue.supprimer(RACINE, String(b.id)));
    }

    if (route === 'proposer' && m === 'POST') {
      const p = profilRequis(RACINE);
      const b = await corps();
      try {
        const r = proposition.preparer(RACINE, p, b.chemin, b.infos || {});
        return ok(Object.assign({}, r, { archive: o.chemins.relatif(r.archive) }));
      } catch (e) {
        return o.envoyerJson(res, 422, { erreur: e.message, problemes: e.problemes || [] });
      }
    }

    if (route.startsWith('admin/')) {
      const q = new URL(req.url, 'http://local').searchParams;
      const r = await routesAdmin(route.slice(6), m, RACINE, corps, ok, q, res, o);
      if (r !== false) return r;
    }

    if (route.startsWith('soumissions')) {
      const q = new URL(req.url, 'http://local').searchParams;
      const r = await routesSoumissions(route, m, RACINE, corps, ok, q);
      if (r !== false) return r;
    }

    if (route === 'ouvrir' && m === 'POST') {
      const b = await corps();
      const abs = path.resolve(RACINE, String(b.chemin || ''));
      if (!o.chemins.dansRacine(abs)) return o.erreur(res, 403, tr('Chemin refusé.', 'Path refused.'));
      ouvrirDossier(abs);
      return ok({ ok: true });
    }
  } catch (e) {
    return o.erreur(res, 400, e.message);
  }
  return false;
}

module.exports = { nom: 'ula', api };
