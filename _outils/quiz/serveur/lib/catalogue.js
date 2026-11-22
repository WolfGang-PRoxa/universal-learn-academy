'use strict';
/* Inventaire de studies/ : matières, cours générés, quiz et tentatives.
   Sert au portail, au contexte des demandes à Claude (texte d'une section de
   cours, plan des cours d'une matière) et à la génération de quiz. */

const fs = require('fs');
const path = require('path');
const { RACINE, relatif, espace } = require('./chemins');
const archives = require('./archives');

/* Texte d'une page HTML ------------------------------------------------------- */

const ENTITES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  rarr: '→',
  larr: '←',
  hellip: '…',
  laquo: '«',
  raquo: '»',
  ndash: '–',
  mdash: '—',
};

function decoder(t) {
  return t
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
      if (e[0] === '#')
        return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
      return ENTITES[e.toLowerCase()] !== undefined ? ENTITES[e.toLowerCase()] : m;
    })
    .replace(new RegExp(String.fromCharCode(160), 'g'), ' ');
}

// HTML -> texte lisible par Claude : blocs de code en ```, listes en « - »
function texteHtml(html) {
  let t = String(html);
  t = t.replace(/<(script|style|svg)\b[\s\S]*?<\/\1>/gi, ' ');
  t = t.replace(/<pre[^>]*>\s*<code([^>]*)>([\s\S]*?)<\/code>\s*<\/pre>/gi, (m, attrs, code) => {
    const lang = (attrs.match(/language-([\w+-]+)/) || [])[1] || '';
    return '\n```' + (lang === 'plaintext' ? '' : lang) + '\n' + decoder(code.replace(/<[^>]+>/g, '')) + '\n```\n';
  });
  t = t.replace(/<li[^>]*>/gi, '\n- ');
  t = t.replace(/<(td|th)[^>]*>/gi, ' | ');
  t = t.replace(/<br\s*\/?>|<\/(p|div|h[1-6]|tr|dt|dd|figcaption|summary|table|ul|ol)>/gi, '\n');
  t = t.replace(/<[^>]+>/g, '');
  t = decoder(t);
  return t
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/* Titres et ancres : même calcul que _outils/charte/assets/cours.js --------------------- */

function slug(texte) {
  const t = texte
    .normalize('NFD')
    .split('')
    .filter((c) => {
      const k = c.charCodeAt(0);
      return k < 0x300 || k > 0x36f;
    })
    .join('')
    .toLowerCase()
    .replace(/\\\(|\\\)|\\\[|\\\]/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return t || 'section';
}

function texteTitre(html) {
  const sans = html.replace(/<span[^>]*class="[^"]*\b(ref|badge|ancre)\b[^"]*"[^>]*>[\s\S]*?<\/span>/gi, '');
  return decoder(sans.replace(/<[^>]+>/g, ''))
    .replace(/\s+/g, ' ')
    .trim();
}

// Titres h2/h3 d'une page de cours : [{ niveau, texte, ancre, debut, fin }]
function titres(source) {
  const res = [];
  const pris = new Set();
  const debutMain = source.search(/<main\b/);
  const re = /<h([23])([^>]*)>([\s\S]*?)<\/h\1>/gi;
  let m;
  while ((m = re.exec(source))) {
    if (m.index < debutMain) continue;
    const texte = texteTitre(m[3]);
    const idExplicite = (m[2].match(/\bid="([^"]+)"/) || [])[1];
    let ancre = idExplicite;
    if (!ancre) {
      const base = slug(texte);
      ancre = base;
      let i = 2;
      while (pris.has(ancre)) ancre = base + '-' + i++;
    }
    pris.add(ancre);
    res.push({ niveau: Number(m[1]), texte, ancre, debut: m.index, fin: m.index + m[0].length });
  }
  return res;
}

function titrePage(source) {
  const h1 = source.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) return texteTitre(h1[1]);
  const t = source.match(/<title>([\s\S]*?)<\/title>/i);
  return t ? decoder(t[1]).split(' · ')[0].trim() : '';
}

// Texte de la section désignée par une ancre, jusqu'au titre suivant de même niveau
function extraireSection(fichier, ancre, max) {
  let source;
  try {
    source = fs.readFileSync(fichier, 'utf8');
  } catch (e) {
    return null;
  }
  const liste = titres(source);
  const i = liste.findIndex((t) => t.ancre === ancre);
  if (i < 0) return null;
  const t = liste[i];
  let fin = source.search(/<\/main>/i);
  for (let j = i + 1; j < liste.length; j++) {
    if (liste[j].niveau <= t.niveau) {
      fin = liste[j].debut;
      break;
    }
  }
  const texte = texteHtml(source.slice(t.fin, fin > t.fin ? fin : undefined));
  return { titre: titrePage(source), section: t.texte, texte: texte.slice(0, max || 8000) };
}

/* Inventaire -------------------------------------------------------------------- */

function lireSur(f) {
  try {
    return fs.readFileSync(f, 'utf8');
  } catch (e) {
    return '';
  }
}

function htmlDe(dossier) {
  try {
    return fs
      .readdirSync(dossier)
      .filter((n) => n.endsWith('.html'))
      .sort();
  } catch (e) {
    return [];
  }
}

function donneesQuiz(source) {
  const m = source.match(/<script[^>]*id="quiz-donnees"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch (e) {
    return null;
  }
}

function bilanTentatives(liste) {
  const finies = liste.filter((t) => t.statut === 'terminee');
  const enCours = liste.find((t) => t.statut === 'en_cours') || null;
  return {
    nombre: finies.length,
    meilleur: finies.length ? Math.max(...finies.map((t) => (t.score && t.score.pourcent) || 0)) : null,
    dernier: finies[0]
      ? {
          id: finies[0].id,
          date: finies[0].debut,
          pourcent: finies[0].score && finies[0].score.pourcent,
          fichier: finies[0].fichier,
        }
      : null,
    en_cours: enCours
      ? {
          id: enCours.id,
          fichier: enCours.fichier,
          position: enCours.position,
          nb: enCours.nb,
          repondues: enCours.repondues,
          maj: enCours.maj,
        }
      : null,
  };
}

function quizDe(dossierQuiz, liste) {
  for (const n of htmlDe(dossierQuiz)) {
    const source = lireSur(path.join(dossierQuiz, n));
    const d = donneesQuiz(source);
    if (!d) continue;
    const page = relatif(path.join(dossierQuiz, n));
    let tentatives = [];
    try {
      tentatives = archives.lister('/' + page);
    } catch (e) {
      /* page invalide */
    }
    liste.push({
      id: d.id,
      titre: titrePage(source),
      page,
      nb: (d.questions || []).length,
      types: [...new Set((d.questions || []).map((q) => q.type))],
      tentatives: bilanTentatives(tentatives),
    });
  }
}

/**
 * Un cours : ses pages (dossier de contenu, dans explore/ ou dans l'espace du profil)
 * et ses quiz, avec les tentatives du profil actif. `travail` : dossier du cours dans
 * l'espace du profil (quiz générés pour lui) ; `niveau` : son dossier de cursus.
 */
function matiere(dossier, { travail = null, niveau = null, fiche = null } = {}) {
  const rel = relatif(dossier);
  const cours = path.join(dossier, 'generated_courses');
  const index = lireSur(path.join(cours, 'index.html'));
  const teinte = (fiche && fiche.teinte) || (index.match(/data-matiere="([\w-]+)"/) || [])[1] || '';
  const res = {
    chemin: rel,
    id: fiche ? path.basename(dossier) : null,
    niveau: niveau || (fiche && fiche.niveau) || rel.split('/')[0],
    nom: (fiche && fiche.titre) || (index ? titrePage(index) : path.basename(dossier)),
    teinte,
    accueil: index ? rel + '/generated_courses/index.html' : null,
    travail: travail ? relatif(travail) : null,
    cours: [],
    quiz: [],
  };
  for (const n of htmlDe(cours)) {
    if (n === 'index.html') continue;
    res.cours.push({ titre: titrePage(lireSur(path.join(cours, n))), page: rel + '/generated_courses/' + n });
  }
  quizDe(path.join(dossier, 'generated_quizzes'), res.quiz);
  if (travail && path.resolve(travail) !== path.resolve(dossier))
    quizDe(path.join(travail, 'generated_quizzes'), res.quiz);
  return res;
}

// Cours d'un profil : ceux de son cursus (liens vers explore/), puis ses cours
// personnels (dossiers de son espace avec generated_courses ou generated_quizzes).
// Sans profil : tout le catalogue.
function dossiersMatieres() {
  const tous = espace.cours(RACINE);
  const p = espace.profilActif(RACINE);
  if (!p) return tous.map((c) => ({ dossier: path.join(RACINE, c.chemin), fiche: c.fiche }));
  const res = [];
  const vus = new Set();
  for (const l of espace.liens(RACINE, p)) {
    const c = tous.find((x) => x.id === l.cours);
    if (!c || vus.has(c.id)) continue;
    vus.add(c.id);
    const travail = path.join(RACINE, l.chemin);
    const segs = l.chemin.split('/');
    res.push({
      dossier: path.join(RACINE, c.chemin),
      fiche: c.fiche,
      travail,
      niveau: segs.length > 2 ? segs[segs.length - 2] : null,
    });
  }
  (function perso(n) {
    if (n.type === 'perso')
      res.push({
        dossier: path.join(RACINE, n.chemin),
        travail: path.join(RACINE, n.chemin),
        niveau: n.chemin.split('/').slice(-2, -1)[0],
      });
    for (const e of n.enfants || []) perso(e);
  })(espace.arbre(RACINE, p) || {});
  return res;
}

function inventaire() {
  const extensions = require('./extensions').lister();
  return dossiersMatieres().map((x) => {
    const m = matiere(x.dossier, x);
    // Les extensions (l'atelier) ajoutent ce qu'elles savent du cours
    for (const e of extensions) {
      if (typeof e.travauxMatiere === 'function') {
        try {
          m.travaux = (m.travaux || []).concat(e.travauxMatiere(x.dossier, relatif, x.travail || null));
        } catch (err) {
          /* extension en échec : ignorée */
        }
      }
    }
    return m;
  });
}

// Plan des cours d'une matière, avec des liens relatifs au dossier generated_quizzes
function planCours(dossierMatiere) {
  const cours = path.join(dossierMatiere, 'generated_courses');
  const lignes = [];
  for (const n of htmlDe(cours)) {
    if (n === 'index.html') continue;
    const source = lireSur(path.join(cours, n));
    lignes.push('- ' + titrePage(source) + ' : ../generated_courses/' + n);
    for (const t of titres(source)) {
      lignes.push((t.niveau === 2 ? '  - ' : '    - ') + t.texte + ' : ../generated_courses/' + n + '#' + t.ancre);
    }
  }
  return lignes.join('\n');
}

module.exports = { inventaire, matiere, planCours, extraireSection, texteHtml, titres, titrePage, slug, donneesQuiz };
