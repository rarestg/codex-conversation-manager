import { useEffect, useRef, useState } from 'react';
import type { SessionCatalogFacetsResponse, SessionCatalogQuery } from '../../../../shared/sessionCatalogTypes';
import { fetchSessionCatalogFacets } from '../api';

const EMPTY_FACETS: SessionCatalogFacetsResponse = {
  workspaces: [],
  gitRepos: [],
  gitBranches: [],
  appliedQuery: {
    contentQuery: null,
    locatorQuery: null,
    workspaces: [],
    gitRepos: [],
    gitBranches: [],
    sort: 'recent',
    page: 1,
    pageSize: 25,
  },
};

interface UseSessionCatalogFacetsOptions {
  query: Pick<SessionCatalogQuery, 'contentQuery' | 'locatorQuery' | 'workspaces' | 'gitRepos' | 'gitBranches'>;
  refreshKey?: number | string;
}

export const useSessionCatalogFacets = ({ query, refreshKey = 0 }: UseSessionCatalogFacetsOptions) => {
  const [facets, setFacets] = useState<SessionCatalogFacetsResponse>(EMPTY_FACETS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    const requestKey = `${requestId}:${refreshKey}`;
    const isStale = () => controller.signal.aborted || `${requestIdRef.current}:${refreshKey}` !== requestKey;

    setLoading(true);
    setError(null);

    fetchSessionCatalogFacets(query, { signal: controller.signal })
      .then((response) => {
        if (isStale()) return;
        setFacets(response);
      })
      .catch((nextError: any) => {
        if (isStale()) return;
        const message =
          nextError?.name === 'AbortError' ? null : nextError?.message || 'Unable to load catalog filters.';
        if (!message) return;
        setFacets(EMPTY_FACETS);
        setError(message);
      })
      .finally(() => {
        if (isStale()) return;
        setLoading(false);
      });

    return () => controller.abort();
  }, [query, refreshKey]);

  return {
    facets,
    loading,
    error,
  };
};
