@echo off
rem Ouvre Jupyter dans l'environnement Python commun des notebooks (cours, devoirs, TP).
rem La premiere fois, cree l'environnement dans %LOCALAPPDATA%\studies-python, hors de
rem Google Drive (quelques minutes), puis le remet a jour quand
rem _outils\environnements\python\requirements.txt change.
rem   lancer-jupyter.bat                      Jupyter a la racine de studies
rem   lancer-jupyter.bat <dossier|notebook>   Jupyter sur ce dossier ou ce notebook
rem                                           (on peut aussi glisser un notebook sur ce fichier)
rem   lancer-jupyter.bat --installer          cree ou met a jour l'environnement, sans lancer Jupyter
rem Fermer cette fenetre arrete Jupyter.
title Studies - Jupyter
chcp 65001 >nul
setlocal
set "RACINE=%~dp0"
set "RACINE=%RACINE:~0,-1%"
set "ENV=%LOCALAPPDATA%\studies-python"
set "REQ=%RACINE%\_outils\environnements\python\requirements.txt"
set "PY=%ENV%\Scripts\python.exe"

if exist "%PY%" goto :bibliotheques
rem py -3 (lanceur de python.org) d'abord : "python" peut n'etre que le raccourci du Microsoft Store
set "BASE="
py -3 --version >nul 2>nul && set "BASE=py -3"
if not defined BASE python --version >nul 2>nul && set "BASE=python"
if not defined BASE (
  echo Python est introuvable : l'installer depuis https://www.python.org/downloads/
  echo en cochant "Add python.exe to PATH", puis relancer.
  goto :echec
)
echo Creation de l'environnement Python dans %ENV%...
%BASE% -m venv "%ENV%"
if errorlevel 1 goto :echec

:bibliotheques
fc /b "%REQ%" "%ENV%\requirements.txt" >nul 2>nul
if not errorlevel 1 goto :pret
echo Installation des bibliotheques de requirements.txt (quelques minutes la premiere fois)...
"%PY%" -m pip install --upgrade --quiet pip
"%PY%" -m pip install -r "%REQ%"
if errorlevel 1 (
  echo Echec de l'installation : voir les messages ci-dessus.
  goto :echec
)
copy /y "%REQ%" "%ENV%\requirements.txt" >nul

:pret
if /i "%~1"=="--installer" (
  echo Environnement pret : %ENV%
  "%PY%" --version
  exit /b 0
)
rem Sans argument, Jupyter s'ouvre sur la racine de studies ; avec un dossier, sur ce dossier ;
rem avec un notebook, sur la racine, notebook ouvert.
if "%~1"=="" (
  "%PY%" -m jupyter notebook --ServerApp.root_dir="%RACINE%"
) else (
  "%PY%" -m jupyter notebook --ServerApp.root_dir="%RACINE%" "%~f1"
)
if errorlevel 1 goto :echec
exit /b 0

:echec
pause
exit /b 1
