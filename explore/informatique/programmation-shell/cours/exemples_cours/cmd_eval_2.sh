#!/bin/bash

nom="toto"
refNom=nom

eval "var=\$$refNom"
# Double interpretation de "var=\$$refNom" --[1]--> "var=$nom" --[2]--> var="toto"
echo "var = " $var 









