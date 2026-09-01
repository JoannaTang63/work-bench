/** API 错误（携带状态码与服务端 error code） */
export class ApiError extends Error {
  status: number;

  constructor(status: number, code: string) {
    super(code);
    this.status = status;
    this.name = "ApiError";
  }
}

const TOKEN_KEY = "workbench_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const token = getToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (options.body !== undefined && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(path, { ...options, headers });

  if (res.status === 401) {
    clearToken();
    if (!window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }
    throw new ApiError(401, "unauthorized");
  }
  if (!res.ok) {
    let code = `http_${res.status}`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data?.error) code = data.error;
    } catch {
      // 忽略非 JSON 响应体
    }
    throw new ApiError(res.status, code);
  }
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PUT",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PATCH",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  /** multipart 上传（不要手动设置 Content-Type，让浏览器生成 boundary） */
  upload: <T>(path: string, formData: FormData) => request<T>(path, { method: "POST", body: formData }),
};

/** 带鉴权拉取文件 blob（预览用；图片/PDF/文本均可），401 时复用统一下线逻辑 */
export async function fetchBlob(path: string): Promise<Blob> {
  const disposable = new Headers();
  const token = getToken();
  if (token) disposable.set("Authorization", `Bearer ${token}`);
  const res = await fetch(path, { headers: disposable });
  if (res.status === 401) {
    clearToken();
    if (!window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }
    throw new ApiError(401, "unauthorized");
  }
  if (!res.ok) throw new ApiError(res.status, `http_${res.status}`);
  return await res.blob();
}
