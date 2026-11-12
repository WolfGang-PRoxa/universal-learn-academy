@echo off
rem
rem TP Transports sous Windows : lance run.sh dans WSL (Ubuntu). Les signaux
rem et les processus du TP n'existent pas sous Windows : il faut un vrai Linux.
rem
rem Usage : run.bat                          compile tout le TP
rem         run.bat v2                       version 2 (vision et transports)
rem         run.bat v4 [chariots] [wagons] [camions]
rem         run.bat exemple NOM [args]         un programme de Exemples
rem         run.bat arreter                  arrete tous les processus du TP
rem         run.bat terminal [dossier]       ouvre un shell WSL dans une
rem                                          nouvelle fenetre (versions 1 et 3)
rem

setlocal

where wsl >nul 2>&1 || (
    echo Erreur : WSL n'est pas installe. 1>&2
    exit /b 1
)

rem Dossier du TP vu depuis WSL : G:\Mon Drive\... devient /mnt/g/Mon Drive/...
set "DOSSIER=%~dp0"
set "DOSSIER=%DOSSIER:~0,-1%"
set "LECTEUR=%~d0"
set "L=%LECTEUR:~0,1%"
for %%a in (a b c d e f g h i j k l m n o p q r s t u v w x y z) do if /i "%L%"=="%%a" set "L=%%a"
set "CHEMIN=%DOSSIER:\=/%"
set "CHEMIN=/mnt/%L%%CHEMIN:~2%"

rem 1. WSL voit C: sous /mnt/c, mais pas le lecteur G: de Google Drive :
rem    on le monte (en administrateur, sans mot de passe) s'il ne l'est pas.
wsl --cd ~ -u root -e sh -c "mountpoint -q /mnt/%L% || { mkdir -p /mnt/%L% && mount -t drvfs %LECTEUR% /mnt/%L%; }"
if errorlevel 1 (
    echo Erreur : impossible de monter %LECTEUR% dans WSL. 1>&2
    exit /b 1
)

rem Affiche correctement les accents (messages de gcc en UTF-8)
chcp 65001 >nul

rem 2. Un shell WSL dans une nouvelle fenetre, dans le dossier demande
if /i "%~1"=="terminal" (
    start "TP Transports %~2" wsl --cd "%CHEMIN%/%~2" -e bash
    exit /b 0
)

rem 3. Sinon, run.sh dans WSL, depuis le dossier du TP
wsl --cd "%CHEMIN%" -e bash run.sh %*
exit /b %errorlevel%
