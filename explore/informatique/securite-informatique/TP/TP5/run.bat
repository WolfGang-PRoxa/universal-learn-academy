@echo off
rem
rem TP 5 (connexion TLS a un serveur web) sous Windows, sans Raspberry Pi :
rem un conteneur Docker joue le role du Raspberry. Il faut Docker Desktop.
rem
rem Usage : run.bat                  construit l'image si besoin et demarre le Raspberry
rem         run.bat terminal         terminal administrateur dans le Raspberry
rem         run.bat capturer [nom]   capture (Ctrl+C pour finir) dans captures\nom.pcap
rem         run.bat arreter          arrete le Raspberry (son etat est garde)
rem         run.bat reinitialiser    supprime le Raspberry (etape 4 de l'enonce)
rem         run.bat etat             dit si le Raspberry tourne
rem
rem Depuis le PC : http://localhost:8080 (http://localhost dans l'enonce)
rem et https://localhost:8443 (https://localhost dans l'enonce).
rem

setlocal
cd /d "%~dp0"

set "IMAGE=studies/tp5-raspberry"
set "NOM=tp5-raspberry"

where docker >nul 2>&1 || (
    echo Erreur : docker introuvable. Installer Docker Desktop, ou suivre la 1>&2
    echo variante sans conteneur de la page du TP ^(Apache dans WSL^). 1>&2
    exit /b 1
)
docker info >nul 2>&1 || (
    echo Erreur : Docker ne repond pas. Lancer Docker Desktop, puis recommencer. 1>&2
    exit /b 1
)

set "ACTION=%~1"
if "%ACTION%"=="" set "ACTION=demarrer"

if /i "%ACTION%"=="demarrer" goto demarrer
if /i "%ACTION%"=="terminal" goto terminal
if /i "%ACTION%"=="capturer" goto capturer
if /i "%ACTION%"=="arreter" goto arreter
if /i "%ACTION%"=="reinitialiser" goto reinitialiser
if /i "%ACTION%"=="etat" goto etat
echo Usage : run.bat [terminal ^| capturer [nom] ^| arreter ^| reinitialiser ^| etat] 1>&2
exit /b 1

:demarrer
docker image inspect %IMAGE% >nul 2>&1 || (
    echo Construction de l'image ^(une seule fois, quelques minutes^)...
    docker build -t %IMAGE% environnement || exit /b 1
)
docker container inspect %NOM% >nul 2>&1 && (
    docker start %NOM% >nul
) || (
    docker run -d --init --name %NOM% --hostname raspberrypi -p 8080:80 -p 8443:443 %IMAGE% >nul || exit /b 1
    rem La cle USB de l'encadrant : les deux scripts PHP de site_web.zip
    docker cp site_web/. %NOM%:/media/cle-usb/ >nul
)
goto etat

:etat
docker container inspect %NOM% >nul 2>&1 || (
    echo Pas de Raspberry : run.bat pour le creer.
    exit /b 0
)
for /f %%e in ('docker container inspect -f "{{.State.Running}}" %NOM%') do set "MARCHE=%%e"
if /i "%MARCHE%"=="true" (
    echo Le Raspberry tourne.
    echo   Site web   : http://localhost:8080   ^(http://localhost dans l'enonce^)
    echo   Site HTTPS : https://localhost:8443  ^(https://localhost dans l'enonce^)
    echo   Terminal   : run.bat terminal
    echo   Cle USB    : /media/cle-usb ^(index.php, autorisation.php^)
) else (
    echo Le Raspberry est arrete : run.bat pour le relancer.
)
exit /b 0

:terminal
docker exec -it -w /root %NOM% bash
exit /b %errorlevel%

:capturer
set "FICHIER=%~2"
if "%FICHIER%"=="" (
    for /f %%d in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "FICHIER=capture-%%d"
)
if not exist captures mkdir captures
echo Capture en cours : faire l'echange dans le navigateur, puis Ctrl+C.
docker exec -it %NOM% tcpdump -i any -w /captures/%FICHIER%.pcap "tcp port 80 or tcp port 443"
docker cp %NOM%:/captures/%FICHIER%.pcap captures\%FICHIER%.pcap >nul
echo Capture enregistree : captures\%FICHIER%.pcap ^(a ouvrir dans Wireshark^).
exit /b 0

:arreter
docker stop %NOM% >nul 2>&1
echo Raspberry arrete.
exit /b 0

:reinitialiser
docker rm -f %NOM% >nul 2>&1
echo Raspberry supprime : le prochain run.bat repart de la configuration initiale.
exit /b 0
