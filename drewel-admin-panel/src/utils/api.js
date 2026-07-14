import axios from "axios";

const origin =
    typeof window !== "undefined" ? window.location.origin : "http://localhost:3001";

export const API_URL =
    import.meta.env.VITE_API_URL ||
    (import.meta.env.DEV ? "http://localhost:3001/api" : `${origin}/api`);
export const SOCKET_URL =
    import.meta.env.VITE_SOCKET_URL ||
    (import.meta.env.DEV ? "http://localhost:3001" : origin);

// Older CMS/FAQ/service endpoints run under /api/v1. Production should
// provide an HTTPS VITE_LEGACY_API_URL when those endpoints are hosted
// separately; same-origin is the safe fallback behind a reverse proxy.
export const LEGACY_API_URL = (
    import.meta.env.VITE_LEGACY_API_URL ||
    (import.meta.env.DEV ? "http://localhost:3008/api/v1" : `${origin}/api/v1`)
).replace(/\/$/, "");

export const getUserList = async () => {
    const userExists = localStorage.getItem("admin");
    const authTokenExist = localStorage.getItem("authToken");
    // console.log('authTokenExist',authTokenExist)
    try {
        if (!userExists) {
            throw new Error("User is not logged in or does not exist in localStorage.");
        }
        if (!authTokenExist) {
            throw new Error("Auth token does not exist in localStorage.");
        }

        const response = await axios.get(`${API_URL}/users/get-all`, {
            headers: {
                Authorization: `Bearer ${authTokenExist}`
            }
        });
        // console.log('response',response.data.users)
        return response.data.users;
    } catch (error) {
        console.error("Error fetching user list:", error.message || error);
        throw error;
    }
};

export const getDriverList = async (status = "all") => {
    const userExists = localStorage.getItem("admin");
    const authTokenExist = localStorage.getItem("authToken");
    // console.log('authTokenExist',authTokenExist)
    try {
        if (!userExists) {
            throw new Error("driver is not logged in or does not exist in localStorage.");
        }
        if (!authTokenExist) {
            throw new Error("Auth token does not exist in localStorage.");
        }
        const endpoint =
            status && status !== "all"
                ? `${API_URL}/admin/drivers?status=${encodeURIComponent(status)}`
                : `${API_URL}/admin/drivers`;
        const response = await axios.get(endpoint, {
            headers: {
                Authorization: `Bearer ${authTokenExist}`
            }
        });
        return response.data.drivers || [];
    } catch (error) {
        console.error("Error fetching driver list:", error.message || error);
        throw error;
    }
};

export const getDriverDetailForReview = async (driverId) => {
    const authTokenExist = localStorage.getItem("authToken");
    if (!authTokenExist) {
        throw new Error("Auth token does not exist in localStorage.");
    }
    const response = await axios.get(`${API_URL}/admin/driver/${driverId}`, {
        headers: {
            Authorization: `Bearer ${authTokenExist}`,
        },
    });
    return response.data.driver;
};

export const updateDriverReviewStatus = async (driverId, payload) => {
    const authTokenExist = localStorage.getItem("authToken");
    if (!authTokenExist) {
        throw new Error("Auth token does not exist in localStorage.");
    }
    const response = await axios.put(
        `${API_URL}/admin/driver/${driverId}/status`,
        payload,
        {
            headers: {
                Authorization: `Bearer ${authTokenExist}`,
                "Content-Type": "application/json",
            },
        }
    );
    return response.data;
};

export const getOnlineDriverList = async () => {
    const authTokenExist = localStorage.getItem("authToken");
    try {
        if (!authTokenExist) {
            throw new Error("Auth token does not exist in localStorage.");
        }

        const response = await axios.get(`${API_URL}/admin/drivers/online`, {
            headers: {
                Authorization: `Bearer ${authTokenExist}`
            }
        });
        if (!response.data?.success || !Array.isArray(response.data?.drivers)) {
            throw new Error(response.data?.message || "Invalid online drivers response.");
        }
        return response.data.drivers;
    } catch (error) {
        console.error("Error fetching online driver list:", error.message || error);
        throw error;
    }
};


export const getClubList = async () => {
    const authTokenExist = localStorage.getItem("authToken");
    try {
        const response = await axios.get(`${API_URL}/admin/get-clubs`, {
            headers: {
                Authorization: `Bearer ${authTokenExist}`
            }
        });
        return response.data.data;
    } catch (error) {
        console.error("Error fetching user list:", error.message || error);
        throw error;
    }
};

export const getGolfCoursesList = async () => {
    const authTokenExist = localStorage.getItem("authToken");
    try {
        const response = await axios.get(`${API_URL}/admin/getGolfCourses`, {
            headers: {
                Authorization: `Bearer ${authTokenExist}`
            }
        });
        return response.data.courses;
    } catch (error) {
        console.error("Error fetching user list:", error.message || error);
        throw error;
    }
};

export const addDriver = async (formData) => {
    const userExists = localStorage.getItem("admin");
    const authTokenExist = localStorage.getItem("authToken");
    try {
        if (!userExists) {
            throw new Error("User is not logged in or does not exist in localStorage.");
        }
        if (!authTokenExist) {
            throw new Error("Auth token does not exist in localStorage.");
        }
        const response = await axios.post(
            `${API_URL}/driver/add-personal-details`,
            formData,
            {
                headers: {
                    Authorization: `Bearer ${authTokenExist}`,
                    "Content-Type": "multipart/form-data",
                },
            }
        );
        return response.data;
    } catch (error) {
        console.error("Error adding driver:", error.response?.data || error.message);
        throw error;
    }
};
