@echo off
rem
rem Compile tout le projet puis lance l'executable.
rem
rem Rappel : les dossiers du projet se declarent dans Makefile.dir,
rem PAS ici. Un script .bat ne peut pas definir de variable make.
rem

setlocal

rem Equivalent de : cd "$(dirname "$0")"
cd /d "%~dp0"

rem Les Makefile utilisent une syntaxe shell (cd x ; make, mkdir -p, rm -rf).
rem make n'utilise sh.exe que s'il le trouve dans le PATH, sinon il prend
rem cmd.exe et tout casse : on ajoute donc les outils Unix de Git for Windows.
where sh >nul 2>&1 || set "PATH=%PATH%;%ProgramFiles%\Git\usr\bin"
where sh >nul 2>&1 || (
    echo Erreur : sh.exe introuvable. Installez Git for Windows. 1>&2
    exit /b 1
)

rem Affiche correctement les accents (sources en UTF-8)
chcp 65001 >nul

rem Equivalent de "set -e" : on s'arrete si la compilation echoue
make all
if errorlevel 1 exit /b %errorlevel%

rem Sous Windows, gcc ajoute automatiquement l'extension .exe
build\hadamard.exe
