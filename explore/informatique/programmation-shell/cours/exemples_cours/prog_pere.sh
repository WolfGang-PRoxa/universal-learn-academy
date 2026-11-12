#!/bin/bash
var1="1234"
var2="coucou"
echo "Dans programme $0, var1 = $var1"
echo "Dans programme $0, var2 = $var2"
export var1
./prog_fils.sh

