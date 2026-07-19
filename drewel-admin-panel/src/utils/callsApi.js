import { API_URL, apiClient } from "./api";

export const getCalls = async (params, signal) => {
  const response = await apiClient.get(`${API_URL}/admin/calls`, {
    params,
    signal,
  });
  return response.data;
};
