import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  SessionCatalogAppliedQuery,
  SessionCatalogExactFacetKey,
  SessionCatalogResponse,
  SessionCatalogRow,
  SessionCatalogSort,
} from '../../../../shared/sessionCatalogTypes';
import { fetchSessionCatalog } from '../api';

const DEFAULT_PAGE_SIZE = 25;
const CONTENT_QUERY_DEBOUNCE_MS = 350;

const DEFAULT_APPLIED_QUERY: SessionCatalogAppliedQuery = {
  contentQuery: null,
  locatorQuery: null,
  workspaces: [],
  gitRepos: [],
  gitBranches: [],
  sort: 'recent',
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
};

interface UseSessionCatalogOptions {
  refreshKey?: number;
}

const toggleFacetValue = (values: string[], value: string) =>
  values.includes(value) ? values.filter((current) => current !== value) : [...values, value];

const removeFacetValue = (values: string[], value: string) => values.filter((current) => current !== value);

export const useSessionCatalog = ({ refreshKey = 0 }: UseSessionCatalogOptions = {}) => {
  const [contentQuery, setContentQueryState] = useState('');
  const [debouncedContentQuery, setDebouncedContentQuery] = useState('');
  const [locatorQuery, setLocatorQueryState] = useState('');
  const [sort, setSortState] = useState<SessionCatalogSort>('recent');
  const [page, setPageState] = useState(1);
  const [pageSize, setPageSizeState] = useState(DEFAULT_PAGE_SIZE);
  const [workspaces, setWorkspacesState] = useState<string[]>([]);
  const [gitRepos, setGitReposState] = useState<string[]>([]);
  const [gitBranches, setGitBranchesState] = useState<string[]>([]);
  const [rows, setRows] = useState<SessionCatalogRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [appliedQuery, setAppliedQuery] = useState<SessionCatalogAppliedQuery>(DEFAULT_APPLIED_QUERY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualRefreshNonce, setManualRefreshNonce] = useState(0);
  const requestIdRef = useRef(0);
  const refreshSignature = `${refreshKey}:${manualRefreshNonce}`;

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedContentQuery(contentQuery.trim());
    }, CONTENT_QUERY_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [contentQuery]);

  useEffect(() => {
    const controller = new AbortController();
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    const requestKey = `${requestId}:${refreshSignature}`;
    const isStale = () => controller.signal.aborted || `${requestIdRef.current}:${refreshSignature}` !== requestKey;
    setLoading(true);
    setError(null);

    fetchSessionCatalog(
      {
        contentQuery: debouncedContentQuery,
        locatorQuery: locatorQuery.trim(),
        workspaces,
        gitRepos,
        gitBranches,
        sort,
        page,
        pageSize,
      },
      { signal: controller.signal },
    )
      .then((response: SessionCatalogResponse) => {
        if (isStale()) return;
        setRows(response.rows);
        setTotalRows(response.totalRows);
        setTotalPages(Math.max(response.totalPages, 1));
        setAppliedQuery(response.appliedQuery);
        if (response.appliedQuery.page !== page) {
          setPageState(response.appliedQuery.page);
        }
        if (response.appliedQuery.pageSize !== pageSize) {
          setPageSizeState(response.appliedQuery.pageSize);
        }
      })
      .catch((nextError: any) => {
        if (isStale()) return;
        const message =
          nextError?.name === 'AbortError' ? null : nextError?.message || 'Unable to load session catalog.';
        if (!message) return;
        setRows([]);
        setTotalRows(0);
        setTotalPages(1);
        setError(message);
      })
      .finally(() => {
        if (isStale()) return;
        setLoading(false);
      });

    return () => controller.abort();
  }, [debouncedContentQuery, gitBranches, gitRepos, locatorQuery, page, pageSize, refreshSignature, sort, workspaces]);

  const setContentQuery = useCallback((value: string) => {
    setPageState(1);
    setContentQueryState(value);
  }, []);

  const setLocatorQuery = useCallback((value: string) => {
    setPageState(1);
    setLocatorQueryState(value);
  }, []);

  const setSort = useCallback((value: SessionCatalogSort) => {
    setPageState(1);
    setSortState(value);
  }, []);

  const setPage = useCallback((value: number) => {
    setPageState(Math.max(1, value));
  }, []);

  const setPageSize = useCallback((value: number) => {
    setPageState(1);
    setPageSizeState(Math.max(1, value));
  }, []);

  const toggleFilter = useCallback((facet: SessionCatalogExactFacetKey, value: string) => {
    setPageState(1);
    if (facet === 'workspaces') {
      setWorkspacesState((current) => toggleFacetValue(current, value));
      return;
    }
    if (facet === 'gitRepos') {
      setGitReposState((current) => toggleFacetValue(current, value));
      return;
    }
    setGitBranchesState((current) => toggleFacetValue(current, value));
  }, []);

  const removeFilter = useCallback((facet: SessionCatalogExactFacetKey, value: string) => {
    setPageState(1);
    if (facet === 'workspaces') {
      setWorkspacesState((current) => removeFacetValue(current, value));
      return;
    }
    if (facet === 'gitRepos') {
      setGitReposState((current) => removeFacetValue(current, value));
      return;
    }
    setGitBranchesState((current) => removeFacetValue(current, value));
  }, []);

  const clearFacet = useCallback((facet: SessionCatalogExactFacetKey) => {
    setPageState(1);
    if (facet === 'workspaces') {
      setWorkspacesState([]);
      return;
    }
    if (facet === 'gitRepos') {
      setGitReposState([]);
      return;
    }
    setGitBranchesState([]);
  }, []);

  const clearFilters = useCallback(() => {
    setPageState(1);
    setWorkspacesState([]);
    setGitReposState([]);
    setGitBranchesState([]);
  }, []);

  const refresh = useCallback(() => {
    setManualRefreshNonce((current) => current + 1);
  }, []);

  return {
    contentQuery,
    setContentQuery,
    debouncedContentQuery,
    locatorQuery,
    setLocatorQuery,
    sort,
    setSort,
    page,
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
  };
};
