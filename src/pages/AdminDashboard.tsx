import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  getCountFromServer,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  Users,
  Clock,
  ArrowRightCircle,
  ArrowLeftCircle,
} from 'lucide-react';
import { startOfDay, endOfDay, subDays, format } from 'date-fns';
import { Card, StatCard } from '@/components/ui';

export function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    todayTotal: 0,
    todayInside: 0,
    todayExited: 0,
    todayRejected: 0,
    todayPending: 0,
    avgDecisionTime: '—',
  });

  const [historicalData, setHistoricalData] = useState<{ date: string; count: number }[]>([]);

  useEffect(() => {
    async function loadDashboardData() {
      setLoading(true);
      try {
        const now = new Date();
        const startToday = startOfDay(now);
        const endToday = endOfDay(now);

        const passesRef = collection(db, 'gatePasses');

        // Total today
        const qToday = query(
          passesRef,
          where('issuedAt', '>=', startToday),
          where('issuedAt', '<=', endToday)
        );
        const todaySnap = await getCountFromServer(qToday);
        const todayTotal = todaySnap.data().count;

        // By Status today
        const [insideSnap, exitedSnap, rejectedSnap, pendingSnap, insideDocsSnap] = await Promise.all([
          getCountFromServer(
            query(passesRef, where('status', '==', 'inside'), where('issuedAt', '>=', startToday))
          ),
          getCountFromServer(
            query(passesRef, where('status', '==', 'exited'), where('timeIn', '>=', startToday)) // approximation
          ),
          getCountFromServer(
            query(passesRef, where('status', '==', 'rejected'), where('issuedAt', '>=', startToday))
          ),
          getCountFromServer(
            query(passesRef, where('status', '==', 'pending'), where('issuedAt', '>=', startToday))
          ),
          getDocs(
            query(passesRef, where('status', '==', 'inside'), where('issuedAt', '>=', startToday))
          ),
        ]);

        let totalDecisionTimeMs = 0;
        let decisionCount = 0;

        const insideDocs = insideDocsSnap.docs;
        insideDocs.forEach((d: any) => {
          const pass = d.data();
          if (pass.timeIn && pass.scannedAt) {
            totalDecisionTimeMs += (pass.timeIn.toMillis() - pass.scannedAt.toMillis());
            decisionCount++;
          }
        });

        let avgDecisionTime = '—';
        if (decisionCount > 0) {
          const avgSec = Math.round(totalDecisionTimeMs / decisionCount / 1000);
          avgDecisionTime = avgSec < 60 ? `${avgSec}s` : `${Math.round(avgSec/60)}m`;
        }

        setStats({
          todayTotal,
          todayInside: insideSnap.data().count,
          todayExited: exitedSnap.data().count,
          todayRejected: rejectedSnap.data().count,
          todayPending: pendingSnap.data().count,
          avgDecisionTime,
        });

        // Historical Data (Last 7 Days)
        const history = [];
        for (let i = 6; i >= 0; i--) {
          const targetDay = subDays(now, i);
          const start = startOfDay(targetDay);
          const end = endOfDay(targetDay);

          const qDay = query(
            passesRef,
            where('issuedAt', '>=', start),
            where('issuedAt', '<=', end)
          );
          
          const daySnap = await getCountFromServer(qDay);
          history.push({
            date: format(targetDay, 'MMM dd'),
            count: daySnap.data().count,
          });
        }
        setHistoricalData(history);

      } catch (err) {
        console.error('Error loading dashboard:', err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-brand)] border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          Dashboard
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Overview of today's campus visitor activity
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Visitors Today"
          value={stats.todayTotal}
          icon={<Users className="h-5 w-5 text-[var(--color-brand)]" />}
        />
        <StatCard
          title="Currently Inside"
          value={stats.todayInside}
          icon={<ArrowRightCircle className="h-5 w-5 text-[var(--color-success)]" />}
          trend={`${stats.todayInside} visitors`}
          trendUp={true}
        />
        <StatCard
          title="Exited"
          value={stats.todayExited}
          icon={<ArrowLeftCircle className="h-5 w-5 text-[var(--color-text-secondary)]" />}
        />
        <StatCard
          title="Pending Approval"
          value={stats.todayPending}
          icon={<Clock className="h-5 w-5 text-[var(--color-warning)]" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Simple Bar Chart for last 7 days */}
        <Card className="p-6">
          <h2 className="mb-6 text-xl font-bold text-[var(--color-text-primary)]">
            Last 7 Days (Issued Passes)
          </h2>
          <div className="flex h-48 items-end gap-3 px-2">
            {historicalData.map((data, i) => {
              const max = Math.max(...historicalData.map(d => d.count), 10); // min height baseline
              const height = `${(data.count / max) * 100}%`;
              return (
                <div key={i} className="flex flex-1 flex-col items-center justify-end group">
                  <div 
                    className="w-full max-w-[48px] rounded-t-md transition-all duration-300 group-hover:opacity-80 group-hover:scale-y-105 origin-bottom shadow-sm"
                    style={{ height, backgroundColor: 'var(--color-brand)' }}
                    title={`${data.count} passes`}
                  />
                  <span className="mt-3 text-[11px] font-medium text-[var(--color-text-muted)]">
                    {data.date.split(' ')[1]}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Quick Actions / Summary */}
        <Card className="p-6">
           <h2 className="mb-6 text-xl font-bold text-[var(--color-text-primary)]">
            Today's Summary
          </h2>
          <div className="space-y-5">
             <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
               <span className="text-sm font-medium text-[var(--color-text-secondary)]">Approved & Inside</span>
               <span className="font-bold text-lg text-[var(--color-success)]">{stats.todayInside}</span>
             </div>
             <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
               <span className="text-sm font-medium text-[var(--color-text-secondary)]">Completed Visits</span>
               <span className="font-bold text-lg text-[var(--color-text-primary)]">{stats.todayExited}</span>
             </div>
             <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
               <span className="text-sm font-medium text-[var(--color-text-secondary)]">Rejected</span>
               <span className="font-bold text-lg text-[var(--color-danger)]">{stats.todayRejected}</span>
             </div>
             <div className="flex items-center justify-between pt-1">
               <span className="text-sm font-medium text-[var(--color-text-secondary)]">Avg Decision Time</span>
               <span className="font-bold text-lg text-[var(--color-brand)]">{stats.avgDecisionTime}</span>
             </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

