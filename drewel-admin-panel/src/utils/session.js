export const clearAdminSession = () => {
  localStorage.removeItem("authToken");
  localStorage.removeItem("admin");
};

export const notifyAdminSessionChanged = () => {
  window.dispatchEvent(new Event("admin-auth-changed"));
};

export const isAuthTokenUsable = (token = localStorage.getItem("authToken")) => {
  if (!token) return false;

  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;

    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const payload = JSON.parse(window.atob(padded));
    return typeof payload.exp === "number" && payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
};

export const redirectToLogin = () => {
  clearAdminSession();
  if (window.location.pathname !== "/login") {
    window.location.replace("/login?reason=session-expired");
  }
};
