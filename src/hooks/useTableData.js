import React from 'react';
import { useAsyncData } from './useAsyncData';

export function useTableData({ loader, filters = {}, pageSize = 10 }) {
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(pageSize);
  const filterKey = React.useMemo(() => JSON.stringify(filters), [filters]);
  const { data, loading, error, reload, setData } = useAsyncData(loader, [loader, filterKey], { initialData: [] });

  React.useEffect(() => {
    setPage(1);
  }, [search, filterKey, limit]);

  const rows = Array.isArray(data) ? data : [];
  const normalizedSearch = search.trim().toLowerCase();
  const filteredRows = normalizedSearch
    ? rows.filter((row) => JSON.stringify(row).toLowerCase().includes(normalizedSearch))
    : rows;
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / limit));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * limit;
  const visibleRows = filteredRows.slice(start, start + limit);

  return {
    rows,
    filteredRows,
    visibleRows,
    loading,
    error,
    search,
    setSearch,
    page: currentPage,
    setPage,
    limit,
    setLimit,
    totalPages,
    total: filteredRows.length,
    reload,
    setData,
  };
}

