import "./_group.css";
import { ArrowDownCircle, ArrowUpCircle, CreditCard } from "lucide-react";

const rows = [
  { type: "Vente à terme", date: "19/10/2026", reference: "Commande #204", note: "Livraison magasin centre", debit: "12 500,00", credit: "—", before: "0,00", balance: "+12 500,00", color: "text-amber-700 bg-amber-50 border-amber-200" },
  { type: "Versement", date: "19/10/2026", reference: "REÇU-0082", note: "Espèces", debit: "—", credit: "5 000,00", before: "+12 500,00", balance: "+7 500,00", color: "text-green-700 bg-green-50 border-green-200" },
];

export function ClearLedger() {
  return (
    <div className="min-h-screen bg-background p-5 text-foreground">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">Solde actuel</p>
            <p className="mt-1 text-2xl font-bold text-red-600">+7 500,00 DA</p>
            <p className="text-xs text-muted-foreground">Le client doit cette somme</p>
          </div>
          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <p className="text-xs text-muted-foreground">Versements</p><p className="mt-1 text-lg font-bold text-green-700">5 000,00 DA</p>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-xs text-muted-foreground">Remboursements</p><p className="mt-1 text-lg font-bold text-red-600">0,00 DA</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="rounded-md border border-green-300 bg-white px-3 py-2 text-xs text-green-700"><ArrowDownCircle className="mr-1 inline h-4 w-4" />Ajouter Versement</button>
          <button className="rounded-md border border-red-300 bg-white px-3 py-2 text-xs text-red-600"><ArrowUpCircle className="mr-1 inline h-4 w-4" />Ajouter Remboursement</button>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-muted px-3 text-xs text-muted-foreground"><CreditCard className="h-4 w-4" />2 opérations</span>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Relevé des opérations</h2>
            <p className="mt-1 text-xs text-muted-foreground">Débit = montant dû · Crédit = paiement ou avoir client</p>
            <p className="mt-1 text-[10px] text-muted-foreground">Solde après = valeur enregistrée · — = valeur historique indisponible</p>
          </div>
        </div>
        <div className="space-y-2 md:hidden">
          {rows.map((row) => (
            <article key={row.type} className="space-y-3 rounded-lg border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div><span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${row.color}`}>{row.type}</span><p className="mt-2 text-[11px] text-muted-foreground">{row.date}</p></div>
                <span className="text-[10px] text-muted-foreground">{row.reference}</span>
              </div>
              <p className="text-xs text-muted-foreground">{row.note}</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md bg-red-50 px-2.5 py-2"><p className="text-[10px] text-red-700">Débit</p><p className="mt-1 text-xs font-semibold text-red-600">{row.debit}</p></div>
                <div className="rounded-md bg-green-50 px-2.5 py-2"><p className="text-[10px] text-green-700">Crédit</p><p className="mt-1 text-xs font-semibold text-green-700">{row.credit}</p></div>
              </div>
              <div className="flex justify-between border-t pt-2 text-xs"><span className="text-muted-foreground">Solde après</span><span className="font-bold text-red-600">{row.balance}</span></div>
              <p className="text-right text-[10px] text-muted-foreground">Solde avant: {row.before}</p>
            </article>
          ))}
        </div>
        <div className="hidden overflow-x-auto rounded-lg border bg-card md:block">
          <table className="w-full min-w-[760px] border-collapse text-left text-xs">
            <thead className="bg-muted/70 text-muted-foreground">
              <tr>{["Date", "Opération", "Référence / Note", "Débit", "Crédit", "Solde après"].map((label) => <th key={label} className="px-3 py-3 font-semibold">{label}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.type} className="border-t">
                  <td className="whitespace-nowrap px-3 py-3 tabular-nums">{row.date}</td>
                  <td className="px-3 py-3"><span className={`whitespace-nowrap rounded-full border px-2 py-1 text-[11px] font-semibold ${row.color}`}>{row.type}</span></td>
                  <td className="px-3 py-3"><span className="block font-medium">{row.reference}</span><span className="mt-1 block text-muted-foreground">{row.note}</span></td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums text-red-600">{row.debit}</td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums text-green-700">{row.credit}</td>
                  <td className="px-3 py-3 text-right font-bold tabular-nums text-red-600">{row.balance}<span className="mt-1 block text-[10px] font-normal text-muted-foreground">Avant: {row.before}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
