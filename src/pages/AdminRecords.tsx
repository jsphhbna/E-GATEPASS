import { useState, useEffect } from 'react';
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Download, Search, Printer } from 'lucide-react';
import { format } from 'date-fns';
import type { GatePass } from '@/types';

interface GatePassWithId extends GatePass {
  id: string;
}

// CSV Sanitization to prevent formula injection
function sanitizeCSVField(field: any): string {
  if (field == null) return '';
  let str = String(field);
  // If the cell starts with a formula character, prepend a single quote
  if (/^[=+\-@]/.test(str)) {
    str = "'" + str;
  }
  // Escape double quotes by doubling them, then wrap entire string in double quotes
  return `"${str.replace(/"/g, '""')}"`;
}

export function AdminRecords() {
  const [passes, setPasses] = useState<GatePassWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  async function loadRecords() {
    setLoading(true);
    try {
      let q = query(
        collection(db, 'gatePasses'),
        orderBy('issuedAt', 'desc'),
        limit(100)
      );

      // Simple client-side filtering for now since composite indexes can be tricky
      // with multiple optional filters in Firestore. We fetch the last 100 
      // and filter locally for simplicity, or we can use specific queries if provided.
      // If a specific date is selected, we can query that bounds.
      
      if (dateFilter) {
        const start = new Date(dateFilter);
        const end = new Date(dateFilter);
        end.setDate(end.getDate() + 1);
        
        q = query(
          collection(db, 'gatePasses'),
          where('issuedAt', '>=', start),
          where('issuedAt', '<', end),
          orderBy('issuedAt', 'desc'),
          limit(100)
        );
      }

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

  useEffect(() => {
    loadRecords();
  }, [dateFilter]);

  const filteredPasses = passes.filter((p) => {
    if (statusFilter && p.status !== statusFilter) return false;
    if (search && !p.visitorName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  function exportCSV() {
    const headers = ['Visitor Name', 'Purpose', 'Status', 'Issued At', 'Time In', 'Time Out', 'Gate'];
    
    const rows = filteredPasses.map((p) => [
      p.visitorName,
      p.purpose,
      p.status,
      p.issuedAt ? format(p.issuedAt.toMillis(), 'yyyy-MM-dd HH:mm:ss') : '',
      p.timeIn ? format(p.timeIn.toMillis(), 'yyyy-MM-dd HH:mm:ss') : '',
      p.timeOut ? format(p.timeOut.toMillis(), 'yyyy-MM-dd HH:mm:ss') : '',
      p.gate || '',
    ]);

    const csvContent = [
      headers.map(sanitizeCSVField).join(','),
      ...rows.map(row => row.map(sanitizeCSVField).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `gate_passes_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Visitor Records
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            View and export gate pass history
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-md bg-gray-800 px-4 py-2 text-sm font-semibold text-white dark:bg-gray-200 dark:text-gray-900"
          >
            <Printer className="h-4 w-4" /> Print
          </button>
          <button
            onClick={exportCSV}
            disabled={filteredPasses.length === 0}
            className="flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Print Header */}
      <div className="hidden print:block mb-4">
        <h2 className="text-xl font-bold text-black">Visitor Records Report</h2>
        <p className="text-sm text-black">
          Generated: {format(new Date(), 'PPpp')}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 rounded-lg border p-4 print:hidden" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="flex-1 min-w-[200px]">
          <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Search Name</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search visitors..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border py-2 pl-9 pr-3 text-sm"
            />
          </div>
        </div>
        
        <div className="w-48">
          <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Date</label>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div className="w-48">
          <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="">All Statuses</option>
            <option value="issued">Issued</option>
            <option value="pending">Pending</option>
            <option value="inside">Inside</option>
            <option value="exited">Exited</option>
            <option value="rejected">Rejected</option>
            <option value="expired">Expired</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border print:border-none" style={{ borderColor: 'var(--color-border)' }}>
        <table className="w-full text-left text-sm print:text-black">
          <thead className="bg-gray-50 uppercase dark:bg-gray-900/50 print:bg-transparent print:border-b-2 print:border-black">
            <tr>
              <th className="px-4 py-3 font-semibold print:px-2">Name / Purpose</th>
              <th className="px-4 py-3 font-semibold print:px-2">Status</th>
              <th className="px-4 py-3 font-semibold print:px-2">Issued</th>
              <th className="px-4 py-3 font-semibold print:px-2">Time In</th>
              <th className="px-4 py-3 font-semibold print:px-2">Time Out</th>
            </tr>
          </thead>
          <tbody className="divide-y print:divide-black/20" style={{ borderColor: 'var(--color-border)' }}>
            {loading ? (
              <tr className="print:hidden">
                <td colSpan={5} className="py-12 text-center">
                  <div className="mx-auto h-6 w-6 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
                </td>
              </tr>
            ) : filteredPasses.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-gray-500">
                  No records found for the selected filters.
                </td>
              </tr>
            ) : (
              filteredPasses.map((pass) => (
                <tr key={pass.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 print:hover:bg-transparent">
                  <td className="px-4 py-3 print:px-2">
                    <p className="font-medium">{pass.visitorName}</p>
                    <p className="text-xs text-gray-500 line-clamp-1">{pass.purpose}</p>
                  </td>
                  <td className="px-4 py-3 print:px-2">
                    {pass.status === 'inside' && pass.validUntil && pass.validUntil.toMillis() < Date.now() ? (
                      <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800 dark:bg-red-900/50 dark:text-red-300">
                        MISSING EXIT
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-800 dark:bg-gray-800 dark:text-gray-300 uppercase">
                        {pass.status}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap print:px-2">
                    {pass.issuedAt ? format(pass.issuedAt.toMillis(), 'MMM d, h:mm a') : '—'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap print:px-2">
                    {pass.timeIn ? format(pass.timeIn.toMillis(), 'h:mm a') : '—'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap print:px-2">
                    {pass.timeOut ? format(pass.timeOut.toMillis(), 'h:mm a') : '—'}
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
