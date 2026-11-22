/* ==========================================================================
   Atelier · sauvegarde du travail (Atelier.Sauvegarde)
   --------------------------------------------------------------------------
   Le travail de chaque atelier d'une page est gardé :
     - dans le navigateur, tout de suite (localStorage) ;
     - avec le serveur local, dans le dossier de la matière :
       <Niveau>/<Matière>/td_results/<page>.json (un fichier par page,
       tous ses ateliers), une seconde après la dernière modification.
   Au chargement, la version la plus récente l'emporte.
   ========================================================================== */
(function (A) {
  'use strict';

  var PREFIXE = 'atelier:travail:';

  function Q() {
    return window.QuizApp || null;
  }
  function connecte() {
    var q = Q();
    return Boolean(q && q.connexion && q.connexion.enLigne);
  }

  function Sauvegarde(page) {
    this.page = page;
    this.etats = {};
    this.minuteries = {};
    this.enAttente = {};
    var self = this;
    window.addEventListener('pagehide', function () {
      self.vider(true);
    });
  }
  var P = Sauvegarde.prototype;

  P.cle = function (id) {
    return PREFIXE + this.page + '#' + id;
  };

  P.charger = function () {
    var self = this;
    if (!connecte()) return Promise.resolve(this);
    return Q()
      .connexion.json('GET', 'atelier/travail?page=' + encodeURIComponent(this.page))
      .then(function (d) {
        var ateliers = (d && d.ateliers) || {};
        Object.keys(ateliers).forEach(function (id) {
          var local = self.lireLocal(id),
            serveur = ateliers[id];
          if (!local || (serveur.maj || '') >= (local.maj || '')) self.etats[id] = serveur;
        });
        return self;
      })
      .catch(function (e) {
        console.warn('[atelier] travail non chargé depuis le serveur :', e.message);
        return self;
      });
  };

  P.lireLocal = function (id) {
    try {
      return JSON.parse(localStorage.getItem(this.cle(id)));
    } catch (e) {
      return null;
    }
  };

  P.lire = function (id) {
    return this.etats[id] || this.lireLocal(id) || null;
  };

  // rappel(statut) : "local", "en-cours", "serveur", "erreur"
  P.enregistrer = function (id, etat, rappel) {
    this.etats[id] = etat;
    try {
      localStorage.setItem(this.cle(id), JSON.stringify(etat));
    } catch (e) {
      /* quota ou navigation privée */
    }
    if (rappel) rappel('local');
    if (!connecte()) return;
    var self = this;
    this.enAttente[id] = { etat: etat, rappel: rappel };
    clearTimeout(this.minuteries[id]);
    this.minuteries[id] = setTimeout(function () {
      self.envoyer(id);
    }, 1000);
  };

  P.envoyer = function (id, keepalive) {
    var x = this.enAttente[id];
    if (!x) return;
    delete this.enAttente[id];
    if (x.rappel) x.rappel('en-cours');
    Q()
      .connexion.json('POST', 'atelier/travail', { page: this.page, id: id, etat: x.etat }, { keepalive: keepalive })
      .then(function () {
        if (x.rappel) x.rappel('serveur');
      })
      .catch(function (e) {
        console.warn('[atelier] enregistrement sur le serveur impossible :', e.message);
        if (x.rappel) x.rappel('erreur');
      });
  };

  // Envoie tout ce qui attend (fermeture de la page)
  P.vider = function (keepalive) {
    var self = this;
    Object.keys(this.enAttente).forEach(function (id) {
      clearTimeout(self.minuteries[id]);
      self.envoyer(id, keepalive);
    });
  };

  A.Sauvegarde = Sauvegarde;
})(window.Atelier);
