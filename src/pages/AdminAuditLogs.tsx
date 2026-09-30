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
import { Shield } from 'lucide-react';

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
          <Shield className="h-6 w-6 text-gray-500" />
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            System Audit Logs
          </h1>
        </div>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Read-only history of system events, scans, and approvals
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 uppercase dark:bg-gray-900/50">
            <tr>
              <th className="px-4 py-3 font-semibold">Time</th>
              <th className="px-4 py-3 font-semibold">Event</th>
              <th className="px-4 py-3 font-semibold">Location / Actor</th>
              <th className="px-4 py-3 font-semibold">Pass / Visitor ID</th>
              <th className="px-4 py-3 font-semibold">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y font-mono text-xs" style={{ borderColor: 'var(--color-border)' }}>
            {loading ? (
              <tr>
                <td colSpan={5} className="py-12 text-center">
                  <div className="mx-auto h-6 w-6 animate-spin rounded-full border-3 border-gray-600 border-t-transparent" />
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-gray-500">
                  No audit logs found.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {log.timestamp ? format(log.timestamp.toMillis(), 'yyyy-MM-dd HH:mm:ss') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                      {log.event.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {log.gate && <div>Gate: {log.gate}</div>}
                    {log.guardUid && <div>Guard UID: {log.guardUid.slice(0,8)}...</div>}
                    {log.deviceId && <div>Device ID: {log.deviceId.slice(0,8)}...</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div>P: {log.passToken?.slice(0,8) || 'N/A'}...</div>
                    {log.visitorId && <div>V: {log.visitorId.slice(0,8)}...</div>}
                  </td>
                  <td className="px-4 py-3">
                    {log.reason && <span className="text-red-500">{log.reason}</span>}
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
