'use strict';
/* Jeton d'administration du service de soumission (cloudflare/, ula.romainpiau.dev) :
   seule l'installation de l'administrateur du catalogue en a un. Il est rangé chiffré
   par le système (safeStorage, comme les clés d'API), jamais renvoyé à l'interface, et
   passe au serveur local par l'environnement (ULA_ADMIN_JETON) au démarrage, ou par
   la route admin/jeton quand il change. Les soumissions reçues se gèrent ensuite dans
   l'accueil (section « Soumissions reçues », _outils/ula/lib/admin.js). */

const { safeStorage } = require('electron');
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

function statut() {
  return { configure: Boolean(jeton()), service: service() };
}

/** Enregistre (ou retire, valeur vide) le jeton, après l'avoir essayé auprès du service. */
async function enregistrer(valeur, apiQuiz) {
  const texte = String(valeur || '').trim();
  if (!texte) {
    reglages.modifier({ admin: { jeton: '' } });
    delete process.env.ULA_ADMIN_JETON;
    await apiQuiz('PUT', 'ula/admin/jeton', { jeton: '' }).catch(() => {});
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
  return { ok: true };
}

/** À appeler avant de démarrer le serveur local. */
function appliquer() {
  const j = jeton();
  if (j) process.env.ULA_ADMIN_JETON = j;
}

module.exports = { statut, enregistrer, appliquer };
