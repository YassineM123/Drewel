import axios from "axios";
import { API_URL } from "./api";


export const getAllServices = async () => {
    const userExists = localStorage.getItem("admin");
    try {
        if (!userExists) {
            throw new Error("User is not logged in or does not exist in localStorage.");
        }
        const response = await axios.get(`${API_URL}/service/get-all`);
        return response.data;
    } catch (error) {
        console.error("Error fetching services:", error.message || error);
        throw error;
    }
};

export const createServices = async () => {
    const authTokenExist = localStorage.getItem("authToken");
    try {
        if (!authTokenExist) {
            throw new Error("User token is missing. Please log in.");
        }
        console.log("auth", authTokenExist)

        const response = await axios.post(
            `${API_URL}/service/add-new`,
            {},
            {
                headers: {
                    Authorization: `Bearer ${authTokenExist}`,
                    "Content-Type": "application/json",
                },
            }
        );
        return response.data;
    } catch (error) {
        console.error("Error fetching services:", error.message || error);
        throw error;
    }
};

export const getAllDashboard = async () => {
    const userExists = localStorage.getItem("admin");
    const authTokenExist = localStorage.getItem("authToken");
    try {
        if (!userExists) {
            throw new Error("User is not logged in or does not exist in localStorage.");
        }
        const response = await axios.get(`${API_URL}/admin/dashboard`, {
            headers: {
                Authorization: `Bearer ${authTokenExist}`,
            },
        });
        return response.data;
    } catch (error) {
        console.error("Error fetching services:", error.message || error);
        throw error;
    }
};

export const getAllProviders = async () => {
    const userExists = localStorage.getItem("admin");
    try {
        if (!userExists) {
            throw new Error("User is not logged in or does not exist in localStorage.");
        }
        const response = await axios.get(`${API_URL}/service-provider/get-all`);
        return response.data;
    } catch (error) {
        console.error("Error fetching services:", error.message || error);
        throw error;
    }
};

export const getUserList000 = async () => {
    const userExists = localStorage.getItem("admin");
    const authTokenExist = localStorage.getItem("authToken");
    try {
        if (!userExists) {
            throw new Error("User is not logged in or does not exist in localStorage.");
        }
        if (!authTokenExist) {
            throw new Error("Auth token does not exist in localStorage.");
        }

        const response = await axios.get(`${API_URL}/user/user-list`, {
            headers: {
                Authorization: `Bearer ${authTokenExist}`
            }
        });
        return response.data.users;
    } catch (error) {
        console.error("Error fetching user list:", error.message || error);
        throw error;
    }
};

export const deleteUser = async (id) => {
    const userExists = localStorage.getItem("admin");
    const authTokenExist = localStorage.getItem("authToken");
    try {
        if (!userExists) {
            throw new Error("User is not logged in or does not exist in localStorage.");
        }
        if (!authTokenExist) {
            throw new Error("Auth token does not exist in localStorage.");
        }

        if (!id) {
            throw new Error("A user id is required.");
        }

        const response = await axios.delete(`${API_URL}/users/${id}`, {
            headers: {
                Authorization: `Bearer ${authTokenExist}`
            }
        });
        return response.data;
    } catch (error) {
        console.error("Error fetching user list:", error.message || error);
        throw error;
    }
};

export const addServiceRequest = async (data) => {
    const authToken = localStorage.getItem("authToken"); 
    if (!authToken) {
        console.error("Authorization token is missing.");
        return;
    }

    try {
        const response = await axios.post(`${API_URL}/service/add-new`, data, {
            headers: {
                Authorization: `Bearer ${authToken}`, 
            }
        });

        console.log("Response:", response.data);
        return response.data;
    } catch (error) {
        console.error("Error adding service request:", error.response?.data || error.message);
        throw error; 
    }
};
