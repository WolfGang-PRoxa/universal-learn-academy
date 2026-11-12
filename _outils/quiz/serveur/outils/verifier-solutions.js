#!/usr/bin/env node
"use strict";
/* Exécute les solutions d'un quiz pour vérifier qu'elles sont justes.
   Appelé par _outils/quiz/outils/verifier_quiz.py --executer, qui envoie sur
   l'entrée standard le bloc de données du quiz (JSON). Écrit sur la sortie
   standard une liste [{ id, ok, message }] :
     - question « code » en SQL : la solution s'exécute sans erreur sur son
       jeu de données et renvoie des lignes ;
     - question « code » en Python, JavaScript, C ou C POSIX : la solution (avec le
       harnais) passe tous ses tests ;
     - extrait <pre data-executer="sql"> d'un énoncé ou d'une explication :
       il s'exécute sans erreur. */

const executer = require("../lib/executer");

function lireEntree() {
  return new Promise((resolve) => {
    let t = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (m) => { t += m; });
    process.stdin.on("end", () => resolve(t));
  });
}

function decoder(t) {
  return t.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
}

function normal(t) {
  return String(t || "").split("\n").map((l) => l.replace(/\s+$/, "")).join("\n").replace(/\n+$/, "");
}

// Extraits exécutables : <pre data-executer='sql' data-jeu='emp'><code …>…</code></pre>
function extraits(html) {
  const res = [];
  const re = /<pre[^>]*data-executer=['"]([\w]+)['"][^>]*>\s*<code[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/g;
  let m;
  while ((m = re.exec(String(html || "")))) {
    const jeu = (m[0].match(/data-jeu=['"]([\w-]+)['"]/) || [])[1];
    res.push({ langage: m[1], code: decoder(m[2].replace(/<[^>]+>/g, "")), jeu });
  }
  return res;
}

(async () => {
  const d = JSON.parse(await lireEntree());
  const jeux = d.jeux || {};
  const dispo = executer.disponibilite();
  const sortie = [];
  for (const q of d.questions || []) {
    const script = (nom) => (nom && jeux[nom] ? jeux[nom].script : "");
    for (const champ of ["enonce", "explication"]) {
      for (const x of extraits(q[champ])) {
        if (x.langage !== "sql" || !dispo.sql) continue;
        const r = await executer.executer({ langage: "sql", jeu: script(x.jeu), code: x.code });
        const e = r.erreur || (r.resultats || []).map((y) => y.erreur).filter(Boolean)[0];
        sortie.push({ id: q.id, ok: !e, message: e ? "extrait exécutable (" + champ + ") : " + e : "extrait exécutable (" + champ + ") : OK" });
      }
    }
    if (q.type !== "code") continue;
    if (!dispo[q.langage]) { sortie.push({ id: q.id, ok: null, message: "langage « " + q.langage + " » indisponible : solution non vérifiée" }); continue; }
    if (!q.solution) { sortie.push({ id: q.id, ok: null, message: "pas de solution de référence" }); continue; }
    if (q.langage === "sql") {
      if (q.jeu && !jeux[q.jeu]) { sortie.push({ id: q.id, ok: false, message: "jeu de données « " + q.jeu + " » absent de « jeux »" }); continue; }
      const r = await executer.executer({ langage: "sql", jeu: script(q.jeu), requetes: [q.solution] });
      const x = r.resultats ? r.resultats[0] : null;
      if (r.erreur || !x) sortie.push({ id: q.id, ok: false, message: "solution : " + (r.erreur || "aucun résultat") });
      else if (x.erreur) sortie.push({ id: q.id, ok: false, message: "solution : " + x.erreur });
      else if (!x.colonnes) sortie.push({ id: q.id, ok: false, message: "la solution ne renvoie pas de lignes : " + (x.message || "") });
      else sortie.push({ id: q.id, ok: true, message: "solution : " + x.total + " ligne(s), colonnes " + x.colonnes.join(", ") });
      continue;
    }
    const tests = Array.isArray(q.tests) && q.tests.length ? q.tests : (q.sortie != null ? [{ entree: q.entree || "", sortie: q.sortie }] : []);
    if (!tests.length) { sortie.push({ id: q.id, ok: null, message: "pas de test : solution non vérifiée" }); continue; }
    const code = q.solution + (q.harnais ? "\n" + q.harnais : "");
    const r = await executer.executer({ langage: q.langage, code, entrees: tests.map((t) => t.entree || "") });
    if (r.compilation) { sortie.push({ id: q.id, ok: false, message: "la solution ne compile pas : " + r.compilation.slice(0, 300) }); continue; }
    if (r.erreur) { sortie.push({ id: q.id, ok: false, message: r.erreur }); continue; }
    const rates = tests.map((t, i) => ({ t, x: r.executions[i] || {} })).filter((c) => normal(c.x.sortie) !== normal(c.t.sortie));
    sortie.push({
      id: q.id,
      ok: !rates.length,
      message: rates.length
        ? "la solution échoue à " + rates.length + " test(s) sur " + tests.length + " ; premier : attendu " + JSON.stringify(rates[0].t.sortie) + ", obtenu " + JSON.stringify(rates[0].x.sortie || "") + (rates[0].x.erreur ? " (" + rates[0].x.erreur.trim().slice(0, 200) + ")" : "")
        : "solution : " + tests.length + " test(s) réussi(s)"
    });
  }
  process.stdout.write(JSON.stringify(sortie));
})().catch((e) => { process.stderr.write(String(e && e.stack || e)); process.exit(1); });
