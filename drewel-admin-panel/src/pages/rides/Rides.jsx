import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listAdminRides, rideApiError } from "../../utils/ridesAdminApi";
import "../../assets/css/admin-rides.css";

const FILTERS = [
  ["requested", "Requested"],
  ["searching", "Searching"],
  ["assigned", "Assigned"],
  ["active", "Active"],
  ["completed", "Completed"],
  ["cancelled", "Cancelled"],
  ["all", "All reservations"],
];

const ACTIVE = new Set([
  "confirmed",
  "driver_on_the_way",
  "driver_arrived",
  "pickup_confirmed",
  "in_progress",
  "accepted",
  "driver_arriving",
  "disputed",
]);

const date = (value) => {
  const parsed = new Date(value);
  return value && !Number.isNaN(parsed.getTime()) ? parsed.toLocaleString() : "-";
};

const label = (value) => String(value || "unknown").replaceAll("_", " ");
const person = (value) => value?.fullName || value?.displayName || value?.name || "Drewel participant";
const place = (value) => value?.address || value?.label || value?.name || "-";

const badge = (status) => {
  if (ACTIVE.has(status)) return "ride-status--active";
  if (status === "completed") return "ride-status--success";
  if (String(status).startsWith("cancelled")) return "ride-status--danger";
  if (status === "disputed") return "ride-status--warning";
  return "";
};

const Rides = () => {
  const [filter, setFilter] = useState("active");
  const [search, setSearch] = useState("");
  const [driver, setDriver] = useState("");
  const [customer, setCustomer] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [state, setState] = useState({ loading: true, error: "", rides: [], pagination: {} });

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(async (signal) => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const payload = await listAdminRides(
        {
          status: filter,
          search: debouncedSearch,
          driver: driver.trim() || undefined,
          customer: customer.trim() || undefined,
          vehicleType: vehicleType.trim() || undefined,
          from: from || undefined,
          to: to || undefined,
          page,
          limit,
        },
        signal,
      );
      const rides = Array.isArray(payload?.rides) ? payload.rides : [];
      setState({
        loading: false,
        error: "",
        rides,
        pagination: payload?.pagination || {
          page,
          limit,
          total: rides.length,
          totalPages: 1,
        },
      });
    } catch (error) {
      if (error?.code !== "ERR_CANCELED") {
        setState((current) => ({
          ...current,
          loading: false,
          error: rideApiError(error, "Unable to load reservations."),
        }));
      }
    }
  }, [customer, debouncedSearch, driver, filter, from, limit, page, to, vehicleType]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const selectFilter = (value) => {
    setFilter(value);
    setPage(1);
  };

  const pagination = state.pagination;
  const totalPages = Math.max(1, Number(pagination.totalPages || 1));

  return (
    <main className="app-content admin-rides">
      <header className="app-title tile p-3 ride-heading">
        <div>
          <span className="points-eyebrow">Operations</span>
          <h1>Reservations</h1>
          <p>Monitor the live booking lifecycle, exceptions, point activity and audit evidence.</p>
        </div>
      </header>

      <nav className="tile ride-tabs" aria-label="Reservation status">
        {FILTERS.map(([value, text]) => (
          <button
            type="button"
            key={value}
            className={`ride-tab${filter === value ? " active" : ""}`}
            aria-pressed={filter === value}
            onClick={() => selectFilter(value)}
          >
            {text}
          </button>
        ))}
      </nav>

      <section className="tile ride-toolbar" aria-label="Reservation filters">
        <label>
          Search bookings
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Reference, booking ID, driver or customer"
          />
        </label>
        <label>
          Driver
          <input
            type="search"
            value={driver}
            onChange={(event) => {
              setDriver(event.target.value);
              setPage(1);
            }}
            placeholder="Name or ID"
          />
        </label>
        <label>
          Customer
          <input
            type="search"
            value={customer}
            onChange={(event) => {
              setCustomer(event.target.value);
              setPage(1);
            }}
            placeholder="Name or ID"
          />
        </label>
        <label>
          Vehicle type
          <input
            type="search"
            value={vehicleType}
            onChange={(event) => {
              setVehicleType(event.target.value);
              setPage(1);
            }}
            placeholder="Large Pickup"
          />
        </label>
        <label>
          From
          <input
            type="date"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <label>
          Rows per page
          <select
            value={limit}
            onChange={(event) => {
              setLimit(Number(event.target.value));
              setPage(1);
            }}
          >
            <option>10</option>
            <option>20</option>
            <option>50</option>
          </select>
        </label>
        <label>
          Data access
          <select disabled aria-label="Data access">
            <option>Authorized ride records only</option>
          </select>
        </label>
      </section>

      <section className="tile" aria-live="polite">
        {state.loading ? (
          <div className="ride-state">
            <div className="loader" />
            <span>Loading reservations...</span>
          </div>
        ) : state.error ? (
          <div className="ride-state" role="alert">
            <h2>Reservations unavailable</h2>
            <p>{state.error}</p>
            <button type="button" className="btn btn-outline-danger" onClick={() => load()}>
              Retry
            </button>
          </div>
        ) : state.rides.length === 0 ? (
          <div className="ride-state">
            <h2>No reservations found</h2>
            <p>There are no records matching this status and search.</p>
          </div>
        ) : (
          <div className="ride-table-wrap">
            <table className="ride-table">
              <caption className="sr-only">Drewel reservation records</caption>
              <thead>
                <tr>
                  <th>Reservation</th>
                  <th>Status</th>
                  <th>Customer</th>
                  <th>Driver</th>
                  <th>Pickup</th>
                  <th>Destination</th>
                  <th>Updated</th>
                  <th>Route / ETA</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {state.rides.map((ride) => (
                  <tr key={ride.id || ride._id}>
                    <td>
                      <strong>{ride.reference || ride.id || ride._id}</strong>
                    </td>
                    <td>
                      <span className={`ride-status ${badge(ride.status)}`}>{label(ride.status)}</span>
                    </td>
                    <td>{person(ride.user || ride.passenger)}</td>
                    <td>{person(ride.driver)}</td>
                    <td>{place(ride.pickup)}</td>
                    <td>{place(ride.destination)}</td>
                    <td>{date(ride.updatedAt)}</td>
                    <td>
                      {ride.etaMinutes != null ? `${ride.etaMinutes} min` : "-"}
                      <br />
                      <small>{ride.routeUpdatedAt ? `as of ${date(ride.routeUpdatedAt)}` : "No fresh route"}</small>
                    </td>
                    <td>
                      <Link className="btn btn-sm btn-outline-primary" to={`/reservations/${ride.id || ride._id}`}>
                        View details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!state.loading && !state.error && state.rides.length > 0 && (
          <nav className="ride-pagination" aria-label="Reservation pagination">
            <span>{Number(pagination.total || state.rides.length)} reservations</span>
            <div>
              <button
                type="button"
                className="btn btn-light"
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                Previous
              </button>
              <span>Page {page} of {totalPages}</span>
              <button
                type="button"
                className="btn btn-light"
                disabled={page >= totalPages}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </button>
            </div>
          </nav>
        )}
      </section>
    </main>
  );
};

export default Rides;
