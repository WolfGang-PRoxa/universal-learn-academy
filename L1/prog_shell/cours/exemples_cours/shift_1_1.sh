i=1
while (test $i -le $# ) ; do
    eval "echo parametre \$$i " ;
    i=`expr $i + 1` ;
done
