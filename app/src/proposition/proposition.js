// Proposition de synchronisation automatique : texte selon le dépôt, réponse au
// processus principal (activer, plus tard, non), taille ajustée au contenu.
(async function () {
  "use strict";
  const api = window.proposition;
  const d = await api.infos();
  document.getElementById("depot").textContent = `${d.adresse || d.distant} (branche ${d.branche})`;
  document.getElementById("perimetre").textContent = d.mode === "progression"
    ? "Dépôt d’ula : seule la progression faite dans l’application (quiz, TD, cursus) est committée automatiquement. Les autres modifications attendent un commit fait à la main."
    : "Tout ce qui est rangé dans les dossiers des profils est committé ; le catalogue (explore) ne l’est jamais.";
  for (const b of document.querySelectorAll("[data-choix]")) b.addEventListener("click", () => api.repondre(b.dataset.choix));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") api.repondre("plus-tard"); });
  // Hauteur de la fenêtre = hauteur du contenu
  requestAnimationFrame(() => api.taille(Math.ceil(document.querySelector(".proposition").getBoundingClientRect().height)));
})();
