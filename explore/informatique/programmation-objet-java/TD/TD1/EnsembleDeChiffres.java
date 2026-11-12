public class EnsembleDeChiffres {
    private boolean present[];
    public EnsembleDeChiffres(){
        present = new boolean[10];
    }
    public void ajoute(int i){
        present[i] = true;
    }
    public void tirerAuHasard() {
        for (int i=0; i < present.length; i++) {
            present[i] = (Math.random() < 0.5);
        }
    }
    public boolean appartient(int i) {
        return present[i];
    }
    public EnsembleDeChiffres intersection(EnsembleDeChiffres e) {
        EnsembleDeChiffres res = new EnsembleDeChiffres();
        for (int i=0; i < this.present.length; i++) {
            if (this.appartient(i) && e.appartient(i)) {
                res.ajoute(i);
            }
        }
        return res;
    }
    public EnsembleDeChiffres union(EnsembleDeChiffres e) {
        EnsembleDeChiffres res = new EnsembleDeChiffres();
        for (int i=0; i < this.present.length; i++) {
            if (this.appartient(i) || e.appartient(i)) {
                res.ajoute(i);
            }
        }
        return res;
    }
    public boolean estInclusDans (EnsembleDeChiffres e) {
        for (int i=0; i < this.present.length; i++) {
            if (this.appartient(i)) {
                if (! e.appartient(i)) {
                    return false;
                }
            }
        }
        return true;   
    }

    public void affiche() {
        String res = this.toString();
        System.out.println(res);
    }
    public String toString() {
        String res = "{ ";
        for (int i=0; i < present.length; i++) {
            if (this.appartient(i))
                res += i + " ";
        }
        res+="}";
        return res;
    }

    public static void main(String[] args) throws Exception {
        System.out.println("Test");
        
        EnsembleDeChiffres edc = new EnsembleDeChiffres();
        edc.tirerAuHasard();

        EnsembleDeChiffres edc2 = new EnsembleDeChiffres();
        edc2.tirerAuHasard();

        edc.affiche();
        System.out.println(edc); //Calls toString
        edc2.affiche();
        System.out.println(edc2); //Calls toString

        edc.union(edc2).affiche();
        edc.intersection(edc2).affiche();
        System.out.println(edc.estInclusDans(edc2));
    

    }
    
}
