export interface ListParams {
  page?: number;
  limit?: number;
  sort?: string;
  dir?: "asc" | "desc";
  search?: string;
  status?: string;
  filters?: Record<string, unknown>;
  range?: { from?: string | Date; to?: string | Date };
  [key: string]: unknown;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export const compactParams = (params: Record<string, unknown> = {}): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== "" && value !== "all",
    ),
  );

export const dateRangeParams = (range: { from?: string | Date | null; to?: string | Date | null } = {}) => {
  const { from, to } = range || {};
  const normalized: Record<string, string> = {};
  if (from !== undefined && from !== null && from !== "") {
    normalized.from = from instanceof Date ? from.toISOString() : String(from);
  }
  if (to !== undefined && to !== null && to !== "") {
    normalized.to = to instanceof Date ? to.toISOString() : String(to);
  }
  if (normalized.from && normalized.to && normalized.from > normalized.to) {
    throw new TypeError("from must not be later than to");
  }
  return normalized;
};

export const buildListParams = ({
  page = 1,
  limit = 20,
  sort,
  dir,
  search,
  status,
  filters = {},
  range,
}: ListParams = {}): Record<string, unknown> => {
  const params: Record<string, unknown> = {
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

export const toPagination = (payload: Record<string, unknown> = {}, fallbackLimit = 20): Pagination => {
  const source = (payload.pagination || payload.meta || payload) as Record<string, unknown>;
  const page = Number(source.page || source.currentPage || 1);
  const limit = Number(source.limit || source.perPage || source.pageSize || fallbackLimit);
  const total = Number(source.total ?? source.totalItems ?? source.count ?? 0);
  const totalPages = Number(source.totalPages || Math.max(1, Math.ceil(total / Math.max(1, limit))));
  return { page, limit, total, totalPages };
};
