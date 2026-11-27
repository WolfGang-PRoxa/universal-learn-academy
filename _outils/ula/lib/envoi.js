'use strict';
/* Envoi des soumissions vérifiées au service de soumission (Cloudflare Worker de
   cloudflare/, https://ula.romainpiau.dev), puis suivi de leur état chez
   l'administrateur (reçue, en analyse, acceptée, refusée).

   L'installation se présente par une clé anonyme, tirée au hasard une fois
   (<racine>/soumissions/installation.json) : elle sert au service à limiter le débit et,
   au besoin, à bloquer une installation, sans rien savoir de la personne. Le service
   remet pour chaque soumission un jeton de suivi, gardé dans soumission.json : lui seul
   permet de lire l'état de la soumission.

   ULA_SOUMISSIONS_URL remplace l'adresse du service (essais avec `wrangler dev`). */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { tr } = require('../../quiz/serveur/lib/langue');
const soumission = require('./soumission');

const SERVICE = 'https://ula.romainpiau.dev';
const ETATS_DISTANTS = new Set(['recue', 'analyse', 'acceptee', 'refusee']);
const A_SUIVRE = new Set(['envoyee', 'recue', 'analyse']);
const INTERVALLE_SUIVI = 10 * 60 * 1000;

function service() {
  return (process.env.ULA_SOUMISSIONS_URL || SERVICE).replace(/\/+$/, '');
}

function cleInstallation(racine) {
  const f = path.join(racine, soumission.DOSSIER, 'installation.json');
  try {
    const c = JSON.parse(fs.readFileSync(f, 'utf8')).cle;
    if (/^[0-9a-f]{32,64}$/.test(c)) return c;
  } catch (e) {
    /* première soumission */
  }
  const cle = crypto.randomBytes(16).toString('hex');
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify({ cle, creee: new Date().toISOString() }, null, 2) + '\n');
  return cle;
}

// Événements du service ajoutés à l'historique local, sans doublon
function fusionnerHistorique(s, distant) {
  const vus = new Set(s.historique.map((h) => h.date + '|' + h.texte));
  for (const h of distant || []) {
    if (!h || vus.has(h.date + '|' + h.texte)) continue;
    s.historique.push({
      date: h.date,
      type: 'distant-' + String(h.type || 'note'),
      texte: String(h.texte).slice(0, 600),
    });
  }
  s.historique.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Envoie une soumission prête. Un échec réseau la laisse prête (à réessayer). */
async function envoyer(racine, id, options = {}) {
  const f = options.fetch || fetch;
  let s = soumission.lire(racine, id);
  if (s.etat !== 'prete')
    throw new Error(tr('Seule une soumission prête s’envoie.', 'Only a ready submission can be sent.'));
  s.etat = 'envoi';
  s.cadre = true;
  s.erreurEnvoi = null;
  soumission.noter(s, 'envoi', tr('Envoi au service de soumission…', 'Sending to the submission service…'));
  soumission.ecrire(racine, s);
  const fin = (etat, texte, maj) => {
    s = soumission.lire(racine, id);
    s.etat = etat;
    Object.assign(s, maj || {});
    soumission.noter(s, etat === 'envoyee' ? 'envoyee' : etat === 'suspendue' ? 'suspendue' : 'erreur-envoi', texte);
    return soumission.ecrire(racine, s);
  };
  try {
    const archive = fs.readFileSync(path.join(soumission.dossierDe(racine, id), 'cours.zip'));
    const form = new FormData();
    form.append('manifeste', JSON.stringify(soumission.manifeste(s)));
    form.append('archive', new Blob([archive], { type: 'application/zip' }), 'cours.zip');
    const r = await f(service() + '/v1/soumissions', {
      method: 'POST',
      body: form,
      headers: { 'X-ULA-Cle': cleInstallation(racine) },
      signal: AbortSignal.timeout(120000),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok && d.id && d.jeton) {
      s = soumission.lire(racine, id);
      s.distant = {
        id: d.id,
        jeton: d.jeton,
        etat: d.etat || 'recue',
        recue: d.recue,
        verifie: new Date().toISOString(),
      };
      fusionnerHistorique(s, d.historique);
      soumission.ecrire(racine, s);
      return fin('envoyee', tr(`Envoyée : soumission n° ${d.id}.`, `Sent: submission no. ${d.id}.`));
    }
    const message = d.erreur || tr(`Le service a répondu ${r.status}.`, `The service answered ${r.status}.`);
    // Refus du contrôle du serveur : à corriger comme une vérification locale échouée
    if (r.status === 422)
      return fin('suspendue', tr('Refusée par le contrôle du serveur : ', 'Refused by the server check: ') + message, {
        suspension: { raison: 'serveur', problemes: (d.problemes || [message]).slice(0, 80) },
      });
    return fin('prete', tr('Envoi impossible : ', 'Could not send: ') + message, { erreurEnvoi: message });
  } catch (e) {
    const message =
      e.name === 'TimeoutError'
        ? tr('le service ne répond pas', 'the service does not respond')
        : tr('service injoignable (réseau)', 'service unreachable (network)');
    return fin('prete', tr('Envoi impossible : ', 'Could not send: ') + message, { erreurEnvoi: message });
  }
}

/** Relit l'état d'une soumission envoyée chez l'administrateur. */
async function actualiser(racine, id, options = {}) {
  const f = options.fetch || fetch;
  let s = soumission.lire(racine, id);
  if (!s.distant) return s;
  try {
    const r = await f(service() + '/v1/soumissions/' + encodeURIComponent(s.distant.id), {
      headers: { Authorization: 'Bearer ' + s.distant.jeton },
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) return s;
    const d = await r.json();
    s = soumission.lire(racine, id);
    const avant = s.etat;
    if (ETATS_DISTANTS.has(d.etat)) s.etat = d.etat;
    s.distant = Object.assign(s.distant, {
      etat: d.etat,
      message: d.message || null,
      analyse: d.analyse || null,
      verifie: new Date().toISOString(),
    });
    fusionnerHistorique(s, d.historique);
    // Nouvelle étape chez l'administrateur : le cadre la montre
    if (s.etat !== avant) s.cadre = true;
    return soumission.ecrire(racine, s);
  } catch (e) {
    return s;
  }
}

/** Actualise en arrière-plan les soumissions en cours chez l'administrateur. */
function actualiserAnciennes(racine, liste) {
  for (const s of liste) {
    if (!s.distant || !A_SUIVRE.has(s.etat)) continue;
    const t = Date.parse(s.distant.verifie || 0) || 0;
    if (Date.now() - t > INTERVALLE_SUIVI) actualiser(racine, s.id).catch(() => {});
  }
}

module.exports = { SERVICE, service, envoyer, actualiser, actualiserAnciennes, cleInstallation };
