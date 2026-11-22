'use strict';
/* Dépôts GitHub de l'application.
   - Le dépôt public (universal-learn-academy) reçoit le contenu publiable et les
     releases : c'est lui que lisent les mises à jour. Doit correspondre à
     « build.publish » de package.json.
   - Le dépôt de travail (studies) reste privé : tentatives, TD, TODO, TP en cours. */

const DEPOT_PUBLIC = { proprietaire: 'WolfGang-PRoxa', nom: 'universal-learn-academy' };
const DEPOT = DEPOT_PUBLIC; // releases et mises à jour
const ID_APP = 'fr.wolfgangproxa.studies';

module.exports = {
  DEPOT,
  DEPOT_PUBLIC,
  ID_APP,
  URL_RELEASES: `https://github.com/${DEPOT.proprietaire}/${DEPOT.nom}/releases`,
};
