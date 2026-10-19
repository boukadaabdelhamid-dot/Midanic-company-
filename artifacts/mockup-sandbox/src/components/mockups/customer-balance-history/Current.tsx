import "./_group.css";
import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";

const rows = [
  { type: "Vente à terme", date: "19/10/2026 10:15", note: "Commande #204", amount: "+12 500,00", balance: "+12 500,00", color: "text-amber-700 bg-amber-50 border-amber-200" },
  { type: "Versement", date: "19/10/2026 11:30", note: "Espèces", amount: "−5 000,00", balance: "+7 500,00", color: "text-green-700 bg-green-50 border-green-200" },
];

export function Current() {
  return (
    <div className="min-h-screen bg-background p-5 text-foreground">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Solde actuel</p>
          <p className="mt-1 text-2xl font-bold text-red-600">+7 500,00 DA</p>
          <p className="text-xs text-muted-foreground">Client débiteur</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-green-200 bg-green-50 p-3">
            <p className="text-[11px] text-muted-foreground">Versements</p>
            <p className="mt-1 font-bold text-green-700">−5 000,00 DA</p>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-[11px] text-muted-foreground">Remboursements</p>
            <p className="mt-1 font-bold text-red-600">+0,00 DA</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="flex-1 rounded-md border border-green-300 bg-white px-3 py-2 text-xs text-green-700"><ArrowDownCircle className="mr-1 inline h-4 w-4" />Ajouter Versement</button>
          <button className="flex-1 rounded-md border border-red-300 bg-white px-3 py-2 text-xs text-red-600"><ArrowUpCircle className="mr-1 inline h-4 w-4" />Ajouter Remboursement</button>
        </div>
        <p className="border-b pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Historique des mouvements</p>
        <div className="space-y-0">
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 border-b px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Opération</span><span>Montant</span><span>Solde</span>
          </div>
          {rows.map((row) => (
            <div key={row.type} className="grid grid-cols-[1fr_auto_auto] items-start gap-x-3 border-b py-3">
              <div>
                <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${row.color}`}>{row.type}</span>
                <p className="mt-1 text-[10px] text-muted-foreground">{row.date}</p>
                <p className="text-[11px] text-muted-foreground">{row.note}</p>
              </div>
              <span className="text-sm font-bold">{row.amount}</span>
              <span className="w-20 text-right text-sm font-bold">{row.balance}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
