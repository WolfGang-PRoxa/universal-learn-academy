/* ==========================================================================
   Quiz · outils communs (QuizApp.outils)
   Construction du DOM, textes, dates, mémoire du navigateur, presse-papiers,
   icônes. Aucun module ne dépend d'une bibliothèque externe.
   ========================================================================== */
(function (A) {
  "use strict";

  function el(balise, classe, texte) {
    var e = document.createElement(balise);
    if (classe) e.className = classe;
    if (texte != null) e.textContent = texte;
    return e;
  }
  function html(balise, classe, code) {
    var e = el(balise, classe);
    e.innerHTML = code == null ? "" : code;
    return e;
  }
  function bouton(texte, classe, action, icone) {
    var b = el("button", "bouton" + (classe ? " " + classe : ""));
    b.type = "button";
    if (icone) b.insertAdjacentHTML("beforeend", A.outils.icone(icone));
    if (texte) b.appendChild(el("span", null, texte));
    if (action) b.addEventListener("click", action);
    return b;
  }
  function echapper(t) {
    return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function indices(n) {
    var t = [];
    for (var i = 0; i < n; i++) t.push(i);
    return t;
  }
  function melanger(t) {
    var r = t.slice();
    for (var i = r.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var x = r[i]; r[i] = r[j]; r[j] = x;
    }
    return r;
  }
  // Retire les accents : on filtre les signes diacritiques (U+0300 à U+036F) après décomposition
  function sansAccents(t) {
    return t.normalize("NFD").split("").filter(function (c) {
      var k = c.charCodeAt(0);
      return k < 0x300 || k > 0x36f;
    }).join("");
  }
  function normaliser(s, casse, accents) {
    var t = String(s).trim().replace(/\s+/g, " ").replace(/[.;!]+$/, "");
    if (!casse) t = t.toLowerCase();
    if (!accents) t = sansAccents(t);
    return t;
  }
  function pourcent(x) { return Math.round((x || 0) * 100); }
  function chrono(ms) {
    var s = Math.round((ms || 0) / 1000), m = Math.floor(s / 60);
    s = s % 60;
    return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
  }
  function duree(ms) {
    var s = Math.round((ms || 0) / 1000);
    if (s < 60) return s + " s";
    var m = Math.floor(s / 60);
    if (m < 60) return m + " min" + (s % 60 ? " " + (s % 60) + " s" : "");
    return Math.floor(m / 60) + " h " + (m % 60) + " min";
  }
  function deux(n) { return (n < 10 ? "0" : "") + n; }
  // Identifiant de tentative : 2026-09-21_19-45-03
  function horodatage(d) {
    d = d || new Date();
    return d.getFullYear() + "-" + deux(d.getMonth() + 1) + "-" + deux(d.getDate()) + "_" +
      deux(d.getHours()) + "-" + deux(d.getMinutes()) + "-" + deux(d.getSeconds());
  }
  function dateLisible(iso, avecHeure) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d)) return String(iso);
    var t = d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
    return avecHeure === false ? t : t + " à " + deux(d.getHours()) + " h " + deux(d.getMinutes());
  }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === "x" ? r : (r & 3 | 8)).toString(16);
    });
  }

  // Typographie française : espace insécable avant : ; ? ! % et dans « », hors code
  function insecables(zone) {
    var marche = document.createTreeWalker(zone, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        return n.parentNode.closest("pre, code, kbd, script, style, textarea, .katex, .editeur")
          ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
    });
    var nb = String.fromCharCode(160), n;
    while ((n = marche.nextNode())) {
      var t = n.nodeValue
        .replace(/ ([:;?!%])/g, nb + "$1")
        .replace(/« /g, "«" + nb)
        .replace(/ »/g, nb + "»");
      if (t !== n.nodeValue) n.nodeValue = t;
    }
  }

  // Coloration du code, tableaux, liens et formules de la charte, puis extraits exécutables
  function enrichir(zone) {
    insecables(zone);
    var c = window.Charte;
    if (c) {
      try {
        c.preparerCode(zone);
        c.preparerTableaux(zone);
        c.preparerLiens(zone);
        c.rendreMaths(zone);
      } catch (e) { console.error("[quiz] enrichissement :", e); }
    }
    if (A.code && A.code.activerExtraits) A.code.activerExtraits(zone);
  }

  // HTML -> texte pour Claude et les archives : blocs de code entre ```, listes en « - »
  function texteDe(code) {
    if (code == null) return "";
    var d = document.createElement("div");
    d.innerHTML = String(code);
    d.querySelectorAll("pre").forEach(function (p) {
      var c = p.querySelector("code");
      var lang = ((c && c.className) || "").match(/language-([\w+-]+)/);
      p.replaceWith("\n```" + (lang && lang[1] !== "plaintext" ? lang[1] : "") + "\n" + p.textContent.replace(/\n$/, "") + "\n```\n");
    });
    d.querySelectorAll("li").forEach(function (li) { li.prepend("\n- "); });
    d.querySelectorAll("br").forEach(function (b) { b.replaceWith("\n"); });
    d.querySelectorAll("p, div, tr, h1, h2, h3, h4").forEach(function (b) { b.append("\n"); });
    d.querySelectorAll("td, th").forEach(function (b) { b.prepend(" | "); });
    return d.textContent.split("\n").map(function (l) { return l.replace(/[ \t]+/g, " ").replace(/\s+$/, ""); })
      .join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  /* Mémoire du navigateur (localStorage), toujours protégée ------------------ */

  function lireMemoire(cle) {
    try { return JSON.parse(localStorage.getItem(cle)); } catch (e) { return null; }
  }
  function ecrireMemoire(cle, valeur) {
    try { localStorage.setItem(cle, JSON.stringify(valeur)); return true; } catch (e) { return false; }
  }
  function supprimerMemoire(cle) {
    try { localStorage.removeItem(cle); } catch (e) { /* indisponible */ }
  }

  /* Presse-papiers et téléchargement ------------------------------------------ */

  function copier(texte) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(texte);
    return new Promise(function (resolve, reject) {
      var z = el("textarea");
      z.value = texte;
      z.setAttribute("readonly", "");
      z.className = "hors-ecran";
      document.body.appendChild(z);
      z.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      z.remove();
      (ok ? resolve : reject)();
    });
  }
  function telecharger(nom, contenu, type) {
    var blob = new Blob([contenu], { type: type || "application/json" });
    var a = el("a");
    a.href = URL.createObjectURL(blob);
    a.download = nom;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  /* Icônes (traits, couleur du texte) ------------------------------------------- */

  var ICONES = {
    claude: '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/><circle cx="12" cy="12" r="2.5"/>',
    indice: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6M10 22h4"/>',
    reglages: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    executer: '<path d="M7 5l12 7-12 7z"/>',
    envoyer: '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>',
    fermer: '<path d="M18 6L6 18M6 6l12 12"/>',
    historique: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 3"/>',
    telecharger: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    generer: '<path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z"/><path d="M19 3v4M17 5h4"/>',
    reprendre: '<path d="M5 4v16M19 12L9 18V6z"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    copier: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    // Tableau de bord : la maison est réservée à l'accueil général (bouton de la charte)
    portail: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    livre: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
    corbeille: '<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15"/>',
    verifier: '<path d="M20 6L9 17l-5-5"/>'
  };
  function icone(nom) {
    return '<svg class="icone" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      (ICONES[nom] || "") + "</svg>";
  }

  // Petit message temporaire en bas de l'écran
  function notifier(texte, type) {
    var zone = document.querySelector(".notifications");
    if (!zone) {
      zone = el("div", "notifications");
      zone.setAttribute("aria-live", "polite");
      document.body.appendChild(zone);
    }
    var n = el("div", "notification" + (type ? " " + type : ""), texte);
    zone.appendChild(n);
    setTimeout(function () { n.classList.add("sortie"); }, 3500);
    setTimeout(function () { n.remove(); }, 4000);
  }

  A.outils = {
    el: el, html: html, bouton: bouton, echapper: echapper, indices: indices, melanger: melanger,
    sansAccents: sansAccents, normaliser: normaliser, pourcent: pourcent, chrono: chrono, duree: duree,
    horodatage: horodatage, dateLisible: dateLisible, uuid: uuid, insecables: insecables, enrichir: enrichir,
    texteDe: texteDe, lireMemoire: lireMemoire, ecrireMemoire: ecrireMemoire, supprimerMemoire: supprimerMemoire,
    copier: copier, telecharger: telecharger, icone: icone, notifier: notifier
  };
})(window.QuizApp);
