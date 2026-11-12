/* ==========================================================================
   Atelier · historique d'annulation (Atelier.Historique)
   Garde des instantanés du modèle (en JSON). Un geste continu (glisser une
   classe, taper du texte) n'enregistre qu'un état : l'espace de travail
   appelle enregistrer() à la fin du geste.
   ========================================================================== */
(function (A) {
  "use strict";

  function Historique(max) {
    this.max = max || 100;
    this.etats = [];
    this.position = -1;
  }
  Historique.prototype.enregistrer = function (modele) {
    var s = JSON.stringify(modele);
    if (this.etats[this.position] === s) return false;
    this.etats = this.etats.slice(0, this.position + 1);
    this.etats.push(s);
    if (this.etats.length > this.max) this.etats.shift();
    this.position = this.etats.length - 1;
    return true;
  };
  Historique.prototype.peutAnnuler = function () { return this.position > 0; };
  Historique.prototype.peutRetablir = function () { return this.position < this.etats.length - 1; };
  Historique.prototype.annuler = function () {
    if (!this.peutAnnuler()) return null;
    this.position--;
    return JSON.parse(this.etats[this.position]);
  };
  Historique.prototype.retablir = function () {
    if (!this.peutRetablir()) return null;
    this.position++;
    return JSON.parse(this.etats[this.position]);
  };
  Historique.prototype.vider = function (modele) {
    this.etats = [];
    this.position = -1;
    if (modele) this.enregistrer(modele);
  };

  A.Historique = Historique;
})(window.Atelier);
