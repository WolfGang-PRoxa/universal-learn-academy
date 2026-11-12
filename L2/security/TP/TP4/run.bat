@echo off
rem
rem TP 4 (gestionnaire de mots de passe v2) sous Windows : lance run.sh dans WSL (Ubuntu),
rem comme a la fac sous Linux.
rem
rem Usage : run.bat            compile memopwd et les tests (make dans annexe/ ; des warnings sont normaux)
rem         run.bat test       compile, puis lance les tests fournis (AES128, SHA256, HMAC-SHA256)
rem         run.bat memopwd    compile, puis lance le gestionnaire de mots de passe
rem         run.bat clean      supprime les fichiers compiles (garde memopwd.data)
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

rem WSL voit C: sous /mnt/c, mais pas le lecteur G: de Google Drive :
rem on le monte (en administrateur, sans mot de passe) s'il ne l'est pas.
wsl --cd ~ -u root -e sh -c "mountpoint -q /mnt/%L% || { mkdir -p /mnt/%L% && mount -t drvfs %LECTEUR% /mnt/%L%; }"
if errorlevel 1 (
    echo Erreur : impossible de monter %LECTEUR% dans WSL. 1>&2
    exit /b 1
)

rem Affiche correctement les accents (messages de gcc en UTF-8)
chcp 65001 >nul

wsl --cd "%CHEMIN%" -e bash run.sh %*
exit /b %errorlevel%
