"use strict";
/* Taille et position de la fenêtre au lancement (repris de CV Studio).
   Par défaut, la fenêtre s'ouvre agrandie sur l'écran principal. En mode
   personnalisé, elle s'ouvre aux bornes choisies dans les paramètres, sauf si
   elles ne sont plus visibles (écran débranché) : elle s'ouvre alors agrandie. */

const { screen } = require("electron");

const MIN_LARGEUR = 640;
const MIN_HAUTEUR = 480;

/** Écrans disponibles, en pixels indépendants de la résolution (DIP). */
function ecrans() {
  const principal = screen.getPrimaryDisplay().id;
  return screen.getAllDisplays().map((e, i) => ({
    id: e.id,
    index: i + 1,
    primary: e.id === principal,
    bounds: e.bounds,
    workArea: e.workArea,
    scaleFactor: e.scaleFactor
  }));
}

function intersection(a, b) {
  const l = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return l > 0 && h > 0 ? l * h : 0;
}

/** Bornes utilisables : au moins 30 % de la fenêtre doit être visible sur un écran. */
function bornesValides(b) {
  if (!b) return null;
  const r = {
    x: Math.round(Number(b.x)),
    y: Math.round(Number(b.y)),
    width: Math.max(MIN_LARGEUR, Math.round(Number(b.width))),
    height: Math.max(MIN_HAUTEUR, Math.round(Number(b.height)))
  };
  if (Object.values(r).some((v) => !Number.isFinite(v))) return null;
  const visible = screen.getAllDisplays().reduce((s, e) => s + intersection(r, e.workArea), 0);
  return visible >= r.width * r.height * 0.3 ? r : null;
}

/** { bornes, agrandie } d'après le réglage « fenetre » des paramètres. */
function etatInitial(reglage) {
  if (reglage && reglage.mode === "personnalisee") {
    const bornes = bornesValides(reglage.bornes);
    if (bornes) return { bornes, agrandie: false };
  }
  const { workArea } = screen.getPrimaryDisplay();
  const width = Math.min(1400, workArea.width);
  const height = Math.min(900, workArea.height);
  return {
    bornes: {
      x: workArea.x + Math.round((workArea.width - width) / 2),
      y: workArea.y + Math.round((workArea.height - height) / 2),
      width,
      height
    },
    agrandie: true
  };
}

module.exports = { MIN_LARGEUR, MIN_HAUTEUR, ecrans, bornesValides, etatInitial };
