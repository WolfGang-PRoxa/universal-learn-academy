@echo off
rem Lance le serveur local de l'outil de quiz et ouvre le portail dans le navigateur.
rem Fermer cette fenetre arrete le serveur.
title Outil de quiz - serveur local
chcp 65001 >nul
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js est introuvable : l'installer depuis https://nodejs.org puis relancer.
  pause
  exit /b 1
)
node "%~dp0_outils\quiz\serveur\serveur.js" --ouvrir
if errorlevel 1 pause
