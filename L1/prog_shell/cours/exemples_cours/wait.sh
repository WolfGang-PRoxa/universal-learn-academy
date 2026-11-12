#!/bin/bash

# 1er processus en background
sleep 1 & 

# 2ieme processus en background
sleep 2 &

# Attente d'abordd fin 2ieme processus
wait %2
echo "Le processus \"sleep 2\" a fini avec status $?"

# Fait autre chose 
echo "Fait autre chose"
sleep 2

# Puis attente fin 1er processus 
wait %1
echo "Le processus \"sleep 1\"  a fini avec status $?"