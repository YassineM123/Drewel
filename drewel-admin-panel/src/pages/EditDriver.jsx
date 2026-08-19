import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { getDriverDetail } from "../api/domains/drivers";
import { apiClient } from "../utils/api";
import { Card, Button, Toast, LoadingState, ErrorState } from "../components/ui";

const FIELDS = [
  { key: "firstName", label: "First Name", type: "text", required: true, group: "Personal" },
  { key: "lastName", label: "Last Name", type: "text", required: true, group: "Personal" },
  { key: "fullName", label: "Full Name", type: "text", group: "Personal" },
  { key: "email", label: "Email", type: "email", group: "Contact" },
  { key: "phone", label: "Phone", type: "tel", group: "Contact" },
  { key: "countryCode", label: "Country Code", type: "text", group: "Contact" },
  { key: "whatsappNumber", label: "WhatsApp", type: "tel", group: "Contact" },
  { key: "address", label: "Address", type: "text", group: "Location" },
  { key: "city", label: "City", type: "text", group: "Location" },
  { key: "lat", label: "Latitude", type: "number", group: "Location" },
  { key: "long", label: "Longitude", type: "number", group: "Location" },
  { key: "vehicleType", label: "Vehicle Type", type: "text", group: "Vehicle" },
  { key: "contractNumber", label: "Contract Number", type: "text", group: "Admin" },
  { key: "licenseCompany", label: "Licence Company", type: "text", group: "Admin" },
];

const EditDriver = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [driver, setDriver] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await getDriverDetail(id);
      setDriver(data);
      const init = {};
      FIELDS.forEach((f) => { init[f.key] = data?.[f.key] ?? ""; });
      setForm(init);
    } catch (err) {
      setError(err?.response?.data?.message || "Driver could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { if (id) load(); }, [id, load]);

  const handleChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiClient.put(`/driver/update-driver-details/${id}`, form);
      setToast("Driver details updated successfully.");
      setTimeout(() => navigate(-1), 1500);
    } catch (err) {
      setToast(err?.response?.data?.message || "Failed to update driver details.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState label="Loading driver..." />;
  if (error || !driver) {
    return (
      <ErrorState
        title="Driver not found"
        description={error || "Could not load driver data."}
        action={<Button variant="secondary" onClick={() => navigate(-1)}>Back</Button>}
      />
    );
  }

  const groups = [...new Set(FIELDS.map((f) => f.group))];

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <button type="button" onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-4 transition-colors">
          <ArrowLeft size={15} /> Back
        </button>
        <h1 className="text-xl font-semibold text-slate-800">Edit Driver</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {driver.firstName || ""} {driver.lastName || ""} — {driver._id}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {groups.map((group) => (
          <Card key={group} className="p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">{group}</h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              {FIELDS.filter((f) => f.group === group).map((field) => (
                <div key={field.key} className="flex flex-col gap-1.5">
                  <label htmlFor={field.key} className="text-xs font-medium text-slate-600">
                    {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
                  </label>
                  <input
                    id={field.key}
                    type={field.type}
                    step={field.type === "number" ? "any" : undefined}
                    value={form[field.key] ?? ""}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    required={field.required}
                    className="h-10 bg-white border border-slate-200 rounded-[10px] px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#BE1B2C]/20 focus:border-[#BE1B2C]/40 transition-all"
                  />
                </div>
              ))}
            </div>
          </Card>
        ))}

        <div className="flex justify-end gap-3">
          <Button variant="secondary" type="button" onClick={() => navigate(-1)}>Cancel</Button>
          <Button type="submit" disabled={saving} icon={saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>

      {toast && <Toast message={toast} type="success" onClose={() => setToast(null)} />}
    </div>
  );
};

export default EditDriver;
