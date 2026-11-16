// Mise en forme du Markdown de la documentation (doc/contenu/<langue>/*.md).
// Sous-ensemble suffisant pour ces pages, sans dépendance : titres (avec ancres),
// paragraphes, listes (imbriquées par indentation), listes numérotées, blocs de code,
// citations (rendues en encadrés : « > **Note** … »), tableaux, filets, et en ligne :
// code, gras, italique, liens. Tout le texte est échappé.

const echapper = (x) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Ancre d'un titre : minuscules sans accents, mots reliés par des tirets. */
export function ancre(texte) {
  return texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/`/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function enLigne(texte) {
  // Le code d'abord, mis de côté pour que rien ne s'applique dedans
  const codes = [];
  let x = texte.replace(/`([^`]+)`/g, (_m, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  x = echapper(x);
  x = x.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, t, href) => `<a href="${href}">${t}</a>`);
  x = x.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  x = x.replace(/(^|[^\w*])\*([^*\s][^*]*?)\*(?!\w)/g, '$1<em>$2</em>');
  x = x.replace(/(^|[^\w])_([^_\s][^_]*?)_(?!\w)/g, '$1<em>$2</em>');
  return x.replace(/\u0000(\d+)\u0000/g, (_m, i) => `<code>${echapper(codes[Number(i)])}</code>`);
}

function cellules(ligne) {
  return ligne.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
}

/** Liste (puces ou numéros), imbriquée selon l'indentation. */
function liste(lignes) {
  const items = [];
  for (const l of lignes) {
    const m = l.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
    if (m) items.push({ niveau: m[1].length, ordonnee: /\d/.test(m[2]), texte: m[3] });
    else if (items.length) items[items.length - 1].texte += ' ' + l.trim();
  }
  let i = 0;
  function construire(niveau) {
    const balise = items[i].ordonnee ? 'ol' : 'ul';
    let html = '';
    while (i < items.length && items[i].niveau >= niveau) {
      // Sous-liste : rangée dans l'élément précédent
      if (items[i].niveau > niveau) { html = html.replace(/<\/li>$/, '') + construire(items[i].niveau) + '</li>'; continue; }
      html += `<li>${enLigne(items[i].texte)}</li>`;
      i++;
    }
    return `<${balise}>${html}</${balise}>`;
  }
  return construire(items[0].niveau);
}

/** HTML d'une page, et la liste de ses titres de niveau 2 (pour « Sur cette page »). */
export function rendre(md) {
  const lignes = md.split('\n');
  const sortie = [];
  const titres = [];
  let i = 0;
  const vide = (l) => !l || !l.trim();
  while (i < lignes.length) {
    const l = lignes[i];
    if (vide(l)) { i++; continue; }

    const bloc = l.match(/^```(\w*)/);
    if (bloc) {
      const code = [];
      i++;
      while (i < lignes.length && !/^```/.test(lignes[i])) code.push(lignes[i++]);
      i++;
      sortie.push(`<pre><code${bloc[1] ? ` class="langage-${bloc[1]}"` : ''}>${echapper(code.join('\n'))}</code></pre>`);
      continue;
    }

    const titre = l.match(/^(#{1,4})\s+(.+)$/);
    if (titre) {
      const n = titre[1].length;
      const id = ancre(titre[2]);
      if (n === 2) titres.push({ id, texte: titre[2].replace(/`/g, '') });
      sortie.push(`<h${n} id="${id}">${enLigne(titre[2])}</h${n}>`);
      i++;
      continue;
    }

    if (/^(-{3,}|\*{3,})\s*$/.test(l)) { sortie.push('<hr>'); i++; continue; }

    if (/^>/.test(l)) {
      const contenu = [];
      while (i < lignes.length && /^>/.test(lignes[i])) contenu.push(lignes[i++].replace(/^>\s?/, ''));
      const texte = contenu.join('\n');
      const genre = /^\*\*(Attention|Warning|Important)/i.test(texte) ? 'attention' : /^\*\*(Astuce|Tip)/i.test(texte) ? 'astuce' : 'note';
      sortie.push(`<aside class="encadre ${genre}">${rendre(texte).html}</aside>`);
      continue;
    }

    if (/^\|/.test(l) && i + 1 < lignes.length && /^\|?\s*:?-{2,}/.test(lignes[i + 1])) {
      const tete = cellules(l);
      i += 2;
      const corps = [];
      while (i < lignes.length && /^\|/.test(lignes[i])) corps.push(cellules(lignes[i++]));
      sortie.push(`<div class="tableau"><table><thead><tr>${tete.map((c) => `<th>${enLigne(c)}</th>`).join('')}</tr></thead><tbody>${corps.map((r) => `<tr>${r.map((c) => `<td>${enLigne(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }

    if (/^\s*([-*]|\d+\.)\s+/.test(l)) {
      const elements = [];
      while (i < lignes.length && !vide(lignes[i]) && (/^\s*([-*]|\d+\.)\s+/.test(lignes[i]) || /^\s{2,}\S/.test(lignes[i]))) elements.push(lignes[i++]);
      sortie.push(liste(elements));
      continue;
    }

    const paragraphe = [];
    while (i < lignes.length && !vide(lignes[i]) && !/^(#{1,4}\s|```|>|\||\s*([-*]|\d+\.)\s+)/.test(lignes[i])) paragraphe.push(lignes[i++].trim());
    if (!paragraphe.length) { sortie.push(`<p>${enLigne(lignes[i++])}</p>`); continue; }
    sortie.push(`<p>${enLigne(paragraphe.join(' '))}</p>`);
  }
  return { html: sortie.join('\n'), titres };
}
