// Proposition de synchronisation automatique : texte selon le dépôt, réponse au
// processus principal (activer, plus tard, non), taille ajustée au contenu.
(async function () {
  "use strict";
  const api = window.proposition;
  const d = await api.infos();
  // Textes dans la langue de l'interface (clés « s.proposition. » de src/i18n)
  const x = d.textes;
  document.documentElement.lang = d.langue;
  document.title = x.titre;
  document.getElementById("titre").textContent = x.titre;
  document.getElementById("sous-titre").textContent = x.sousTitre;
  const [avant, apres] = x.depot.split("{depot}");
  const depot = document.createElement("code");
  depot.textContent = `${d.adresse || d.distant} (${d.branche})`;
  document.getElementById("intro").replaceChildren(avant, depot, apres || "");
  for (const li of document.querySelectorAll("[data-texte]")) li.textContent = x[li.dataset.texte];
  document.getElementById("perimetre").textContent = d.mode === "progression" ? x.perimetreProgression : x.perimetreTout;
  document.getElementById("aide").textContent = x.aide;
  for (const b of document.querySelectorAll("[data-choix]")) b.textContent = x[{ non: "non", "plus-tard": "plusTard", activer: "activer" }[b.dataset.choix]];
  for (const b of document.querySelectorAll("[data-choix]")) b.addEventListener("click", () => api.repondre(b.dataset.choix));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") api.repondre("plus-tard"); });
  // Hauteur de la fenêtre = hauteur du contenu
  requestAnimationFrame(() => api.taille(Math.ceil(document.querySelector(".proposition").getBoundingClientRect().height)));
})();
