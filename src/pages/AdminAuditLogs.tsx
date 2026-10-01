import { useState, useEffect } from 'react';
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';
import { ClipboardList } from 'lucide-react';
import { DataTable, DataTableHead, DataTableRow, DataTableCell } from '@/components/ui';

interface AuditLog {
  id: string;
  timestamp: any;
  event: string;
  passToken: string;
  visitorId: string | null;
  reason: string | null;
  deviceId: string | null;
  gate: string | null;
  guardUid: string | null;
}

export function AdminAuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLogs() {
      setLoading(true);
      try {
        const q = query(
          collection(db, 'visitLogs'),
          orderBy('timestamp', 'desc'),
          limit(200)
        );
        const snap = await getDocs(q);
        const list: AuditLog[] = [];
        snap.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as AuditLog);
        });
        setLogs(list);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadLogs();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-gray-500" />
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            System Audit Logs
          </h1>
        </div>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Read-only history of system events, scans, and approvals
        </p>
      </div>

      <DataTable>
        <DataTableHead>
          <DataTableRow>
            <DataTableCell isHeader>Time</DataTableCell>
            <DataTableCell isHeader>Event</DataTableCell>
            <DataTableCell isHeader>Location / Actor</DataTableCell>
            <DataTableCell isHeader>Pass / Visitor ID</DataTableCell>
            <DataTableCell isHeader>Details</DataTableCell>
          </DataTableRow>
        </DataTableHead>
        <tbody className="divide-y border-[var(--color-border)] font-mono text-xs">
          {loading ? (
            <tr>
              <td colSpan={5} className="py-12 text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[var(--color-brand)]" />
              </td>
            </tr>
          ) : logs.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-8 text-center text-[var(--color-text-muted)]">
                No audit logs found.
              </td>
            </tr>
          ) : (
            logs.map((log) => (
              <DataTableRow key={log.id}>
                <DataTableCell className="whitespace-nowrap">
                  {log.timestamp ? format(log.timestamp.toMillis(), 'yyyy-MM-dd HH:mm:ss') : '—'}
                </DataTableCell>
                <DataTableCell>
                  <span className="font-semibold text-[var(--color-brand)]">
                    {log.event.toUpperCase()}
                  </span>
                </DataTableCell>
                <DataTableCell className="text-[var(--color-text-secondary)]">
                  {log.gate && <div>Gate: {log.gate}</div>}
                  {log.guardUid && <div>Guard UID: {log.guardUid.slice(0,8)}...</div>}
                  {log.deviceId && <div>Device ID: {log.deviceId.slice(0,8)}...</div>}
                </DataTableCell>
                <DataTableCell className="text-[var(--color-text-secondary)]">
                  <div>P: {log.passToken?.slice(0,8) || 'N/A'}...</div>
                  {log.visitorId && <div>V: {log.visitorId.slice(0,8)}...</div>}
                </DataTableCell>
                <DataTableCell>
                  {log.reason && <span className="text-[var(--color-danger)] font-medium">{log.reason}</span>}
                </DataTableCell>
              </DataTableRow>
            ))
          )}
        </tbody>
      </DataTable>
    </div>
  );
}
