@echo off
rem
rem TP 6 d'Algorithmique 3 (arbres binaires) sous Windows : lance run.sh
rem dans WSL (Ubuntu), comme a la fac sous Linux.
rem
rem Usage : run.bat                          compile tout
rem         run.bat tests                    lance la cible tests du Makefile
rem         run.bat <programme> [arguments]  compile, puis lance le programme
rem         run.bat fuites <programme> [...] idem sous valgrind
rem         run.bat clean                    supprime les fichiers compiles
rem Exemple : run.bat test_ab_fractions 3 SYM
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
