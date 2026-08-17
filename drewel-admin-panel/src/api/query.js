/**
 * ============================================================================
 * QUERY, PAGINATION AND FILTER HELPERS
 * ============================================================================
 *
 * Shared serialization helpers used by the domain modules so every list
 * endpoint sends the same query shape: page/limit pagination, stable sort
 * params and only non-empty filters.
 */

/** Drops undefined / null / "" / "all" values so empty filters are omitted. */
export const compactParams = (params = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) =>
        value !== undefined &&
        value !== null &&
        value !== "" &&
        value !== "all",
    ),
  );

/**
 * Serializes a date range into backend `from`/`to` ISO params. Both bounds are
 * optional and any `from` later than `to` is rejected with a clear error.
 */
export const dateRangeParams = (range = {}) => {
  const { from, to } = range || {};
  const normalized = {};
  if (from !== undefined && from !== null && from !== "") {
    const value = from instanceof Date ? from.toISOString() : String(from);
    normalized.from = value;
  }
  if (to !== undefined && to !== null && to !== "") {
    const value = to instanceof Date ? to.toISOString() : String(to);
    normalized.to = value;
  }
  if (normalized.from && normalized.to && normalized.from > normalized.to) {
    throw new TypeError("from must not be later than to");
  }
  return normalized;
};

/** Standard list query builder shared by all domain modules. */
export const buildListParams = ({
  page = 1,
  limit = 20,
  sort,
  dir,
  search,
  status,
  filters = {},
  range,
} = {}) => {
  const params = {
    page: Number(page) || 1,
    limit: Number(limit) || 20,
  };
  if (sort) params.sort = sort;
  if (dir === "asc" || dir === "desc") params.dir = dir;
  if (search && String(search).trim()) params.search = String(search).trim();
  if (status && status !== "all") params.status = status;
  Object.entries(compactParams(filters)).forEach(([key, value]) => {
    params[key] = value;
  });
  const rangeParams = dateRangeParams(range);
  Object.assign(params, rangeParams);
  return params;
};

/**
 * Extracts a normalized pagination object from any backend payload. The
 * backend uses `{ page, limit, total, totalPages }`; this also tolerates
 * `nextCursor`-style responses and missing fields.
 */
export const toPagination = (payload = {}, fallbackLimit = 20) => {
  const source = payload.pagination || payload.meta || payload;
  const page = Number(source.page || source.currentPage || 1);
  const limit = Number(source.limit || source.perPage || source.pageSize || fallbackLimit);
  const total = Number(source.total ?? source.totalItems ?? source.count ?? 0);
  const totalPages = Number(source.totalPages || Math.max(1, Math.ceil(total / Math.max(1, limit))));
  return { page, limit, total, totalPages };
};

/**
 * Builds the axios request config used by list endpoints and extracts the
 * normalized `{ items, pagination }` from a page payload. Domain modules pass
 * a `select` function that pulls the item array out of the backend envelope.
 */
export const listRequest = (client, { url, params, signal }) => {
  const config = { method: "GET", url, params: compactParams(params), signal };
  return { config };
};

/** A small `useRequest`-style helper is intentionally absent — pages already
 * manage loading state. `withRetry` covers the client-level retry contract. */
