'use strict';
/* Exécute du SQL dans une base PostgreSQL neuve (PGlite, en mémoire).
   Lancé dans un worker_thread par executer.js, qui l'interrompt s'il dépasse
   le temps imparti. Reçoit { module, base, jeu, requetes: [texte…] } et renvoie,
   pour chaque texte, le résultat de sa dernière instruction qui produit des
   lignes (ou un compte rendu), ou l'erreur. */

const fs = require('fs');
const { parentPort, workerData } = require('worker_threads');

// Base neuve : depuis la copie d'une base déjà initialisée quand elle existe (1 s), sinon par une
// initialisation complète (6 à 8 s), dont on garde alors une copie pour les fois suivantes
async function baseNeuve(PGlite, base) {
  if (base && fs.existsSync(base)) {
    try {
      const db = new PGlite({ loadDataDir: new Blob([fs.readFileSync(base)]) });
      await db.waitReady;
      return db;
    } catch (e) {
      try {
        fs.unlinkSync(base);
      } catch (x) {
        /* déjà retirée */
      }
    }
  }
  const db = new PGlite();
  await db.waitReady;
  if (base) {
    try {
      const copie = Buffer.from(await (await db.dumpDataDir('none')).arrayBuffer());
      const tmp = base + '.' + process.pid + '-' + Date.now() + '.tmp';
      fs.writeFileSync(tmp, copie);
      fs.renameSync(tmp, base);
    } catch (e) {
      /* la copie servira une autre fois */
    }
  }
  return db;
}

function texte(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return isNaN(v) ? String(v) : v.toISOString().slice(0, 10);
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

(async () => {
  const { PGlite } = require(workerData.module);
  const db = await baseNeuve(PGlite, workerData.base);
  const sortie = { jeu: null, resultats: [] };
  try {
    if (workerData.jeu) {
      try {
        await db.exec(workerData.jeu);
      } catch (e) {
        sortie.jeu = e.message;
      }
    }
    for (const requete of workerData.requetes) {
      if (sortie.jeu) {
        sortie.resultats.push({ erreur: "Le jeu de données n'a pas pu être créé : " + sortie.jeu });
        continue;
      }
      try {
        await db.exec('BEGIN');
        const res = await db.exec(requete);
        await db.exec('ROLLBACK'); // chaque requête repart des mêmes données
        let dernier = null;
        for (const r of res) if (r.fields && r.fields.length) dernier = r;
        if (dernier) {
          const colonnes = dernier.fields.map((f) => f.name);
          sortie.resultats.push({
            colonnes,
            lignes: dernier.rows.slice(0, 500).map((l) => colonnes.map((c) => texte(l[c]))),
            total: dernier.rows.length,
          });
        } else {
          const n = res.length ? res[res.length - 1].affectedRows : 0;
          sortie.resultats.push({
            message: 'Instruction exécutée' + (n ? ' (' + n + ' ligne' + (n > 1 ? 's' : '') + ')' : '') + '.',
          });
        }
      } catch (e) {
        try {
          await db.exec('ROLLBACK');
        } catch (x) {
          /* rien à annuler */
        }
        sortie.resultats.push({ erreur: e.message });
      }
    }
  } finally {
    try {
      await db.close();
    } catch (e) {
      /* déjà fermée */
    }
  }
  parentPort.postMessage(sortie);
})().catch((e) => parentPort.postMessage({ fatal: e.message }));
