import { useState, useEffect } from "react";
import { Search, Download, Lock } from "lucide-react";
import { Card, SectionHeader, Th, Td, Tr, Pagination, Avatar, Select, EmptyState } from "../../components/ui";
import { getPointTransactions } from "../../api";

const TX_COLORS: Record<string, string> = {
  welcome_credit: "text-green-700 bg-green-50 border-green-200",
  purchased_credit: "text-green-700 bg-green-50 border-green-200",
  offer_reservation: "text-sky-700 bg-sky-50 border-sky-200",
  reservation_release: "text-slate-600 bg-slate-100 border-slate-200",
  ride_debit: "text-red-700 bg-red-50 border-red-200",
  admin_refund: "text-violet-700 bg-violet-50 border-violet-200",
  admin_correction: "text-amber-700 bg-amber-50 border-amber-200",
};

const TX_LABELS: Record<string, string> = {
  welcome_credit: "Welcome Credit",
  purchased_credit: "Purchased",
  offer_reservation: "Reservation",
  reservation_release: "Release",
  ride_debit: "Ride Debit",
  admin_refund: "Admin Refund",
  admin_correction: "Correction",
};

export default function PointsTransactions() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [_total, setTotal] = useState(0);
  const [_fetching, setFetching] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setFetching(true);
      try {
        const res = await getPointTransactions({ page, limit: 50 });
        if (!cancelled) {
          setTransactions(res.transactions ?? []);
          setTotal(res.pagination?.total ?? (res.transactions ?? []).length);
        }
      } catch (err) {
        console.error("Failed to load point transactions", err);
      } finally {
        if (!cancelled) setFetching(false);
      }
    })();
    return () => { cancelled = true; };
  }, [page]);

  const filtered = transactions.filter(tx => {
    const matchSearch = !search || (tx.driverName ?? "").toLowerCase().includes(search.toLowerCase()) || (tx.id ?? "").toLowerCase().includes(search.toLowerCase()) || ((tx.rideId ?? "").toLowerCase().includes(search.toLowerCase()));
    const matchType = typeFilter === "all" || tx.type === typeFilter;
    return matchSearch && matchType;
  });

  const perPage = 8;
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Point Transactions"
        description="Immutable ledger of all point movements. Transactions cannot be edited or deleted."
        actions={
          <>
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1.5 rounded-full">
              <Lock size={11} /> Read-only ledger
            </div>
            <button className="flex items-center gap-2 text-sm text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 rounded-[10px] px-3 h-10 transition-colors">
              <Download size={14} /> Export
            </button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-52 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Driver name, TX ID or Ride ID…"
            className="w-full h-10 bg-white border border-slate-200 rounded-[10px] pl-9 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 transition-all" />
        </div>
        <Select value={typeFilter} onChange={setTypeFilter} options={[
          { value: "all", label: "All Types" },
          { value: "welcome_credit", label: "Welcome Credit" },
          { value: "purchased_credit", label: "Purchased" },
          { value: "offer_reservation", label: "Reservation" },
          { value: "reservation_release", label: "Release" },
          { value: "ride_debit", label: "Ride Debit" },
          { value: "admin_refund", label: "Admin Refund" },
          { value: "admin_correction", label: "Correction" },
        ]} className="w-48" />
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <Th>TX ID</Th>
                <Th>Driver</Th>
                <Th>Type</Th>
                <Th>Amount</Th>
                <Th>Balance Before→After</Th>
                <Th>Reserved Before→After</Th>
                <Th>Ride / Offer</Th>
                <Th>Payment Ref</Th>
                <Th>Created By</Th>
                <Th>Timestamp</Th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan={10}><EmptyState title="No transactions match your filters" /></td></tr>
              ) : paginated.map(tx => (
                <Tr key={tx.id}>
                  <Td><span className="font-mono text-xs text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">{tx.id}</span></Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <Avatar initials={tx.driverAvatar} size="xs" />
                      <span className="text-sm text-slate-700">{tx.driverName}</span>
                    </div>
                  </Td>
                  <Td>
                    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${TX_COLORS[tx.type]}`}>
                      {TX_LABELS[tx.type]}
                    </span>
                  </Td>
                  <Td>
                    <span className={`text-sm font-semibold tabular-nums ${tx.amount > 0 ? "text-green-700" : "text-red-700"}`}>
                      {tx.amount > 0 ? "+" : ""}{tx.amount}
                    </span>
                  </Td>
                  <Td>
                    <span className="text-xs font-mono text-slate-600">{tx.balanceBefore} → {tx.balanceAfter}</span>
                  </Td>
                  <Td>
                    <span className="text-xs font-mono text-slate-600">{tx.reservedBefore} → {tx.reservedAfter}</span>
                  </Td>
                  <Td>
                    {tx.rideId ? <span className="font-mono text-xs text-[#BE1B2C]">{tx.rideId}</span> : <span className="text-xs text-slate-400">—</span>}
                  </Td>
                  <Td>
                    {tx.paymentRef ? <span className="font-mono text-xs text-slate-600">{tx.paymentRef}</span> : <span className="text-xs text-slate-400">—</span>}
                  </Td>
                  <Td><span className="text-xs text-slate-600">{tx.createdBy}</span></Td>
                  <Td><span className="text-xs text-slate-500">{formatTs(tx.createdAt)}</span></Td>
                </Tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={filtered.length} perPage={perPage} onChange={setPage} />
      </Card>
    </div>
  );
}

function formatTs(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
