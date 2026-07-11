const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
const AUTH_TOKEN_KEY = "fair-meme-trade-auth-token";

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export const getStoredAuthToken = () => {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(AUTH_TOKEN_KEY) || "";
};

export const storeAuthToken = (token: string) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTH_TOKEN_KEY, token);
};

export const clearStoredAuthToken = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
};

export const apiRequest = async <T>(path: string, options: RequestInit & { token?: string } = {}) => {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  const token = options.token || getStoredAuthToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });
  if (!response.ok) {
    let message = `API request failed: ${response.status}`;
    try {
      const body = await response.json();
      message = body.error || message;
    } catch {
      // Non-JSON error bodies are rare here; keep the status message.
    }
    throw new ApiError(message, response.status);
  }
  return response.json() as Promise<T>;
};

export interface AuthNonceResponse {
  sessionId: number;
  nonce: string;
  message: string;
}

export interface AuthVerifyResponse {
  token: string;
  address: string;
  isAdmin: boolean;
}

export interface AuthMeResponse {
  address: string;
  isAdmin: boolean;
}

export const requestAuthNonce = (address: string) => apiRequest<AuthNonceResponse>("/api/auth/nonce", {
  method: "POST",
  body: JSON.stringify({ address }),
});

export const verifyAuthSignature = (sessionId: number, signature: string) => apiRequest<AuthVerifyResponse>("/api/auth/verify", {
  method: "POST",
  body: JSON.stringify({ sessionId, signature }),
});

export const getAuthMe = (token?: string) => apiRequest<AuthMeResponse>("/api/auth/me", { token });
