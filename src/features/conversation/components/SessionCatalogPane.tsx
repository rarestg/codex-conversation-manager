import type { ColumnDef, SortingState } from '@tanstack/react-table';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { RefreshCw, Search, X } from 'lucide-react';
import type { ClipboardEvent, KeyboardEvent } from 'react';
import { useCallback, useMemo, useState } from 'react';
import type {
  SessionCatalogExactFacetKey,
  SessionCatalogFacetValue,
  SessionCatalogRow,
  SessionCatalogSort,
} from '../../../../shared/sessionCatalogTypes';
import { SESSION_CATALOG_UNKNOWN_VALUE } from '../../../../shared/sessionCatalogTypes';
import { resolveSession } from '../api';
import { formatCompactCount, formatDurationMs, formatTimestamp, formatWorkspacePath } from '../format';
import { useSessionCatalog } from '../hooks/useSessionCatalog';
import { useSessionCatalogFacets } from '../hooks/useSessionCatalogFacets';
import type { LoadSessionHandler } from '../types';
import { CatalogSelect } from './CatalogSelect';
import { FacetFilterPopover } from './FacetFilterPopover';

interface SessionCatalogPaneProps {
  activeSessionId: string | null;
  loadingSession: boolean;
  onLoadSession: LoadSessionHandler;
  refreshKey?: number;
}

interface ActiveFacetFilter {
  key: SessionCatalogExactFacetKey;
  value: string;
  label: string;
}

const UNKNOWN_FACET_LABELS: Record<SessionCatalogExactFacetKey, string> = {
  workspaces: 'Unknown workspace',
  gitRepos: 'Unknown repo',
  gitBranches: 'Unknown branch',
};

const PAGE_SIZE_OPTIONS = [25, 50, 100].map((value) => ({
  value: String(value),
  label: `${value} rows`,
}));

const SORT_OPTIONS: Array<{ value: SessionCatalogSort; label: string }> = [
  { value: 'recent', label: 'Recent activity' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'turns_desc', label: 'Most turns' },
  { value: 'messages_desc', label: 'Most messages' },
  { value: 'duration_desc', label: 'Longest active duration' },
];

const EMPTY_ROW_SELECTION: Record<string, boolean> = {};
const UUID_EXACT_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const sortToSorting = (sort: SessionCatalogSort): SortingState => {
  switch (sort) {
    case 'oldest':
      return [{ id: 'updated', desc: false }];
    case 'turns_desc':
      return [{ id: 'turnCount', desc: true }];
    case 'messages_desc':
      return [{ id: 'messageCount', desc: true }];
    case 'duration_desc':
      return [{ id: 'activeDurationMs', desc: true }];
    default:
      return [{ id: 'updated', desc: true }];
  }
};

const getSortLabel = (sort: SessionCatalogSort) => SORT_OPTIONS.find((option) => option.value === sort)?.label ?? sort;

const getFilterLabel = (key: SessionCatalogExactFacetKey, value: string) => {
  if (value === SESSION_CATALOG_UNKNOWN_VALUE) {
    return UNKNOWN_FACET_LABELS[key];
  }
  if (key === 'workspaces') {
    return formatWorkspacePath(value) || value;
  }
  return value;
};

const getFacetOptions = (
  facets: Record<SessionCatalogExactFacetKey, SessionCatalogFacetValue[]>,
  key: SessionCatalogExactFacetKey,
) => facets[key];

export const SessionCatalogPane = ({
  activeSessionId,
  loadingSession,
  onLoadSession,
  refreshKey = 0,
}: SessionCatalogPaneProps) => {
  const {
    contentQuery,
    setContentQuery,
    debouncedContentQuery,
    locatorQuery,
    setLocatorQuery,
    sort,
    setSort,
    setPage,
    pageSize,
    setPageSize,
    workspaces,
    gitRepos,
    gitBranches,
    toggleFilter,
    removeFilter,
    clearFacet,
    clearFilters,
    loading,
    error,
    rows,
    totalRows,
    totalPages,
    appliedQuery,
    refresh,
  } = useSessionCatalog({ refreshKey });
  const [locatorStatus, setLocatorStatus] = useState<string | null>(null);
  const [resolvingLocator, setResolvingLocator] = useState(false);
  const [facetRefreshNonce, setFacetRefreshNonce] = useState(0);
  const facetRefreshKey = `${refreshKey}:${facetRefreshNonce}`;

  const facetQuery = useMemo(
    () => ({
      contentQuery: debouncedContentQuery,
      locatorQuery: locatorQuery.trim(),
      workspaces,
      gitRepos,
      gitBranches,
    }),
    [debouncedContentQuery, gitBranches, gitRepos, locatorQuery, workspaces],
  );

  const {
    facets,
    loading: loadingFacets,
    error: facetError,
  } = useSessionCatalogFacets({
    query: facetQuery,
    refreshKey: facetRefreshKey,
  });

  const activeFilters = useMemo<ActiveFacetFilter[]>(
    () => [
      ...workspaces.map((value) => ({ key: 'workspaces' as const, value, label: getFilterLabel('workspaces', value) })),
      ...gitRepos.map((value) => ({ key: 'gitRepos' as const, value, label: getFilterLabel('gitRepos', value) })),
      ...gitBranches.map((value) => ({
        key: 'gitBranches' as const,
        value,
        label: getFilterLabel('gitBranches', value),
      })),
    ],
    [gitBranches, gitRepos, workspaces],
  );

  const columns = useMemo<ColumnDef<SessionCatalogRow>[]>(
    () => [
      {
        id: 'session',
        header: 'Session',
        cell: ({ row }) => {
          const item = row.original;
          const title = item.preview?.trim() || item.filename;
          const secondary = item.sessionId || item.filename;
          return (
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-slate-900">{title}</div>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                <span className="truncate">{secondary}</span>
                {item.matchCount ? (
                  <span className="inline-flex shrink-0 items-center rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
                    {formatCompactCount(item.matchCount)} matches
                  </span>
                ) : null}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'cwd',
        id: 'workspace',
        header: 'Workspace',
        cell: ({ row }) => (
          <span className="block truncate text-xs text-slate-600">{formatWorkspacePath(row.original.cwd) || '—'}</span>
        ),
      },
      {
        accessorKey: 'timestamp',
        id: 'updated',
        header: 'Updated',
        cell: ({ row }) => {
          const value = row.original.timestamp || row.original.startedAt || row.original.endedAt;
          return <span className="text-xs text-slate-600">{formatTimestamp(value, false) || '—'}</span>;
        },
      },
      {
        accessorKey: 'turnCount',
        id: 'turnCount',
        header: 'Turns',
        cell: ({ row }) => (
          <span className="text-xs font-medium text-slate-700">
            {formatCompactCount(row.original.turnCount) || '—'}
          </span>
        ),
      },
      {
        accessorKey: 'messageCount',
        id: 'messageCount',
        header: 'Msgs',
        cell: ({ row }) => (
          <span className="text-xs font-medium text-slate-700">
            {formatCompactCount(row.original.messageCount) || '—'}
          </span>
        ),
      },
      {
        accessorKey: 'activeDurationMs',
        id: 'activeDurationMs',
        header: 'Active',
        cell: ({ row }) => (
          <span className="text-xs text-slate-600">{formatDurationMs(row.original.activeDurationMs) || '—'}</span>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
    manualSorting: true,
    state: {
      rowSelection: activeSessionId ? { [activeSessionId]: true } : EMPTY_ROW_SELECTION,
      sorting: sortToSorting(sort),
    },
  });

  const firstRowIndex = totalRows === 0 ? 0 : (appliedQuery.page - 1) * appliedQuery.pageSize + 1;
  const lastRowIndex = totalRows === 0 ? 0 : Math.min(totalRows, firstRowIndex + rows.length - 1);
  const isContentPending = contentQuery.trim() !== debouncedContentQuery;

  const resolveLocatorQuery = useCallback(
    async (query: string) => {
      if (!query || resolvingLocator) return;
      setResolvingLocator(true);
      setLocatorStatus(null);
      try {
        const requestId = `catalog-resolve-${Date.now().toString(36)}`;
        const resolved = await resolveSession(query, null, requestId);
        if (!resolved) {
          setLocatorStatus('No exact session match.');
          return;
        }
        const loadResult = await onLoadSession(resolved);
        if (loadResult.ok) {
          setLocatorStatus(`Opened ${resolved}`);
          return;
        }
        if (loadResult.reason === 'failed') {
          setLocatorStatus(`Failed to load ${resolved}`);
        }
      } catch (nextError: any) {
        setLocatorStatus(nextError?.message || 'Unable to resolve session.');
      } finally {
        setResolvingLocator(false);
      }
    },
    [onLoadSession, resolvingLocator],
  );

  const handleLocatorEnter = useCallback(
    async (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== 'Enter') return;
      const query = locatorQuery.trim();
      if (!query || resolvingLocator) return;
      event.preventDefault();
      await resolveLocatorQuery(query);
    },
    [locatorQuery, resolveLocatorQuery, resolvingLocator],
  );

  const handleLocatorPaste = useCallback(
    async (event: ClipboardEvent<HTMLInputElement>) => {
      const pasted = event.clipboardData?.getData('text')?.trim() ?? '';
      if (!pasted || !UUID_EXACT_REGEX.test(pasted) || resolvingLocator) return;
      event.preventDefault();
      setLocatorQuery(pasted);
      await resolveLocatorQuery(pasted);
    },
    [resolveLocatorQuery, resolvingLocator, setLocatorQuery],
  );

  const handleRowActivate = useCallback(
    async (row: SessionCatalogRow) => {
      setLocatorStatus(null);
      const searchQuery = row.matchCount ? appliedQuery.contentQuery : null;
      const turnId =
        searchQuery && typeof row.firstMatchTurnId === 'number' && row.firstMatchTurnId > 0
          ? row.firstMatchTurnId
          : undefined;
      await onLoadSession(row.id, turnId, { searchQuery });
    },
    [appliedQuery.contentQuery, onLoadSession],
  );

  const facetBuckets = useMemo(
    () => ({
      workspaces: facets.workspaces,
      gitRepos: facets.gitRepos,
      gitBranches: facets.gitBranches,
    }),
    [facets.gitBranches, facets.gitRepos, facets.workspaces],
  );

  const handleRefresh = useCallback(() => {
    setFacetRefreshNonce((current) => current + 1);
    refresh();
  }, [refresh]);

  return (
    <section className="flex h-full min-h-0 flex-col rounded-3xl border border-white/70 bg-white/80 shadow-card backdrop-blur">
      <div className="border-b border-slate-200/80 px-4 py-4 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-700">Session catalog</p>
            <h2 className="mt-1 text-xl text-slate-900">Browse sessions</h2>
            <p className="mt-1 text-sm text-slate-600">
              Filter the indexed session list, then load a conversation on the right.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
            aria-label="Refresh catalog"
            title="Refresh catalog"
          >
            <RefreshCw className={['h-4 w-4', loading || loadingFacets ? 'animate-spin' : ''].join(' ')} />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)_172px_132px]">
          <label className="flex min-w-0 flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Content</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={contentQuery}
                onChange={(event) => setContentQuery(event.target.value)}
                placeholder="Search conversation content"
                className="search-input h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-700 shadow-sm focus:border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-200"
              />
            </div>
          </label>

          <label className="flex min-w-0 flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Locator</span>
            <input
              type="text"
              value={locatorQuery}
              onChange={(event) => {
                setLocatorQuery(event.target.value);
                setLocatorStatus(null);
              }}
              onPaste={handleLocatorPaste}
              onKeyDown={handleLocatorEnter}
              placeholder="Session id, filename, or path"
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm focus:border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-200"
            />
          </label>

          <CatalogSelect
            label="Sort"
            value={sort}
            options={SORT_OPTIONS}
            onValueChange={(value) => setSort(value as SessionCatalogSort)}
          />

          <CatalogSelect
            label="Page size"
            value={String(pageSize)}
            options={PAGE_SIZE_OPTIONS}
            onValueChange={(value) => setPageSize(Number(value))}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <FacetFilterPopover
            label="Workspace"
            options={getFacetOptions(facetBuckets, 'workspaces')}
            selectedValues={workspaces}
            loading={loadingFacets}
            emptyLabel="No matching workspaces."
            onToggle={(value) => toggleFilter('workspaces', value)}
            onClear={() => clearFacet('workspaces')}
            renderValue={(value) =>
              value === SESSION_CATALOG_UNKNOWN_VALUE
                ? UNKNOWN_FACET_LABELS.workspaces
                : formatWorkspacePath(value) || value
            }
          />
          <FacetFilterPopover
            label="Repo"
            options={getFacetOptions(facetBuckets, 'gitRepos')}
            selectedValues={gitRepos}
            loading={loadingFacets}
            emptyLabel="No matching repos."
            onToggle={(value) => toggleFilter('gitRepos', value)}
            onClear={() => clearFacet('gitRepos')}
          />
          <FacetFilterPopover
            label="Branch"
            options={getFacetOptions(facetBuckets, 'gitBranches')}
            selectedValues={gitBranches}
            loading={loadingFacets}
            emptyLabel="No matching branches."
            onToggle={(value) => toggleFilter('gitBranches', value)}
            onClear={() => clearFacet('gitBranches')}
          />
          {activeFilters.length > 0 ? (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
            >
              Clear filters
            </button>
          ) : null}
        </div>

        {activeFilters.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {activeFilters.map((filter) => (
              <button
                key={`${filter.key}:${filter.value}`}
                type="button"
                onClick={() => removeFilter(filter.key, filter.value)}
                className="inline-flex max-w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900"
                title={`Remove ${filter.label}`}
              >
                <span className="uppercase tracking-[0.16em] text-[10px] font-semibold text-slate-500">
                  {filter.key === 'workspaces' ? 'Workspace' : filter.key === 'gitRepos' ? 'Repo' : 'Branch'}
                </span>
                <span className="truncate">{filter.label}</span>
                <X className="h-3.5 w-3.5 shrink-0" />
              </button>
            ))}
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex flex-wrap items-center gap-2">
            <span>
              {loading
                ? 'Loading…'
                : `Showing ${firstRowIndex}-${lastRowIndex} of ${totalRows.toLocaleString()} sessions`}
            </span>
            {isContentPending ? (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px]">Waiting for input…</span>
            ) : null}
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px]">Sort: {getSortLabel(sort)}</span>
            {loadingFacets ? (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px]">Updating facet counts…</span>
            ) : null}
          </div>
          {locatorStatus ? <span className="text-[11px] text-slate-500">{locatorStatus}</span> : null}
        </div>
        {facetError ? <p className="mt-2 text-xs text-amber-700">{facetError}</p> : null}
        {error ? (
          <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-2 pb-2 sm:px-3">
        <table className="min-w-full table-fixed border-separate border-spacing-0">
          <thead className="sticky top-0 z-10 bg-white/95 backdrop-blur">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="border-b border-slate-200 px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 first:rounded-tl-2xl last:rounded-tr-2xl"
                  >
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-10">
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
                    {loading ? 'Loading session catalog…' : 'No sessions matched the current catalog query.'}
                  </div>
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => {
                const isSelected = row.original.id === activeSessionId;
                return (
                  <tr
                    key={row.id}
                    tabIndex={0}
                    aria-selected={isSelected}
                    onClick={() => void handleRowActivate(row.original)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      void handleRowActivate(row.original);
                    }}
                    className={[
                      'cursor-pointer transition focus:outline-none',
                      isSelected ? 'bg-teal-50/70' : 'hover:bg-slate-50/90',
                      loadingSession && isSelected ? 'opacity-70' : '',
                    ].join(' ')}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className={[
                          'border-b border-slate-100 px-3 py-3 align-top',
                          isSelected ? 'first:border-l-2 first:border-l-teal-500' : '',
                        ].join(' ')}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-slate-200/80 px-4 py-3 sm:px-5">
        <div className="text-xs text-slate-500">
          Page {appliedQuery.page} of {Math.max(totalPages, 1)}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage(appliedQuery.page - 1)}
            disabled={appliedQuery.page <= 1 || loading}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setPage(appliedQuery.page + 1)}
            disabled={appliedQuery.page >= totalPages || loading}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
};
