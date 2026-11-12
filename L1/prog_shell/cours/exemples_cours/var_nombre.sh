#!/bin/bash

echo "Incrementation de N sans expr"
N=10
N=$N+1
echo "variable N = " $N

echo "Incrementation de N avec expr"
N=10
N=`expr $N + 1`
echo "variable N = " $N
