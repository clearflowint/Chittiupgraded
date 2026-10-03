import React, { useState, useMemo } from 'react';
import { useChitFund } from '../context/ChitFundContext';
import { AuditRecord } from '../types';
import { ShieldCheck, Search, FileText, Calendar, Filter } from 'lucide-react';

export const AuditView: React.FC = () => {
  const { audits, fetchAuditsPage } = useChitFund();
  const [filterAction, setFilterAction] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [extraAudits, setExtraAudits] = useState<AuditRecord[]>([]);
  const [nextCursorDoc, setNextCursorDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);

  // Combine real-time recent audit window and paginated historical records
  const allLoadedAudits = useMemo(() => {
    const map = new Map<string, AuditRecord>();
    audits.forEach((a) => map.set(a.auditId, a));
    extraAudits.forEach((a) => map.set(a.auditId, a));
    return Array.from(map.values()).sort((a, b) => {
      const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.timestamp || 0).getTime();
      const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.timestamp || 0).getTime();
      return timeB - timeA;
    });
  }, [audits, extraAudits]);

  const loadMoreAudits = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const result = await fetchAuditsPage(nextCursorDoc, 50);
      setExtraAudits((prev) => [...prev, ...result.items]);
      setNextCursorDoc(result.nextCursorDoc);
      setHasMore(result.hasMore);
    } catch (e) {
      console.warn('Error fetching audits page:', e);
    } finally {
      setLoadingMore(false);
    }
  };

  const filteredAudits = allLoadedAudits.filter((a) => {
    const matchesAction = filterAction === 'all' || a.action === filterAction;
    const matchesQuery = 
      (a.reason || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.entityId.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesAction && matchesQuery;
  });

  const actions = Array.from(new Set(allLoadedAudits.map(a => a.action)));

  const formatAuditTimestamp = (a: AuditRecord): string => {
    if (a.createdAt?.toDate) {
      return a.createdAt.toDate().toISOString().replace('T', ' ').slice(0, 19) + ' (Server)';
    }
    return (a.timestamp || '').replace('T', ' ').slice(0, 19);
  };

  return (
    <div className="space-y-6 pb-16">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <span className="text-[10px] font-mono-nums font-semibold uppercase tracking-wider text-slate-500">
            COMPLIANCE &amp; GOVERNANCE
          </span>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-slate-950">
            System Immutable Audit Trail
          </h1>
          <p className="text-xs text-slate-500 font-mono-nums mt-0.5">
            Append-only cryptographic operation logs · Server-authoritative timestamps · Strict tenant isolation
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono-nums font-semibold text-emerald-800 bg-emerald-50 px-3 py-1.5 border border-emerald-200">
            {allLoadedAudits.length} Records Loaded
          </span>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600 uppercase">Action Filter:</label>
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="px-3 py-1.5 text-xs border border-slate-300 focus:outline-none focus:border-emerald-600 bg-white font-mono-nums"
          >
            <option value="all">All Mutation Actions</option>
            {actions.map(action => (
              <option key={action} value={action}>{action}</option>
            ))}
          </select>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search audit trail or entity ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 focus:outline-none focus:border-emerald-600 bg-white"
          />
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider bg-slate-50/70">
                <th className="py-3 px-3">Timestamp</th>
                <th className="py-3 px-3">Action Type</th>
                <th className="py-3 px-3">Entity Type</th>
                <th className="py-3 px-3">Entity Ref</th>
                <th className="py-3 px-3">Audit Details &amp; Operational Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono-nums">
              {filteredAudits.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-xs text-slate-400 font-sans">
                    No audit records matching query.
                  </td>
                </tr>
              ) : (
                filteredAudits.map((a) => (
                  <tr key={a.auditId} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-3 text-slate-500 text-[11px] whitespace-nowrap">
                      {formatAuditTimestamp(a)}
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-semibold text-slate-900 text-xs">
                        {a.action}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-600 uppercase text-[10px] tracking-wider">
                      {a.entityType}
                    </td>
                    <td className="py-3 px-3 text-slate-500 text-[11px]">
                      {a.entityId.slice(-10)}
                    </td>
                    <td className="py-3 px-3 font-sans text-slate-700 max-w-md leading-relaxed text-xs">
                      {a.reason || 'State committed via operations console.'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {hasMore && (
          <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex justify-center">
            <button
              onClick={loadMoreAudits}
              disabled={loadingMore}
              className="px-4 py-2 text-xs font-semibold text-slate-800 bg-white hover:bg-slate-100 border border-slate-300 transition cursor-pointer disabled:opacity-50 font-mono-nums"
            >
              {loadingMore ? 'Loading Next Page...' : 'Load More Historical Audits (Cursor Pagination)'}
            </button>
          </div>
        )}
      </div>

    </div>
  );
};
