#!/bin/bash

Repertoire=$1
Extension=$2
ls $Repertoire | grep "\.$Extension$"