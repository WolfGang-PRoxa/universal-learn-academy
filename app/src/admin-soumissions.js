'use strict';
/* Jeton d'administration du service de soumission (cloudflare/, ula.romainpiau.dev) :
   seule l'installation de l'administrateur du catalogue en a un. Il est rangé chiffré
   par le système (safeStorage, comme les clés d'API), jamais renvoyé à l'interface, et
   passe au serveur local par l'environnement (ULA_ADMIN_JETON) au démarrage, ou par
   la route admin/jeton quand il change. Les soumissions reçues se gèrent ensuite dans
   l'accueil (section « Soumissions reçues », _outils/ula/lib/admin.js).

   Tant qu'un jeton est enregistré, le service est relevé toutes les 30 min (réglable :
   1 h, 2 h, 6 h, 12 h, 24 h), même application réduite dans la zone de notification ;
   chaque nouvelle soumission « reçue » donne une notification du système. */

const { Notification, safeStorage } = require('electron');
const { t } = require('./i18n');
const reglages = require('./reglages');
const { chiffrementDisponible } = require('./claude');

const SERVICE = 'https://ula.romainpiau.dev';

function service() {
  return (process.env.ULA_SOUMISSIONS_URL || SERVICE).replace(/\/+$/, '');
}

function jeton() {
  const enregistre = (reglages.lire().admin || {}).jeton;
  if (!enregistre || !enregistre.startsWith('enc:')) return '';
  try {
    return safeStorage.decryptString(Buffer.from(enregistre.slice(4), 'base64'));
  } catch (e) {
    return '';
  }
}

// Vérification automatique des soumissions reçues : toutes les 30 min par défaut
const INTERVALLES = [30, 60, 120, 360, 720, 1440];
const INTERVALLE_DEFAUT = 30;
let minuterie = null;
let derniere = null; // { date, recues, nouvelles, erreur }
let ouvrirSection = () => {};

function intervalle() {
  const m = Number((reglages.lire().admin || {}).intervalle);
  return INTERVALLES.includes(m) ? m : INTERVALLE_DEFAUT;
}

function statut() {
  return {
    configure: Boolean(jeton()),
    service: service(),
    intervalle: intervalle(),
    intervalles: INTERVALLES,
    derniere,
  };
}

/** Relève les soumissions à traiter ; une notification pour celles jamais vues. */
async function verifier() {
  const j = jeton();
  if (!j) return null;
  try {
    const r = await fetch(service() + '/v1/admin/soumissions?etat=recue', {
      headers: { Authorization: 'Bearer ' + j },
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) throw new Error(t('p.admin.statut', { statut: r.status }));
    const liste = (await r.json()).soumissions || [];
    const vues = new Set((reglages.lire().admin || {}).vues || []);
    const nouvelles = liste.filter((s) => !vues.has(s.id));
    derniere = { date: new Date().toISOString(), recues: liste.length, nouvelles: nouvelles.length, erreur: null };
    if (nouvelles.length) {
      reglages.modifier({ admin: { vues: [...vues, ...nouvelles.map((s) => s.id)].slice(-1000) } });
      if (Notification.isSupported()) {
        const n = new Notification({
          title: t('p.admin.notifTitre'),
          body:
            nouvelles.length === 1
              ? t('p.admin.notifUne', { titre: nouvelles[0].titre || nouvelles[0].id })
              : t('p.admin.notifPlusieurs', { n: nouvelles.length }),
        });
        n.on('click', () => ouvrirSection());
        n.show();
      }
    }
  } catch (e) {
    derniere = { date: new Date().toISOString(), recues: null, nouvelles: 0, erreur: e.message };
  }
  return derniere;
}

/** (Re)lance la vérification périodique ; rien sans jeton. */
function suivre(options = {}) {
  if (options.ouvrir) ouvrirSection = options.ouvrir;
  clearInterval(minuterie);
  minuterie = null;
  if (!jeton()) return;
  minuterie = setInterval(verifier, intervalle() * 60 * 1000);
  setTimeout(verifier, options.delai == null ? 60 * 1000 : options.delai);
}

function definirIntervalle(minutes) {
  const m = Number(minutes);
  if (!INTERVALLES.includes(m)) throw new Error(t('p.admin.intervalleInconnu'));
  reglages.modifier({ admin: { intervalle: m } });
  suivre({ delai: 0 });
  return statut();
}

/** Enregistre (ou retire, valeur vide) le jeton, après l'avoir essayé auprès du service. */
async function enregistrer(valeur, apiQuiz) {
  const texte = String(valeur || '').trim();
  if (!texte) {
    reglages.modifier({ admin: { jeton: '' } });
    delete process.env.ULA_ADMIN_JETON;
    await apiQuiz('PUT', 'ula/admin/jeton', { jeton: '' }).catch(() => {});
    suivre();
    derniere = null;
    return { ok: true, supprime: true };
  }
  if (!chiffrementDisponible()) throw new Error(t('c.sansTrousseau'));
  let r;
  try {
    r = await fetch(service() + '/v1/admin/soumissions?etat=recue', {
      headers: { Authorization: 'Bearer ' + texte },
      signal: AbortSignal.timeout(15000),
    });
  } catch (e) {
    throw new Error(t('p.admin.injoignable'), { cause: e });
  }
  if (r.status === 401) throw new Error(t('p.admin.refuse'));
  if (!r.ok) throw new Error(t('p.admin.statut', { statut: r.status }));
  reglages.modifier({ admin: { jeton: 'enc:' + safeStorage.encryptString(texte).toString('base64') } });
  process.env.ULA_ADMIN_JETON = texte;
  await apiQuiz('PUT', 'ula/admin/jeton', { jeton: texte }).catch(() => {});
  suivre({ delai: 0 });
  return { ok: true };
}

/** À appeler avant de démarrer le serveur local. */
function appliquer() {
  const j = jeton();
  if (j) process.env.ULA_ADMIN_JETON = j;
}

module.exports = { statut, enregistrer, appliquer, suivre, verifier, definirIntervalle, INTERVALLES };
