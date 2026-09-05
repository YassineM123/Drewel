import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getUserDetail } from "../utils/api";
import { deleteUser } from "../api/domains/users";

const formatDate = (value) => value ? new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
}).format(new Date(value)) : "Not available";

const formatStatus = (value) => String(value || "not available").replaceAll("_", " ");

const phoneLabel = (user) => `${user?.countryCode || ""} ${user?.phone || ""}`.trim() || "Not available";

const DetailItem = ({ label, value }) => (
  <div>
    <dt>{label}</dt>
    <dd>{value || "Not available"}</dd>
  </div>
);

const UserDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDetail = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      setUser(await getUserDetail(id));
    } catch (detailError) {
      setUser(null);
      setError(detailError?.response?.data?.message || "User details could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) loadDetail();
  }, [id, loadDetail]);

  const notificationPrefs = useMemo(() => {
    const notifications = user?.preferences?.notifications || {};
    return Object.entries(notifications)
      .filter(([, value]) => value === true)
      .map(([key]) => formatStatus(key))
      .join(", ");
  }, [user]);

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to completely delete this passenger account? All associated data will be removed.")) {
      return;
    }
    try {
      setLoading(true);
      await deleteUser(id);
      navigate("/users", { replace: true });
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to delete user.");
      setLoading(false);
    }
  };

  if (loading) {
    return <main className="app-content requests-page"><div className="tile requests-detail-state" aria-live="polite"><div className="loader"/><span>Loading user profile...</span></div></main>;
  }

  if (error || !user) {
    return <main className="app-content requests-page"><div className="tile requests-detail-state" role="alert"><i className="fa fa-exclamation-circle" aria-hidden="true"/><h1>User unavailable</h1><p>{error || "User not found."}</p><div><button type="button" className="btn btn-outline-secondary mr-2" onClick={() => navigate(-1)}>Back</button><button type="button" className="btn btn-primary" onClick={loadDetail}>Retry</button></div></div></main>;
  }

  return <main className="app-content requests-page request-detail-page">
    <header className="app-title tile p-3 request-detail-header">
      <div>
        <button type="button" className="request-back-link" onClick={() => navigate(-1)}><i className="fa fa-arrow-left" aria-hidden="true"/> Back to users</button>
        <div className="request-detail-title">
          <div>
            <span>Passenger profile</span>
            <h1>{user.fullName || user.name || "Passenger"}</h1>
            <p>User ID: <strong>{user._id || id}</strong></p>
          </div>
          <span className={`badge ${user.isRestricted ? "badge-danger" : "badge-success"}`}>
            {user.isRestricted ? "RESTRICTED" : "ACTIVE"}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" className="btn btn-outline-danger" disabled={loading} onClick={handleDelete}>Delete Account</button>
        <button type="button" className="btn btn-outline-primary" disabled={loading} onClick={loadDetail}>Refresh</button>
      </div>
    </header>

    <div className="request-detail-layout">
      <div>
        <section className="tile p-4 request-detail-section" aria-labelledby="profile-title">
          <div className="request-section-heading"><div><span>Account</span><h2 id="profile-title">Personal information</h2></div></div>
          <dl className="request-info-grid">
            <DetailItem label="Full name" value={user.fullName || user.name} />
            <DetailItem label="Phone" value={phoneLabel(user)} />
            <DetailItem label="Email" value={user.email} />
            <DetailItem label="Verified" value={user.isVerified ? "Yes" : "No"} />
            <DetailItem label="Joined" value={formatDate(user.createdAt)} />
            <DetailItem label="Updated" value={formatDate(user.updatedAt)} />
          </dl>
        </section>

        <section className="tile p-4 request-detail-section" aria-labelledby="places-title">
          <div className="request-section-heading"><div><span>Profile</span><h2 id="places-title">Saved places</h2></div><span>{user.savedPlaces?.length || 0} places</span></div>
          {user.savedPlaces?.length ? <div className="request-documents-grid">
            {user.savedPlaces.map((place) => <article className="request-document-card is-available" key={place.id}>
              <div className="request-document-content">
                <span>{formatStatus(place.type)}</span>
                <h4>{place.name}</h4>
                <span className="request-document-availability available">{place.address}</span>
                <small>{Number(place.lat).toFixed(5)}, {Number(place.long).toFixed(5)}</small>
              </div>
            </article>)}
          </div> : <p className="request-muted">No saved places returned for this passenger.</p>}
        </section>

        <section className="tile p-4 request-detail-section" aria-labelledby="rides-title">
          <div className="request-section-heading"><div><span>Activity</span><h2 id="rides-title">Recent rides</h2></div></div>
          {user.recentRides?.length ? <ol className="request-history">
            {user.recentRides.map((ride) => <li key={ride._id}>
              <span className="request-history__dot badge-primary" aria-hidden="true"/>
              <div>
                <strong>{ride.reference || ride._id} / {formatStatus(ride.status)}</strong>
                <span>{ride.pickup?.address || "Pickup not available"} to {ride.destination?.address || "Destination not available"}</span>
                <small>{formatDate(ride.updatedAt || ride.requestedAt)}</small>
              </div>
            </li>)}
          </ol> : <p className="request-muted">No ride history returned for this passenger.</p>}
        </section>
      </div>

      <aside>
        <section className="tile p-4 request-detail-section" aria-labelledby="summary-title">
          <div className="request-section-heading"><div><span>Dashboard</span><h2 id="summary-title">Passenger summary</h2></div></div>
          <dl className="request-review-list">
            <DetailItem label="Total rides" value={String(user.rideSummary?.total || 0)} />
            <DetailItem label="Completed rides" value={String(user.rideSummary?.completed || 0)} />
            <DetailItem label="Cancelled rides" value={String(user.rideSummary?.cancelled || 0)} />
            <DetailItem label="Disputed rides" value={String(user.rideSummary?.disputed || 0)} />
          </dl>
        </section>

        <section className="tile p-4 request-detail-section" aria-labelledby="preferences-title">
          <div className="request-section-heading"><div><span>Settings</span><h2 id="preferences-title">Preferences</h2></div></div>
          <dl className="request-review-list">
            <DetailItem label="Language" value={(user.preferences?.language || "en").toUpperCase()} />
            <DetailItem label="Notifications" value={notificationPrefs || "None enabled"} />
          </dl>
        </section>

        <section className="tile p-4 request-detail-section" aria-labelledby="support-title">
          <div className="request-section-heading"><div><span>Support</span><h2 id="support-title">Reports</h2></div><span>{user.supportReports?.length || 0} reports</span></div>
          {user.supportReports?.length ? <ol className="request-history">
            {user.supportReports.map((report) => <li key={report._id}>
              <span className="request-history__dot badge-warning" aria-hidden="true"/>
              <div>
                <strong>{formatStatus(report.category)} / {formatStatus(report.status)}</strong>
                <span>{report.description}</span>
                <small>{formatDate(report.createdAt)}</small>
              </div>
            </li>)}
          </ol> : <p className="request-muted">No support reports returned.</p>}
        </section>

        <section className="tile p-4 request-detail-section" aria-labelledby="communication-title">
          <div className="request-section-heading"><div><span>Communication</span><h2 id="communication-title">Recent evidence</h2></div></div>
          <dl className="request-review-list">
            <DetailItem label="Recent messages" value={String(user.recentMessages?.length || 0)} />
          </dl>
        </section>
      </aside>
    </div>
  </main>;
};

export default UserDetail;
