import PropTypes from "prop-types";

const PAGE_SIZES = [10, 25, 50, 100];

const PointsPagination = ({ pagination, onChange }) => {
  const page = Number(pagination?.page || 1);
  const limit = Number(pagination?.limit || 25);
  const total = Number(pagination?.total || 0);
  const totalPages = Math.max(1, Number(pagination?.totalPages || 1));
  const first = total ? (page - 1) * limit + 1 : 0;
  const last = Math.min(page * limit, total);
  return (
    <nav className="points-pagination" aria-label="Table pagination">
      <div>
        <label>
          Rows
          <select
            value={limit}
            onChange={(event) =>
              onChange({ page: 1, limit: Number(event.target.value) })
            }
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <span>
          Showing {first}-{last} of {total}
        </span>
      </div>
      <div>
        <button
          type="button"
          className="btn btn-light"
          disabled={page <= 1}
          onClick={() => onChange({ page: page - 1, limit })}
        >
          Previous
        </button>
        <span>
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          className="btn btn-light"
          disabled={page >= totalPages}
          onClick={() => onChange({ page: page + 1, limit })}
        >
          Next
        </button>
      </div>
    </nav>
  );
};

PointsPagination.propTypes = {
  pagination: PropTypes.shape({
    page: PropTypes.number,
    limit: PropTypes.number,
    total: PropTypes.number,
    totalPages: PropTypes.number,
  }).isRequired,
  onChange: PropTypes.func.isRequired,
};

export default PointsPagination;

