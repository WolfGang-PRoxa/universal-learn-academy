// Choix de la langue au premier lancement : une carte par langue, celle du système
// proposée (focus, mention « langue du système ») ; le titre et l'aide passent dans
// la langue de la carte survolée ou sélectionnée au clavier.
(async function () {
  "use strict";
  const api = window.choixLangue;
  // Textes de cette seule fenêtre, dans chaque langue proposée
  const TEXTES = {
    fr: { titre: "Choisir la langue", aide: "Langue des menus, des paramètres, de l’accueil et de la documentation. Modifiable à tout moment dans Paramètres › Langue.", detail: "Interface en français", systeme: "Langue du système" },
    en: { titre: "Choose your language", aide: "Language of the menus, settings, home page and documentation. Can be changed at any time in Settings › Language.", detail: "English interface", systeme: "System language" }
  };
  const d = await api.infos();
  const titre = document.getElementById("titre");
  const aide = document.getElementById("aide");
  const montrer = (code) => {
    const x = TEXTES[code] || TEXTES.en;
    document.documentElement.lang = code;
    titre.textContent = x.titre;
    aide.textContent = x.aide;
  };
  const zone = document.getElementById("options");
  for (const l of d.langues) {
    const x = TEXTES[l.code] || TEXTES.en;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "option" + (l.code === d.proposee ? " proposee" : "");
    b.lang = l.code;
    const nom = document.createElement("strong");
    nom.textContent = l.nom;
    const detail = document.createElement("span");
    detail.textContent = x.detail;
    b.append(nom, detail);
    if (l.code === d.proposee) {
      const s = document.createElement("span");
      s.className = "systeme";
      s.textContent = x.systeme;
      b.append(s);
    }
    b.addEventListener("click", () => api.choisir(l.code));
    b.addEventListener("mouseenter", () => montrer(l.code));
    b.addEventListener("focus", () => montrer(l.code));
    zone.append(b);
  }
  montrer(d.proposee);
  const proposee = zone.querySelector(".proposee") || zone.firstElementChild;
  if (proposee) proposee.focus();
  // Flèches gauche et droite : d'une langue à l'autre
  zone.addEventListener("keydown", (e) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    const liste = [...zone.children];
    const i = liste.indexOf(document.activeElement);
    const pas = e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1;
    liste[(i + pas + liste.length) % liste.length].focus();
    e.preventDefault();
  });
  requestAnimationFrame(() => api.taille(Math.ceil(document.querySelector(".langue").getBoundingClientRect().height)));
})();
