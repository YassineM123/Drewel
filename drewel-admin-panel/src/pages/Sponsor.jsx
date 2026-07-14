import { useCallback, useEffect, useState } from "react";
import Swal from "sweetalert2";
import axios from "axios";
import { API_URL } from "../utils/api";
import SafeImage from "../components/SafeImage";

const baseURL = API_URL; // Centralized API URL
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

function Sponsor() {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [selectedBanner, setSelectedBanner] = useState(null);
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");

  // Fetch all banners
  const fetchBanners = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const token = localStorage.getItem("authToken");
      if (!token) throw new Error("Your session has expired. Please sign in again.");
      const res = await axios.get(`${baseURL}/banner/get-all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.data?.success || !Array.isArray(res.data?.banners)) {
        throw new Error(res.data?.message || "The server returned an invalid banner list.");
      }
      setBanners(res.data.banners);
    } catch (error) {
      setLoadError(getErrorMessage(error, "Failed to fetch banners."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchBanners();
  }, [fetchBanners]);

  // Open modal for create or edit
  const openModal = (banner = null) => {
    setEditMode(!!banner);
    setSelectedBanner(banner);
    setImage(null);
    setPreview(banner?.imageUrl || null);
    setFormError("");
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedBanner(null);
    setImage(null);
    setPreview(null);
    setFormError("");
    setEditMode(false);
  };

  // Handle image input
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    setFormError("");

    if (!file) {
      setImage(null);
      setPreview(selectedBanner?.imageUrl || null);
      return;
    }
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      e.target.value = "";
      setImage(null);
      setPreview(selectedBanner?.imageUrl || null);
      setFormError("Choose a JPG, PNG, WebP, or GIF image.");
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      e.target.value = "";
      setImage(null);
      setPreview(selectedBanner?.imageUrl || null);
      setFormError("The image must be 5 MB or smaller.");
      return;
    }

    setImage(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target.result);
    reader.onerror = () => setFormError("The selected image could not be read.");
    reader.readAsDataURL(file);
  };

  // Create or update banner
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!editMode && !image) {
      setFormError("Please select a banner image.");
      return;
    }
    setFormLoading(true);
    try {
      const token = localStorage.getItem("authToken");
      if (!token) throw new Error("Your session has expired. Please sign in again.");
      const formData = new FormData();
      if (image) formData.append("image", image);
      let res;
      if (editMode && selectedBanner) {
        res = await axios.put(
          `${baseURL}/banner/update/${selectedBanner._id}`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } else {
        res = await axios.post(
          `${baseURL}/banner/add-banner`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
      if (res.data.success) {
        Swal.fire({ icon: "success", title: editMode ? "Banner Updated!" : "Banner Created!" });
        closeModal();
        await fetchBanners();
      } else {
        setFormError(res.data?.message || "Operation failed.");
      }
    } catch (error) {
      setFormError(getErrorMessage(error, "Operation failed."));
    } finally {
      setFormLoading(false);
    }
  };

  // Delete banner
  const handleDelete = async (banner) => {
    const confirm = await Swal.fire({
      title: "Are you sure?",
      text: "This will delete the banner.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it!",
    });
    if (!confirm.isConfirmed) return;
    try {
      const token = localStorage.getItem("authToken");
      if (!token) throw new Error("Your session has expired. Please sign in again.");
      const res = await axios.delete(`${baseURL}/banner/delete/${banner._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.success) {
        Swal.fire({ icon: "success", title: "Deleted!" });
        await fetchBanners();
      } else {
        Swal.fire({ icon: "error", title: "Failed", text: res.data.message || "Delete failed." });
      }
    } catch (error) {
      Swal.fire({ icon: "error", title: "Error", text: error?.response?.data?.message || "Delete failed." });
    }
  };

  return (
    <main className="app-content">
      <div className="app-title tile p-3 d-flex justify-content-between align-items-center">
        <h1>Banners</h1>
        <button
          className="btn btn-primary"
          style={{ fontWeight: 600, fontSize: 16, padding: "10px 24px", borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
          onClick={() => openModal()}
        >
          + Create Banner
        </button>
      </div>

      {/* Modal for Create/Edit Banner */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={closeModal}
        >
          <div
            className="relative bg-white rounded-xl p-8 w-full max-w-md shadow-lg max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeModal}
              className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center text-green-600 text-2xl font-bold bg-gray-100 rounded-full  hover:bg-gray-200 focus:outline-none"
              aria-label="Close"
            >
             X
            </button>
            <div className="flex justify-center items-center pt-6">
              <h4 className="w-full text-center font-semibold text-lg">{editMode ? "Edit Banner" : "Create Banner"}</h4>
            </div>
            <form onSubmit={handleFormSubmit} className="mt-4">
              <div className="mb-4">
                <label htmlFor="banner-image-input" className="block font-semibold mb-2">Banner Image</label>
                <input
                  id="banner-image-input"
                  type="file"
                  accept={ACCEPTED_IMAGE_TYPES.join(",")}
                  className="block w-full border border-gray-300 rounded px-3 py-2 bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onChange={handleImageChange}
                  aria-invalid={Boolean(formError)}
                />
                {preview && (
                  <SafeImage
                    src={preview}
                    alt="Banner preview"
                    fallbackLabel="Banner preview unavailable"
                    className="w-full max-h-44 object-cover rounded mt-3 border border-gray-200"
                  />
                )}
                <small className="d-block text-muted mt-2">JPG, PNG, WebP, or GIF. Maximum 5 MB.</small>
                {formError && <div className="alert alert-danger py-2 mt-3 mb-0" role="alert">{formError}</div>}
              </div>
              <div className="flex justify-end mt-6">
                <button
                  type="submit"
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-8 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-60"
                  disabled={formLoading}
                >
                  {formLoading ? (editMode ? "Updating..." : "Creating...") : (editMode ? "Update Banner" : "Create Banner")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="row mt-4">
        <div className="col-md-12 px-5">
          <div className="tile p-3">
            <div className="tile-body">
              {loading ? (
                <div className="d-flex justify-content-center align-items-center" style={{ height: "200px" }}>
                  <div className="loader"></div>
                </div>
              ) : loadError ? (
                <div className="text-center py-5" role="alert">
                  <p className="text-danger mb-3">{loadError}</p>
                  <button type="button" className="btn btn-primary" onClick={fetchBanners}>
                    Retry
                  </button>
                </div>
              ) : banners.length === 0 ? (
                <p className="text-center">No banners found.</p>
              ) : (
                <div className="row">
                  {banners.map((banner) => (
                    <div className="col-md-4 col-sm-6 mb-4" key={banner._id}>
                      <div className="card h-100 shadow-sm border-0">
                        <SafeImage
                          src={banner.imageUrl}
                          alt="Banner"
                          fallbackLabel="Banner image unavailable"
                          className="card-img-top"
                          style={{ height: 180, objectFit: "cover", borderTopLeftRadius: 8, borderTopRightRadius: 8 }}
                        />
                        <div className="card-body d-flex justify-content-between align-items-center">
                          <button className="btn btn-outline-primary btn-sm" onClick={() => openModal(banner)}>
                            Edit
                          </button>
                          <button className="btn btn-outline-danger btn-sm" onClick={() => handleDelete(banner)}>
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default Sponsor;
