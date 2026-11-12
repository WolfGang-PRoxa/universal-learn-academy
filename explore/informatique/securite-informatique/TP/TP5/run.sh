#!/bin/bash
#
# TP 5 (connexion TLS a un serveur web) sans Raspberry Pi : un conteneur
# Docker joue le role du Raspberry (Apache2, PHP, OpenSSL, tcpdump).
#
# Usage :
#   ./run.sh                 construit l'image si besoin et demarre le "Raspberry"
#   ./run.sh terminal        ouvre un terminal administrateur dans le Raspberry
#   ./run.sh capturer [nom]  capture les echanges (Ctrl+C pour finir) dans
#                            captures/<nom>.pcap, a ouvrir dans Wireshark
#   ./run.sh arreter         arrete le Raspberry (son etat est garde)
#   ./run.sh reinitialiser   supprime le Raspberry : on repart d'une carte
#                            memoire neuve (etape 4 de l'enonce)
#   ./run.sh etat            dit si le Raspberry tourne, et ses adresses
#
# Depuis le PC, le serveur web du Raspberry repond sur http://localhost:8080
# (http://localhost dans l'enonce) et https://localhost:8443 (https://localhost).
#
set -e
cd "$(dirname "$0")"

IMAGE=studies/tp5-raspberry
NOM=tp5-raspberry
PORT_HTTP=${PORT_HTTP:-8080}
PORT_HTTPS=${PORT_HTTPS:-8443}

verifier_docker() {
    if ! command -v docker >/dev/null; then
        echo "Erreur : docker introuvable. Installer Docker (Docker Desktop sous Windows)," >&2
        echo "ou suivre la variante sans conteneur de la page du TP (Apache dans WSL)." >&2
        exit 1
    fi
    if ! docker info >/dev/null 2>&1; then
        echo "Erreur : le service Docker ne repond pas (Docker Desktop est-il lance ?)." >&2
        exit 1
    fi
}

existe() { docker container inspect "$NOM" >/dev/null 2>&1; }
tourne() { [ "$(docker container inspect -f '{{.State.Running}}' "$NOM" 2>/dev/null)" = true ]; }

demarrer() {
    verifier_docker
    if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
        echo "Construction de l'image (une seule fois, quelques minutes)..."
        docker build -t "$IMAGE" environnement
    fi
    if existe; then
        tourne || docker start "$NOM" >/dev/null
    else
        docker run -d --init --name "$NOM" --hostname raspberrypi \
            -p "$PORT_HTTP:80" -p "$PORT_HTTPS:443" "$IMAGE" >/dev/null
        # La cle USB de l'encadrant : les deux scripts PHP de site_web.zip
        docker cp site_web/. "$NOM":/media/cle-usb/
    fi
    etat
}

etat() {
    verifier_docker
    if tourne; then
        echo "Le Raspberry tourne."
        echo "  Site web     : http://localhost:$PORT_HTTP   (http://localhost dans l'enonce)"
        echo "  Site HTTPS   : https://localhost:$PORT_HTTPS  (https://localhost dans l'enonce)"
        echo "  Terminal     : ./run.sh terminal"
        echo "  Cle USB      : /media/cle-usb (index.php, autorisation.php)"
    elif existe; then
        echo "Le Raspberry est arrete : ./run.sh pour le relancer."
    else
        echo "Pas de Raspberry : ./run.sh pour le creer."
    fi
}

case "${1:-demarrer}" in
    demarrer)
        demarrer
        ;;
    terminal)
        verifier_docker
        tourne || demarrer >/dev/null
        exec docker exec -it -w /root "$NOM" bash
        ;;
    capturer)
        verifier_docker
        tourne || { echo "Le Raspberry ne tourne pas : ./run.sh d'abord." >&2; exit 1; }
        nom=${2:-capture-$(date +%Y%m%d-%H%M%S)}
        mkdir -p captures
        echo "Capture en cours : faire l'echange dans le navigateur, puis Ctrl+C."
        # tcpdump s'arrete sur Ctrl+C ; le script continue pour recuperer le fichier
        trap 'true' INT
        docker exec -it "$NOM" tcpdump -i any -w "/captures/$nom.pcap" 'tcp port 80 or tcp port 443' || true
        trap - INT
        docker cp "$NOM:/captures/$nom.pcap" "captures/$nom.pcap" >/dev/null
        echo "Capture enregistree : captures/$nom.pcap (a ouvrir dans Wireshark)."
        ;;
    arreter)
        verifier_docker
        existe && docker stop "$NOM" >/dev/null
        echo "Raspberry arrete."
        ;;
    reinitialiser)
        verifier_docker
        existe && docker rm -f "$NOM" >/dev/null
        echo "Raspberry supprime : le prochain ./run.sh repart de la configuration initiale."
        ;;
    etat)
        etat
        ;;
    *)
        echo "Usage : $0 [terminal | capturer [nom] | arreter | reinitialiser | etat]" >&2
        exit 1
        ;;
esac
