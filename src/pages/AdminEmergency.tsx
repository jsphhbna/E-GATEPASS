import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { AlertTriangle, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { Card, Input, Button, DataTable, DataTableHead, DataTableRow, DataTableCell } from '@/components/ui';
import type { GatePass } from '@/types';

interface GatePassWithId extends GatePass {
  id: string;
}

export function AdminEmergency() {
  const [passes, setPasses] = useState<GatePassWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [gateFilter, setGateFilter] = useState('');
  const [search, setSearch] = useState('');

  // Extract unique gates from passes
  const gates = Array.from(new Set(passes.map((p) => p.gate).filter(Boolean))) as string[];

  useEffect(() => {
    async function loadInside() {
      setLoading(true);
      try {
        const q = query(
          collection(db, 'gatePasses'),
          where('status', '==', 'inside')
        );
        const snap = await getDocs(q);
        const list: GatePassWithId[] = [];
        snap.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as GatePassWithId);
        });
        setPasses(list);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadInside();
  }, []);

  const filteredPasses = passes.filter((p) => {
    if (gateFilter && p.gate !== gateFilter) return false;
    if (search && !(p.visitorName ?? '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6 print:m-0 print:p-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-[var(--color-danger)]" />
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
              Emergency Evacuation List
            </h1>
          </div>
          <p className="mt-1 text-sm font-medium text-[var(--color-danger)]">
            Currently Inside: {passes.length} Visitors
          </p>
        </div>
        <Button
          onClick={() => window.print()}
          variant="secondary"
          icon={<Printer className="h-4 w-4" />}
        >
          Print Roll Call
        </Button>
      </div>

      {/* Print Header (Visible only in print) */}
      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-bold text-black mb-2">Emergency Roll Call</h1>
        <p className="text-sm font-medium text-black">
          Generated: {format(new Date(), 'PPpp')}
        </p>
        <p className="text-sm font-medium text-black">
          Total Visitors Inside: {filteredPasses.length}
        </p>
      </div>

      <Card className="flex flex-wrap gap-4 p-5 print:hidden">
        <div className="flex-1 min-w-[200px]">
          <label className="mb-2 block text-sm font-medium text-[var(--color-text-secondary)]">Search Name</label>
          <Input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <div className="w-48">
          <label className="mb-2 block text-sm font-medium text-[var(--color-text-secondary)]">Filter by Entry Gate</label>
          <select
            value={gateFilter}
            onChange={(e) => setGateFilter(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm outline-none bg-transparent"
            style={{
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
          >
            <option value="">All Gates</option>
            {gates.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
      </Card>

      {/* Table */}
      <div className="print:border-none print:shadow-none print:m-0 print:p-0">
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableCell isHeader className="text-[var(--color-danger)] font-bold print:text-black print:px-2">Visitor Name</DataTableCell>
              <DataTableCell isHeader className="text-[var(--color-danger)] font-bold print:text-black print:px-2">Time In</DataTableCell>
              <DataTableCell isHeader className="text-[var(--color-danger)] font-bold print:text-black print:px-2">Entry Gate</DataTableCell>
              <DataTableCell isHeader className="text-[var(--color-danger)] font-bold print:text-black print:px-2">Status</DataTableCell>
              <DataTableCell isHeader className="text-[var(--color-danger)] font-bold print:text-black print:w-20">Accounted</DataTableCell>
            </DataTableRow>
          </DataTableHead>
          <tbody className="divide-y border-[var(--color-border)] print:divide-black/20">
            {loading ? (
              <tr className="print:hidden">
                <td colSpan={5} className="py-12 text-center">
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[var(--color-danger)]" />
                </td>
              </tr>
            ) : filteredPasses.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-[var(--color-text-muted)] print:text-black">
                  No visitors currently inside.
                </td>
              </tr>
            ) : (
              filteredPasses.map((pass) => (
                <DataTableRow key={pass.id as string} className="print:hover:bg-transparent">
                  <DataTableCell className="font-bold print:px-2">{pass.visitorName}</DataTableCell>
                  <DataTableCell className="print:px-2">
                    {pass.timeIn ? format(pass.timeIn.toMillis(), 'h:mm a') : '—'}
                  </DataTableCell>
                  <DataTableCell className="print:px-2">{pass.gate || 'Unknown'}</DataTableCell>
                  <DataTableCell className="text-[var(--color-danger)] font-bold print:text-black print:px-2">INSIDE</DataTableCell>
                  <DataTableCell className="print:px-2">
                    {/* Checkbox for physical printout marking */}
                    <div className="h-6 w-6 rounded border-2 border-[var(--color-border)] print:border-black" />
                  </DataTableCell>
                </DataTableRow>
              ))
            )}
          </tbody>
        </DataTable>
      </div>
    </div>
  );
}
