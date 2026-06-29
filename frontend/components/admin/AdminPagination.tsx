export const ADMIN_PANE_PAGE_SIZE = 6;

export function AdminPagination({ count, page, onPageChange, pageSize = ADMIN_PANE_PAGE_SIZE }: {
  count: number;
  page: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
}) {
  const pageCount = Math.max(1, Math.ceil(count / pageSize));
  if (count <= pageSize) return null;
  return <div className="admin-pagination" aria-label="List pagination">
    <button disabled={page <= 1} onClick={() => onPageChange(page - 1)} type="button">Previous</button>
    <span>Page {page} of {pageCount}</span>
    <button disabled={page >= pageCount} onClick={() => onPageChange(page + 1)} type="button">Next</button>
  </div>;
}

export function pageItems<T>(items: T[], page: number, pageSize = ADMIN_PANE_PAGE_SIZE) {
  return items.slice((page - 1) * pageSize, page * pageSize);
}
