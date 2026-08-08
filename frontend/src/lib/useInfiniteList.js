import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from './api';

/**
 * useInfiniteList
 * Fetches a paginated backend endpoint and accumulates results page by
 * page, instead of pulling the entire collection in one shot. Pairs with
 * <InfiniteSentinel /> to trigger the next page as the user scrolls.
 *
 * @param {(page: number, limit: number) => string} buildUrl
 *   Returns the endpoint (including query string) for a given page.
 * @param {any[]} deps
 *   When any value here changes, the list resets and re-fetches from page 1
 *   (use this for filters/search that should hit the server again).
 * @param {number} [limit=30]
 */
export function useInfiniteList(buildUrl, deps = [], limit = 30) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);

  const pageRef = useRef(1);
  const loadingRef = useRef(false);
  const buildUrlRef = useRef(buildUrl);
  buildUrlRef.current = buildUrl;

  const fetchPage = useCallback(async (pageNum, replace) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (replace) setLoading(true);
    else setLoadingMore(true);

    const url = buildUrlRef.current(pageNum, limit);
    const d = await apiRequest(url);

    if (d && d.success) {
      setItems((prev) => (replace ? d.data : [...prev, ...d.data]));
      setHasMore(!!d.hasMore);
      setTotal(d.total ?? d.data.length);
    } else if (replace) {
      setItems([]);
      setHasMore(false);
    }

    setLoading(false);
    setLoadingMore(false);
    loadingRef.current = false;
  }, [limit]);

  // Reset & reload whenever filters/search deps change.
  useEffect(() => {
    pageRef.current = 1;
    setHasMore(true);
    fetchPage(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const loadMore = useCallback(() => {
    if (loadingRef.current || !hasMore) return;
    const next = pageRef.current + 1;
    pageRef.current = next;
    fetchPage(next, false);
  }, [fetchPage, hasMore]);

  const refresh = useCallback(() => {
    pageRef.current = 1;
    fetchPage(1, true);
  }, [fetchPage]);

  return { items, setItems, loading, loadingMore, hasMore, total, loadMore, refresh };
}
