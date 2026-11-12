#!/bin/bash

date
echo "Catalogue accueil    = " $HOME
echo "Catalogue de travail = " ; pwd
echo -n "Nombre de fichiers   = " ; ls | wc -l
echo "fin"

