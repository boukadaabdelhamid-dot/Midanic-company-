/**
 * Thin authenticated fetch wrapper for admin API calls.
 * Reads the Bearer token from localStorage and adds it to every request.
 */

const BASE = "/api";

function getToken(): string {
  return localStorage.getItem("accessToken") ?? "";
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
      ...options.headers,
    },
  });
  if (res.status === 204) return undefined as T;
  const contentType = res.headers.get("content-type") ?? "";
  const raw = await res.text();
  let data: unknown = null;

  if (raw.trim()) {
    if (contentType.includes("application/json")) {
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(`Invalid JSON response from ${path} (HTTP ${res.status})`);
      }
    } else {
      const preview = raw.replace(/\s+/g, " ").trim().slice(0, 120);
      throw new Error(
        `API returned ${contentType || "non-JSON content"} for ${path} (HTTP ${res.status})` +
          (preview ? `: ${preview}` : ""),
      );
    }
  }

  const errorMessage =
    data && typeof data === "object" && "error" in data
      ? String((data as { error?: unknown }).error)
      : `HTTP ${res.status}`;
  if (!res.ok) throw new Error(errorMessage);
  return data as T;
}

export const adminApi = {
  // Entitlements
  getCustomerEntitlements: (userId: number) =>
    request<CustomerEntitlementsResponse>(`/admin/customers/${userId}/entitlements`),
  updateCustomerEntitlements: (userId: number, body: EntitlementsInput) =>
    request<CustomerEntitlement>(`/admin/customers/${userId}/entitlements`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  getMyEntitlements: () => request<MyEntitlements>("/my/entitlements"),
  getMyErpAccess: () => request<MyErpAccess>("/my/erp"),

  // Stats
  getStats: () => request<AdminStats>("/admin/stats"),
  getMonthlyLicenses: () => request<{ data: MonthlyLicenseCount[] }>("/admin/stats/monthly-licenses"),

  // Users
  listUsers: (params?: { page?: number; limit?: number; search?: string }) =>
    request<UserListResponse>(`/admin/users?${new URLSearchParams(cleanParams(params)).toString()}`),
  updateUser: (id: number, body: { role?: string; isActive?: boolean }) =>
    request<AdminUser>(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  // Products
  listProducts: () => request<AdminProduct[]>("/admin/products"),
  createProduct: (body: ProductInput) =>
    request<AdminProduct>("/admin/products", { method: "POST", body: JSON.stringify(body) }),
  updateProduct: (id: number, body: Partial<ProductInput>) =>
    request<AdminProduct>(`/admin/products/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteProduct: (id: number) => request<void>(`/admin/products/${id}`, { method: "DELETE" }),

  // Product Versions
  listProductVersions: (productId: number) =>
    request<AdminProductVersion[]>(`/admin/products/${productId}/versions`),
  createProductVersion: (productId: number, body: VersionInput) =>
    request<AdminProductVersion>(`/admin/products/${productId}/versions`, { method: "POST", body: JSON.stringify(body) }),
  updateProductVersion: (productId: number, versionId: number, body: Partial<VersionInput>) =>
    request<AdminProductVersion>(`/admin/products/${productId}/versions/${versionId}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteProductVersion: (productId: number, versionId: number) =>
    request<void>(`/admin/products/${productId}/versions/${versionId}`, { method: "DELETE" }),
  setLatestVersion: (productId: number, versionId: number) =>
    request<AdminProductVersion>(`/admin/products/${productId}/versions/${versionId}/set-latest`, { method: "POST" }),

  // Product Downloads
  listProductDownloads: (productId: number) =>
    request<AdminDownloadFile[]>(`/admin/products/${productId}/downloads`),
  createProductDownload: (productId: number, body: DownloadInput) =>
    request<AdminDownloadFile>(`/admin/products/${productId}/downloads`, { method: "POST", body: JSON.stringify(body) }),
  updateProductDownload: (productId: number, fileId: number, body: Partial<DownloadInput>) =>
    request<AdminDownloadFile>(`/admin/products/${productId}/downloads/${fileId}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteProductDownload: (productId: number, fileId: number) =>
    request<void>(`/admin/products/${productId}/downloads/${fileId}`, { method: "DELETE" }),

  // Licenses
  listLicenses: (params?: { page?: number; limit?: number }) =>
    request<LicenseListResponse>(`/admin/licenses?${new URLSearchParams(cleanParams(params)).toString()}`),
  createLicense: (body: CreateLicenseInput) =>
    request<AdminLicense>("/admin/licenses", { method: "POST", body: JSON.stringify(body) }),
  updateLicense: (id: number, body: { status?: string; maxDevices?: number }) =>
    request<AdminLicense>(`/admin/licenses/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteLicense: (id: number) => request<void>(`/admin/licenses/${id}`, { method: "DELETE" }),
  getMyLicenses: () => request<{ licenses: MyLicense[] }>("/my/licenses"),
  getMyDownloads: () => request<{ downloads: MyDownload[] }>("/my/downloads"),

  // Admin appearance
  getAdminSettings: () => request<AdminSettings>("/admin/settings"),
  updateAdminSettings: (body: Partial<AdminSettings>) =>
    request<AdminSettings>("/admin/settings", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  // ERP tenant control
  listErpTenants: (status?: string) =>
    request<{ tenants: ErpTenant[] }>(
      `/admin/erp/tenants${status ? `?status=${encodeURIComponent(status)}` : ""}`,
    ),
  createErpTenant: (body: { ownerUserId: number; companyName: string }) =>
    request<ErpTenant>("/admin/erp/tenants", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateErpTenant: (
    id: number,
    body: { status?: string; companyName?: string; notes?: string | null; trialEndsAt?: string | null },
  ) =>
    request<ErpTenant>(`/admin/erp/tenants/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  // Subscriptions
  listSubscriptions: (params?: { page?: number; limit?: number }) =>
    request<SubscriptionListResponse>(`/admin/subscriptions?${new URLSearchParams(cleanParams(params)).toString()}`),

  // Blog
  listBlog: () => request<BlogPost[]>("/admin/blog"),
  createBlogPost: (body: ContentInput) =>
    request<BlogPost>("/admin/blog", { method: "POST", body: JSON.stringify(body) }),
  updateBlogPost: (id: number, body: Partial<ContentInput>) =>
    request<BlogPost>(`/admin/blog/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteBlogPost: (id: number) => request<void>(`/admin/blog/${id}`, { method: "DELETE" }),

  // News
  listNews: () => request<NewsItem[]>("/admin/news"),
  createNewsItem: (body: Omit<ContentInput, "authorName">) =>
    request<NewsItem>("/admin/news", { method: "POST", body: JSON.stringify(body) }),
  updateNewsItem: (id: number, body: Partial<Omit<ContentInput, "authorName">>) =>
    request<NewsItem>(`/admin/news/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteNewsItem: (id: number) => request<void>(`/admin/news/${id}`, { method: "DELETE" }),

  // CRM
  listContactMessages: (params?: { page?: number }) =>
    request<ContactListResponse>(`/admin/contact-messages?${new URLSearchParams(cleanParams(params)).toString()}`),
  updateContactMessage: (id: number, body: { isRead: boolean }) =>
    request<ContactMessage>(`/admin/contact-messages/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  listTrialRequests: (params?: { page?: number }) =>
    request<TrialListResponse>(`/admin/trial-requests?${new URLSearchParams(cleanParams(params)).toString()}`),
  updateTrialRequest: (id: number, body: { status: string }) =>
    request<TrialRequest>(`/admin/trial-requests/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  listDemoRequests: (params?: { page?: number }) =>
    request<DemoListResponse>(`/admin/demo-requests?${new URLSearchParams(cleanParams(params)).toString()}`),
  updateDemoRequest: (id: number, body: { status: string }) =>
    request<DemoRequest>(`/admin/demo-requests/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  listNewsletter: (params?: { page?: number }) =>
    request<NewsletterListResponse>(`/admin/newsletter?${new URLSearchParams(cleanParams(params)).toString()}`),

  // Support Tickets
  listTickets: (params?: { page?: number; status?: string }) =>
    request<TicketListResponse>(`/admin/support-tickets?${new URLSearchParams(cleanParams(params)).toString()}`),
  getTicket: (id: number) => request<TicketDetail>(`/admin/support-tickets/${id}`),
  updateTicket: (id: number, body: { status?: string; priority?: string }) =>
    request<AdminTicket>(`/admin/support-tickets/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  replyTicket: (id: number, message: string) =>
    request<TicketMessage>(`/admin/support-tickets/${id}/reply`, {
      method: "POST",
      body: JSON.stringify({ message }),
    }),
};

function cleanParams(obj?: Record<string, unknown>): Record<string, string> {
  if (!obj) return {};
  return Object.fromEntries(
    Object.entries(obj)
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .map(([k, v]) => [k, String(v)])
  );
}

// ── Types ─────────────────────────────────────────────────────────────────

export interface RecentLicense {
  id: number;
  licenseKey: string;
  type: string;
  status: string;
  createdAt: string;
  userEmail: string | null;
  userFirstName: string | null;
  userLastName: string | null;
  productName: string | null;
  expiresAt: string | null;
}

export interface ExpiringLicense {
  id: number;
  licenseKey: string;
  type: string;
  expiresAt: string | null;
  userEmail: string | null;
  userFirstName: string | null;
  productName: string | null;
}

export interface ProductLicenseCount {
  productName: string;
  count: number;
}

export interface MonthlyLicenseCount {
  month: string; // "YYYY-MM"
  count: number;
}

export interface CustomerEntitlement {
  id?: number;
  userId: number;
  maxStores: number | null;
  maxUsers: number | null;
  storageGb: number | null;
  updatedAt: string | null;
  updatedBy: number | null;
}

export interface EntitlementHistoryEntry {
  id: number;
  oldValues: { maxStores: number | null; maxUsers: number | null; storageGb: number | null } | null;
  newValues: { maxStores: number | null; maxUsers: number | null; storageGb: number | null };
  createdAt: string;
  changedByEmail: string | null;
  changedByName: string | null;
}

export interface CustomerEntitlementsResponse {
  entitlements: CustomerEntitlement;
  history: EntitlementHistoryEntry[];
}

export interface EntitlementsInput {
  maxStores?: number | null;
  maxUsers?: number | null;
  storageGb?: number | null;
}

export interface MyEntitlements {
  maxStores: number | null;
  maxUsers: number | null;
  storageGb: number | null;
  updatedAt: string | null;
}

export interface AdminStats {
  totalUsers: number;
  totalProducts: number;
  activeLicenses: number;
  openTickets: number;
  newThisMonth: number;
  expiringIn30Days: number;
  expiringToday: number;
  recentLicenses: RecentLicense[];
  expiringIn14Days: ExpiringLicense[];
  byProduct: ProductLicenseCount[];
}

export interface AdminSettings {
  id: number;
  adminName: LocalizedAdminText;
  pageTitle: LocalizedAdminText;
  pageSubtitle: LocalizedAdminText;
  accentColor: string;
  theme: "light" | "dark";
  sidebarStyle: "default" | "glass" | "compact";
  backgroundImageUrl: string | null;
  updatedAt: string;
}

export interface LocalizedAdminText {
  en: string;
  fr: string;
  ar: string;
}

export interface AdminUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  language: string;
  companyName: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface UserListResponse {
  users: AdminUser[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminProduct {
  id: number;
  name: string;
  slug: string;
  description: string;
  shortDescription: string | null;
  category: string;
  imageUrl: string | null;
  videoUrl: string | null;
  defaultLicenseType: string | null;
  featured: boolean;
  published: boolean;
  trialDays: number | null;
  basePrice: number | null;
  sortOrder: number;
  createdAt: string;
}

export interface ProductInput {
  name: string;
  slug: string;
  description: string;
  shortDescription?: string;
  category: string;
  imageUrl?: string;
  videoUrl?: string;
  defaultLicenseType?: string;
  featured?: boolean;
  published?: boolean;
  trialDays?: number;
  basePrice?: number;
  sortOrder?: number;
}

export interface AdminProductVersion {
  id: number;
  productId: number;
  version: string;
  releaseNotes: string | null;
  isLatest: boolean;
  releasedAt: string;
  createdAt: string;
}

export interface VersionInput {
  version: string;
  releaseNotes?: string;
  isLatest?: boolean;
  releasedAt?: string;
}

export interface AdminDownloadFile {
  id: number;
  productId: number;
  versionId: number | null;
  fileName: string;
  fileSize: number;
  platform: string;
  version: string | null;
  downloadUrl: string;
  downloadCount: number;
  isPublic: boolean;
  createdAt: string;
}

export interface DownloadInput {
  fileName: string;
  fileSize?: number;
  platform: string;
  version?: string;
  downloadUrl: string;
  versionId?: number;
  isPublic?: boolean;
}

export interface AdminLicense {
  id: number;
  licenseKey: string;
  userId: number | null;
  productId: number;
  type: string;
  status: string;
  maxDevices: number | null;
  activatedDevices: number;
  expiresAt: string | null;
  createdAt: string;
  userEmail: string | null;
  userFirstName: string | null;
  userLastName: string | null;
  productName: string | null;
}

export interface CreateLicenseInput {
  userId?: number;
  productId: number;
  type: string;
  maxDevices?: number;
}

export interface MyLicense {
  id: number;
  licenseKey: string;
  type: string;
  status: string;
  maxDevices: number | null;
  activatedDevices: number;
  expiresAt: string | null;
  autoRenew: boolean;
  createdAt: string;
  productId: number;
  productName: string | null;
  productSlug: string | null;
  productImageUrl: string | null;
}

export interface LicenseListResponse {
  licenses: AdminLicense[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminSubscription {
  id: number;
  userId: number;
  productId: number;
  status: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  createdAt: string;
  userEmail: string | null;
  userFirstName: string | null;
  userLastName: string | null;
  productName: string | null;
}

export interface MyDownload {
  id: number;
  fileName: string;
  fileSize: number | null;
  platform: string;
  version: string | null;
  downloadUrl: string;
  isPublic: boolean;
  productId: number;
  productName: string | null;
  productSlug: string | null;
  isLatest: boolean | null;
}

export interface SubscriptionListResponse {
  subscriptions: AdminSubscription[];
  total: number;
  page: number;
  limit: number;
}

export interface BlogPost {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  authorName: string | null;
  published: boolean;
  publishedAt: string | null;
  createdAt: string;
}

export interface NewsItem {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  published: boolean;
  publishedAt: string | null;
  createdAt: string;
}

export interface ContentInput {
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  authorName?: string;
  published?: boolean;
}

export interface ContactMessage {
  id: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface ContactListResponse {
  messages: ContactMessage[];
  total: number;
  page: number;
  limit: number;
}

export interface TrialRequest {
  id: number;
  name: string;
  email: string;
  companyName: string;
  phone: string | null;
  productId: number;
  message: string | null;
  status: string;
  createdAt: string;
  productName: string | null;
}

export interface TrialListResponse {
  requests: TrialRequest[];
  total: number;
  page: number;
  limit: number;
}

export interface DemoRequest {
  id: number;
  name: string;
  email: string;
  companyName: string;
  phone: string | null;
  productId: number;
  preferredDate: string | null;
  message: string | null;
  status: string;
  createdAt: string;
  productName: string | null;
}

export interface DemoListResponse {
  requests: DemoRequest[];
  total: number;
  page: number;
  limit: number;
}

export interface NewsletterSubscriber {
  id: number;
  email: string;
  name: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface NewsletterListResponse {
  subscribers: NewsletterSubscriber[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminTicket {
  id: number;
  ticketNumber: string;
  subject: string;
  category: string | null;
  status: string;
  priority: string;
  userId: number;
  createdAt: string;
  userEmail: string | null;
  userFirstName: string | null;
  userLastName: string | null;
}

export interface TicketListResponse {
  tickets: AdminTicket[];
  total: number;
  page: number;
  limit: number;
}

export interface TicketMessage {
  id: number;
  ticketId: number;
  userId: number;
  message: string;
  isStaff: string;
  createdAt: string;
}

export interface TicketDetail extends AdminTicket {
  messages: TicketMessage[];
}

export interface ErpTenant {
  id: number;
  ownerUserId: number;
  companyName: string;
  status: string;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  approvedAt: string | null;
  suspendedAt: string | null;
  notes: string | null;
  createdAt: string;
  ownerEmail: string | null;
  ownerFirstName: string | null;
  ownerLastName: string | null;
}

export interface MyErpAccess {
  hasAccount: boolean;
  id?: number;
  companyName?: string;
  status: "none" | "pending" | "active" | "suspended" | "expired" | "converted";
  canAccess: boolean;
  launchUrl: string;
  trialStartedAt?: string | null;
  trialEndsAt?: string | null;
  message: string | null;
}
