i=1
while [ $i -le $# ] ; do
    eval "echo parametre \$$i " ;
    i=`expr $i + 1` ;
done
