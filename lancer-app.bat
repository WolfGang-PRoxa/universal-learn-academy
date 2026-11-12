@echo off
rem Lance l'application Studies : le portail et les cours dans leur propre fenetre.
rem La premiere fois, l'installe (quelques minutes) et cree ses raccourcis.
title Studies - installation
chcp 65001 >nul
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js est introuvable : l'installer depuis https://nodejs.org puis relancer.
  pause
  exit /b 1
)
node "%~dp0_outils\app\installer.js" %*
if errorlevel 1 pause
