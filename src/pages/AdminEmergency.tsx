import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { AlertTriangle, Printer, Search } from 'lucide-react';
import { format } from 'date-fns';
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
    if (search && !p.visitorName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6 print:m-0 print:p-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-red-600" />
            <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
              Emergency Evacuation List
            </h1>
          </div>
          <p className="mt-1 text-sm text-red-600 dark:text-red-400 font-medium">
            Currently Inside: {passes.length} Visitors
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-md bg-gray-800 px-4 py-2 text-sm font-semibold text-white dark:bg-gray-200 dark:text-gray-900"
        >
          <Printer className="h-4 w-4" /> Print Roll Call
        </button>
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

      <div className="flex flex-wrap gap-4 rounded-lg border p-4 print:hidden" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="flex-1 min-w-[200px]">
          <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Search Name</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border py-2 pl-9 pr-3 text-sm"
            />
          </div>
        </div>
        
        <div className="w-48">
          <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Filter by Entry Gate</label>
          <select
            value={gateFilter}
            onChange={(e) => setGateFilter(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="">All Gates</option>
            {gates.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border print:border-none" style={{ borderColor: 'var(--color-border)' }}>
        <table className="w-full text-left text-sm print:text-black">
          <thead className="bg-red-50 uppercase dark:bg-red-900/20 print:bg-transparent print:border-b-2 print:border-black">
            <tr>
              <th className="px-4 py-3 font-semibold text-red-900 dark:text-red-300 print:text-black print:px-2">Visitor Name</th>
              <th className="px-4 py-3 font-semibold text-red-900 dark:text-red-300 print:text-black print:px-2">Time In</th>
              <th className="px-4 py-3 font-semibold text-red-900 dark:text-red-300 print:text-black print:px-2">Entry Gate</th>
              <th className="px-4 py-3 font-semibold text-red-900 dark:text-red-300 print:text-black print:px-2">Status</th>
              <th className="px-4 py-3 font-semibold text-red-900 dark:text-red-300 print:text-black print:w-20">Accounted</th>
            </tr>
          </thead>
          <tbody className="divide-y print:divide-black/20" style={{ borderColor: 'var(--color-border)' }}>
            {loading ? (
              <tr className="print:hidden">
                <td colSpan={5} className="py-12 text-center">
                  <div className="mx-auto h-6 w-6 animate-spin rounded-full border-3 border-red-600 border-t-transparent" />
                </td>
              </tr>
            ) : filteredPasses.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-gray-500 print:text-black">
                  No visitors currently inside.
                </td>
              </tr>
            ) : (
              filteredPasses.map((pass) => (
                <tr key={pass.id as string} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 print:hover:bg-transparent">
                  <td className="px-4 py-3 font-bold print:px-2">{pass.visitorName}</td>
                  <td className="px-4 py-3 print:px-2">
                    {pass.timeIn ? format(pass.timeIn.toMillis(), 'h:mm a') : '—'}
                  </td>
                  <td className="px-4 py-3 print:px-2">{pass.gate || 'Unknown'}</td>
                  <td className="px-4 py-3 print:px-2 text-red-600 font-semibold print:text-black">INSIDE</td>
                  <td className="px-4 py-3 print:px-2">
                    {/* Checkbox for physical printout marking */}
                    <div className="h-6 w-6 rounded border-2 border-gray-300 print:border-black" />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
