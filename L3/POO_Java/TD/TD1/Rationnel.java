import java.util.Comparator;
public class Rationnel implements Comparable<Rationnel>, Comparator<Rationnel> {
    private int p;
    private int q;
    public Rationnel(int p, int q) {
        this.p = p;
        this.q = q;
    }
    public int num() {
        return p;
    }
    public int den() {
        return q;
    }
    public double toDouble() {
        return num() / den();
    }
    public Rationnel somme(Rationnel r) {
        return new Rationnel(this.num() * r.den() + r.num() * this.den(), this.den() * r.den());
    }
    public Rationnel difference(Rationnel r) {
        return new Rationnel(this.num() * r.den() - r.num() * this.den(), this.den() * r.den());
    }
    public Rationnel produit(Rationnel r) {
        return new Rationnel(this.num() * r.num(), this.den() * r.den());
    }
    public Rationnel quotient(Rationnel r) {
        return new Rationnel(this.num() * r.den(), this.den() * r.num());
    }
    @Override
    public int compareTo(Rationnel r) {
        if (this.toDouble() - r.toDouble() < 0) return -1;
        else if (this.toDouble() - r.toDouble() > 0) return 1;
        else return 0;
    }
    @Override
    public int compare(Rationnel o1, Rationnel o2) {
        return o1.compareTo(o2);
    }
    public void affiche() {
        System.out.println(this.num()+"/"+this.den());
    }

    public static Rationnel moyenne(Rationnel[] t) {
        Rationnel somme = new Rationnel(0, 1);
        for (Rationnel r : t) {
            somme = somme.somme(r);
        }
        return somme.produit(new Rationnel(1, t.length));
    }

    public static Rationnel[] systeme (int a, int b, int c, int d, int e, int f) {
        int g = a * e - b * d;
        if (g != 0) return new Rationnel[0];
        else {
            Rationnel[] res = new Rationnel[2];
            res[0] =  new Rationnel((b *f - c* e), (g));
            res[1] =  new Rationnel((c*d - a* f), (g));
            return res;
        }

    }

    public static Rationnel sqrt(Rationnel r, Rationnel precision) {
        Rationnel moitie = new Rationnel(1, 2);
        Rationnel u0 = r.produit(moitie);
        Rationnel uk;
        Rationnel ukplus = u0;
        do  {
            uk = ukplus;
            ukplus = moitie.produit((uk.somme(r.quotient(uk))));
        } while (ukplus.difference(uk).toDouble() < precision.toDouble());
        return ukplus;

    }

    public static Rationnel std(Rationnel[] t, Rationnel precision) {
        Rationnel moyenne = Rationnel.moyenne(t);
        Rationnel somme = new Rationnel(0, 1);
        for (Rationnel r : t ) {
            Rationnel add = r.difference(moyenne);
            somme.somme(add.produit(add));
        }
        Rationnel quotient = new Rationnel(1, t.length);
        somme = somme.produit(quotient);
        return Rationnel.sqrt(somme, precision);

    }

    public static void main(String[] args) {
        Rationnel r1 = new Rationnel(4, 5);
        Rationnel r2 = new Rationnel(3, 4);
        r1.affiche();
        r2.affiche();
        r1.somme(r2).affiche();
        r1.produit(r2).affiche();
        r1.quotient(r2).affiche();
        Rationnel [] tab = new Rationnel[3];
        tab[0] = new Rationnel(3, 4);
        tab[1] = new Rationnel(1, 2);
        tab[2] = new Rationnel(1, 4);
        Rationnel.moyenne(tab).affiche();
        Rationnel.sqrt(new Rationnel(50, 2), new Rationnel(1, 100)).affiche();
    }



}
