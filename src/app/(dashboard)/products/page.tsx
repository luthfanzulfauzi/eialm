"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useSession } from "next-auth/react";
import {
  Boxes,
  FileText,
  Layers3,
  Link2,
  Loader2,
  Pencil,
  Plus,
  SlidersHorizontal,
  ShieldAlert,
  Trash2,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";

type ProductEnvironment = "PRODUCTION" | "STAGING" | "DEVELOPMENT" | "SHARED";
type ProductLifecycle = "PLANNING" | "ACTIVE" | "MAINTENANCE" | "RETIRED";
type ProductCriticality = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
type ProductOptionType =
  | "CATEGORY"
  | "BUSINESS_DOMAIN"
  | "SUPPORT_TEAM"
  | "BUSINESS_OWNER";

type ProductOption = {
  id: string;
  type: ProductOptionType;
  value: string;
  sortOrder?: number;
};

type ProductOptionsByType = Record<ProductOptionType, ProductOption[]>;

type UserOption = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type AssetOption = {
  id: string;
  name: string;
  serialNumber: string;
  status: string;
  category: string;
};

type LicenseOption = {
  id: string;
  name: string;
  key: string | null;
  isExpired: boolean;
  expiryDate: string | null;
};

type ProductRecord = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  environment: ProductEnvironment;
  lifecycle: ProductLifecycle;
  criticality: ProductCriticality;
  documentationUrl: string | null;
  notes: string | null;
  categoryOptionId: string;
  businessDomainOptionId: string | null;
  supportTeamOptionId: string | null;
  businessOwnerOptionId: string;
  technicalOwnerUserId: string | null;
  categoryOption: ProductOption;
  businessDomainOption: ProductOption | null;
  supportTeamOption: ProductOption | null;
  businessOwnerOption: ProductOption;
  technicalOwnerUser: UserOption | null;
  assets: AssetOption[];
  licenses: LicenseOption[];
  createdAt: string;
  updatedAt: string;
};

type ProductSummary = {
  total: number;
  active: number;
  planning: number;
  critical: number;
  unmapped: number;
};

type ProductFormState = {
  name: string;
  code: string;
  description: string;
  environment: ProductEnvironment;
  lifecycle: ProductLifecycle;
  criticality: ProductCriticality;
  documentationUrl: string;
  notes: string;
  categoryOptionId: string;
  businessDomainOptionId: string;
  supportTeamOptionId: string;
  businessOwnerOptionId: string;
  technicalOwnerUserId: string;
  assetIds: string[];
  licenseIds: string[];
};

const emptyOptions: ProductOptionsByType = {
  CATEGORY: [],
  BUSINESS_DOMAIN: [],
  SUPPORT_TEAM: [],
  BUSINESS_OWNER: [],
};

const emptyForm: ProductFormState = {
  name: "",
  code: "",
  description: "",
  environment: "PRODUCTION",
  lifecycle: "PLANNING",
  criticality: "MEDIUM",
  documentationUrl: "",
  notes: "",
  categoryOptionId: "",
  businessDomainOptionId: "",
  supportTeamOptionId: "",
  businessOwnerOptionId: "",
  technicalOwnerUserId: "",
  assetIds: [],
  licenseIds: [],
};

const lifecycleOptions: ProductLifecycle[] = ["PLANNING", "ACTIVE", "MAINTENANCE", "RETIRED"];
const environmentOptions: ProductEnvironment[] = ["PRODUCTION", "STAGING", "DEVELOPMENT", "SHARED"];
const criticalityOptions: ProductCriticality[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

const optionSections: { type: ProductOptionType; title: string; helper: string }[] = [
  { type: "CATEGORY", title: "Category", helper: "Product or application classification values." },
  { type: "BUSINESS_DOMAIN", title: "Business Domain", helper: "Business areas such as Finance, HR, or Operations." },
  { type: "SUPPORT_TEAM", title: "Support Team", helper: "Teams responsible for support and operations." },
  { type: "BUSINESS_OWNER", title: "Business Owner", helper: "Business-side contacts or accountable teams." },
];

const lifecycleTone: Record<ProductLifecycle, string> = {
  PLANNING: "border-amber-500/20 bg-amber-500/10 text-amber-300",
  ACTIVE: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  MAINTENANCE: "border-blue-500/20 bg-blue-500/10 text-blue-300",
  RETIRED: "border-slate-700 bg-slate-800/60 text-slate-300",
};

const criticalityTone: Record<ProductCriticality, string> = {
  LOW: "text-slate-300",
  MEDIUM: "text-blue-300",
  HIGH: "text-amber-300",
  CRITICAL: "text-red-300",
};

const formatEnum = (value: string) => value.toLowerCase().replace(/_/g, " ");

const toggleRelation = (currentValues: string[], relationId: string) => {
  return currentValues.includes(relationId)
    ? currentValues.filter((value) => value !== relationId)
    : [...currentValues, relationId];
};

export default function ProductsPage() {
  const { data: session } = useSession();
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [licenses, setLicenses] = useState<LicenseOption[]>([]);
  const [technicalOwners, setTechnicalOwners] = useState<UserOption[]>([]);
  const [productOptions, setProductOptions] = useState<ProductOptionsByType>(emptyOptions);
  const [summary, setSummary] = useState<ProductSummary>({
    total: 0,
    active: 0,
    planning: 0,
    critical: 0,
    unmapped: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [lifecycleFilter, setLifecycleFilter] = useState<"ALL" | ProductLifecycle>("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isOptionsModalOpen, setIsOptionsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductRecord | null>(null);
  const [form, setForm] = useState<ProductFormState>(emptyForm);
  const [technicalOwnerSearch, setTechnicalOwnerSearch] = useState("");
  const [isTechnicalOwnerDropdownOpen, setIsTechnicalOwnerDropdownOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [optionMessage, setOptionMessage] = useState<string | null>(null);
  const [optionDrafts, setOptionDrafts] = useState<Record<ProductOptionType, string>>({
    CATEGORY: "",
    BUSINESS_DOMAIN: "",
    SUPPORT_TEAM: "",
    BUSINESS_OWNER: "",
  });
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);
  const [editingOptionValue, setEditingOptionValue] = useState("");
  const [busyOptionId, setBusyOptionId] = useState<string | null>(null);

  const canManage = session?.user?.role === "ADMIN" || session?.user?.role === "OPERATOR";
  const isAdmin = session?.user?.role === "ADMIN";

  const fetchProducts = async (background = false) => {
    try {
      setError(null);
      if (background) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const res = await fetch("/api/products", { cache: "no-store" });
      const payload = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to load product portfolio");
      }

      setProducts(payload.products || []);
      setAssets(payload.assets || []);
      setLicenses(payload.licenses || []);
      setTechnicalOwners(payload.technicalOwners || []);
      setProductOptions(payload.options?.byType || emptyOptions);
      setSummary(
        payload.summary || {
          total: 0,
          active: 0,
          planning: 0,
          critical: 0,
          unmapped: 0,
        }
      );
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load product portfolio");
    } finally {
      if (background) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void fetchProducts();
  }, []);

  const refreshProductOptions = async () => {
    const res = await fetch("/api/product-options", { cache: "no-store" });
    const payload = await res.json().catch(() => ({} as any));
    if (!res.ok) {
      throw new Error(payload?.error || "Failed to load dropdown options");
    }
    setProductOptions(payload.byType || emptyOptions);
  };

  const filteredProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesLifecycle =
        lifecycleFilter === "ALL" ? true : product.lifecycle === lifecycleFilter;

      if (!matchesLifecycle) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = [
        product.name,
        product.code,
        product.categoryOption?.value || "",
        product.businessDomainOption?.value || "",
        product.businessOwnerOption?.value || "",
        product.technicalOwnerUser?.name || "",
        product.technicalOwnerUser?.email || "",
        product.supportTeamOption?.value || "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [lifecycleFilter, products, search]);

  const openCreateModal = () => {
    setEditingProduct(null);
    setForm(emptyForm);
    setTechnicalOwnerSearch("");
    setIsTechnicalOwnerDropdownOpen(false);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (product: ProductRecord) => {
    setEditingProduct(product);
    setForm({
      name: product.name,
      code: product.code,
      description: product.description || "",
      environment: product.environment,
      lifecycle: product.lifecycle,
      criticality: product.criticality,
      documentationUrl: product.documentationUrl || "",
      notes: product.notes || "",
      categoryOptionId: product.categoryOptionId,
      businessDomainOptionId: product.businessDomainOptionId || "",
      supportTeamOptionId: product.supportTeamOptionId || "",
      businessOwnerOptionId: product.businessOwnerOptionId,
      technicalOwnerUserId: product.technicalOwnerUserId || "",
      assetIds: product.assets.map((asset) => asset.id),
      licenseIds: product.licenses.map((license) => license.id),
    });
    setTechnicalOwnerSearch(product.technicalOwnerUser?.name || "");
    setIsTechnicalOwnerDropdownOpen(false);
    setFormError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
    setForm(emptyForm);
    setTechnicalOwnerSearch("");
    setIsTechnicalOwnerDropdownOpen(false);
    setFormError(null);
  };

  const openOptionsModal = () => {
    setOptionMessage(null);
    setEditingOptionId(null);
    setEditingOptionValue("");
    setIsOptionsModalOpen(true);
  };

  const handleAddOption = async (type: ProductOptionType) => {
    const value = optionDrafts[type].trim();
    if (!value) return;

    setOptionMessage(null);
    setBusyOptionId(type);
    try {
      const res = await fetch("/api/product-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, value }),
      });
      const payload = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to add dropdown value");
      }

      setOptionDrafts((current) => ({ ...current, [type]: "" }));
      setOptionMessage("Dropdown value added.");
      await refreshProductOptions();
    } catch (error) {
      setOptionMessage(error instanceof Error ? error.message : "Failed to add dropdown value");
    } finally {
      setBusyOptionId(null);
    }
  };

  const handleSaveOption = async (option: ProductOption) => {
    const value = editingOptionValue.trim();
    if (!value) return;

    setOptionMessage(null);
    setBusyOptionId(option.id);
    try {
      const res = await fetch(`/api/product-options/${option.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      const payload = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to update dropdown value");
      }

      setEditingOptionId(null);
      setEditingOptionValue("");
      setOptionMessage("Dropdown value updated.");
      await refreshProductOptions();
      await fetchProducts(true);
    } catch (error) {
      setOptionMessage(error instanceof Error ? error.message : "Failed to update dropdown value");
    } finally {
      setBusyOptionId(null);
    }
  };

  const handleDeleteOption = async (option: ProductOption) => {
    const confirmed = window.confirm(`Delete dropdown value "${option.value}"?`);
    if (!confirmed) return;

    setOptionMessage(null);
    setBusyOptionId(option.id);
    try {
      const res = await fetch(`/api/product-options/${option.id}`, { method: "DELETE" });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({} as any));
        throw new Error(payload?.error || "Failed to delete dropdown value");
      }

      setOptionMessage("Dropdown value deleted.");
      await refreshProductOptions();
    } catch (error) {
      setOptionMessage(error instanceof Error ? error.message : "Failed to delete dropdown value");
    } finally {
      setBusyOptionId(null);
    }
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!form.name.trim() || !form.code.trim()) {
      setFormError("Name and code are required.");
      return;
    }

    if (!form.categoryOptionId || !form.businessOwnerOptionId || !form.technicalOwnerUserId) {
      setFormError("Category, business owner, and technical owner are required.");
      return;
    }

    try {
      setSaving(true);
      const endpoint = editingProduct ? `/api/products/${editingProduct.id}` : "/api/products";
      const method = editingProduct ? "PATCH" : "POST";
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          name: form.name.trim(),
          code: form.code.trim().toUpperCase(),
          description: form.description.trim() || null,
          documentationUrl: form.documentationUrl.trim() || null,
          notes: form.notes.trim() || null,
          businessDomainOptionId: form.businessDomainOptionId || null,
          supportTeamOptionId: form.supportTeamOptionId || null,
        }),
      });

      const payload = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to save product");
      }

      closeModal();
      await fetchProducts(true);
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : "Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (product: ProductRecord) => {
    const confirmed = window.confirm(`Delete product "${product.name}"?`);
    if (!confirmed) return;

    try {
      setDeletingId(product.id);
      const res = await fetch(`/api/products/${product.id}`, { method: "DELETE" });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({} as any));
        throw new Error(payload?.error || "Failed to delete product");
      }
      await fetchProducts(true);
    } catch (deleteError) {
      window.alert(deleteError instanceof Error ? deleteError.message : "Failed to delete product");
    } finally {
      setDeletingId(null);
    }
  };

  const stats = [
    {
      label: "Portfolio Items",
      value: summary.total,
      icon: Boxes,
      tone: "text-blue-400 bg-blue-500/10",
    },
    {
      label: "Active",
      value: summary.active,
      icon: Layers3,
      tone: "text-emerald-400 bg-emerald-500/10",
    },
    {
      label: "Planning",
      value: summary.planning,
      icon: FileText,
      tone: "text-amber-400 bg-amber-500/10",
    },
    {
      label: "Critical",
      value: summary.critical,
      icon: ShieldAlert,
      tone: "text-red-400 bg-red-500/10",
    },
  ];

  const renderOptionSelect = (
    label: string,
    value: string,
    optionType: ProductOptionType,
    onChange: (value: string) => void,
    required = false
  ) => {
    const options = productOptions[optionType] || [];

    return (
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</div>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex h-10 w-full rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:border-blue-500 transition-all"
        >
          <option value="">{required ? `Select ${label}` : `Optional ${label}`}</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.value}
            </option>
          ))}
        </select>
        {options.length === 0 ? (
          <p className="text-[10px] text-slate-500">
            {isAdmin
              ? `No ${label.toLowerCase()} options available yet. Add them from Settings.`
              : `${label} options are managed by Admin.`}
          </p>
        ) : null}
      </div>
    );
  };

  const renderTechnicalOwnerSelect = () => {
    const selectedTechnicalOwner = technicalOwners.find((user) => user.id === form.technicalOwnerUserId);
    const normalizedSearch = technicalOwnerSearch.trim().toLowerCase();
    const filteredTechnicalOwners = normalizedSearch
      ? technicalOwners.filter((user) =>
          [user.name, user.email, user.role]
            .join(" ")
            .toLowerCase()
            .includes(normalizedSearch)
        )
      : technicalOwners;

    return (
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Technical Owner</div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsTechnicalOwnerDropdownOpen((current) => !current)}
            className="flex h-10 w-full items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-left text-sm text-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:border-blue-500"
          >
            <span className={selectedTechnicalOwner ? "text-white" : "text-slate-500"}>
              {selectedTechnicalOwner
                ? `${selectedTechnicalOwner.name} (${selectedTechnicalOwner.email})`
                : "Select Technical Owner"}
            </span>
            <ChevronDown
              size={16}
              className={cn("shrink-0 text-slate-500 transition-transform", isTechnicalOwnerDropdownOpen && "rotate-180")}
            />
          </button>

          {isTechnicalOwnerDropdownOpen ? (
            <div className="absolute left-0 right-0 top-11 z-[60] rounded-xl border border-slate-800 bg-[#111620] p-3 shadow-2xl">
              <Input
                value={technicalOwnerSearch}
                onChange={(e) => setTechnicalOwnerSearch(e.target.value)}
                placeholder="Search users by name, email, or role"
                autoFocus
              />
              <div className="mt-2 max-h-56 overflow-y-auto">
                {filteredTechnicalOwners.length > 0 ? (
                  filteredTechnicalOwners.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => {
                        setForm((current) => ({ ...current, technicalOwnerUserId: user.id }));
                        setTechnicalOwnerSearch(user.name);
                        setIsTechnicalOwnerDropdownOpen(false);
                      }}
                      className={cn(
                        "block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors",
                        form.technicalOwnerUserId === user.id
                          ? "bg-blue-600 text-white"
                          : "text-slate-300 hover:bg-slate-800 hover:text-white"
                      )}
                    >
                      <span className="block font-medium">{user.name}</span>
                      <span className="block text-xs opacity-70">{user.email} · {user.role}</span>
                    </button>
                  ))
                ) : (
                  <div className="rounded-lg px-3 py-3 text-sm text-amber-400">
                    No users match this search.
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
        {technicalOwners.length === 0 ? (
          <p className="text-[10px] text-slate-500">
            No users available yet. Admin can add technical owners from User Management.
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-800 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.14),_transparent_28%),linear-gradient(180deg,_rgba(15,23,42,0.94),_rgba(8,11,18,0.96))] p-8 shadow-2xl">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">
              <Boxes size={14} />
              Milestone 5
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">Products / Application Portfolio</h1>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Manage business-facing products as first-class records, then map them to the assets,
                licenses, and centrally managed ownership and classification lists in EIALM.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={() => void fetchProducts(true)} disabled={refreshing || loading}>
              {refreshing ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Link2 size={16} className="mr-2" />}
              Refresh
            </Button>
            {isAdmin && (
              <Button variant="outline" onClick={openOptionsModal}>
                <SlidersHorizontal size={16} className="mr-2" />
                Manage Dropdowns
              </Button>
            )}
            {canManage && (
              <Button onClick={openCreateModal}>
                <Plus size={16} className="mr-2" />
                Add Product
              </Button>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="rounded-2xl border border-slate-800 bg-[#151921] p-5 shadow-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">{stat.label}</p>
                  <p className="mt-3 text-3xl font-bold text-white">{stat.value}</p>
                </div>
                <div className={cn("rounded-2xl p-3", stat.tone)}>
                  <Icon size={18} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <section className="rounded-3xl border border-slate-800 bg-[#111620] p-6 shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, code, category, domain, owner, or team"
              className="sm:max-w-md"
            />
            <select
              value={lifecycleFilter}
              onChange={(e) => setLifecycleFilter(e.target.value as "ALL" | ProductLifecycle)}
              className="flex h-10 rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:border-blue-500 transition-all"
            >
              <option value="ALL">All lifecycle states</option>
              {lifecycleOptions.map((option) => (
                <option key={option} value={option}>
                  {formatEnum(option)}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
            Unmapped portfolio items: {summary.unmapped}
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <section className="space-y-4">
        {loading ? (
          <div className="rounded-3xl border border-slate-800 bg-[#111620] p-10 text-center text-sm text-slate-400">
            Loading product portfolio...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-700 bg-[#111620] p-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/70 text-slate-400">
              <Boxes size={22} />
            </div>
            <h2 className="mt-4 text-lg font-bold text-white">No portfolio items found</h2>
            <p className="mt-2 text-sm text-slate-500">
              Adjust the filters or create the first product/application record for this environment.
            </p>
          </div>
        ) : (
          filteredProducts.map((product) => (
            <article key={product.id} className="rounded-3xl border border-slate-800 bg-[#111620] p-6 shadow-xl">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl font-bold text-white">{product.name}</h2>
                    <span className="rounded-full border border-slate-700 bg-slate-900/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300">
                      {product.code}
                    </span>
                    <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em]", lifecycleTone[product.lifecycle])}>
                      {formatEnum(product.lifecycle)}
                    </span>
                    <span className={cn("text-xs font-bold uppercase tracking-[0.2em]", criticalityTone[product.criticality])}>
                      {formatEnum(product.criticality)}
                    </span>
                  </div>

                  <p className="max-w-3xl text-sm leading-6 text-slate-400">
                    {product.description || "No description provided yet."}
                  </p>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-3">
                      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Category</div>
                      <div className="mt-2 text-sm font-medium text-white">{product.categoryOption.value}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-3">
                      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Business Domain</div>
                      <div className="mt-2 text-sm font-medium text-white">{product.businessDomainOption?.value || "Not set"}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-3">
                      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Business Owner</div>
                      <div className="mt-2 text-sm font-medium text-white">{product.businessOwnerOption.value}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-3">
                      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Technical Owner</div>
                      <div className="mt-2 text-sm font-medium text-white">{product.technicalOwnerUser?.name || "Unassigned"}</div>
                    </div>
                  </div>
                </div>

                {canManage && (
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => openEditModal(product)}>
                      <Pencil size={16} className="mr-2" />
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => void handleDelete(product)}
                      disabled={deletingId === product.id}
                    >
                      {deletingId === product.id ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Trash2 size={16} className="mr-2" />}
                      Delete
                    </Button>
                  </div>
                )}
              </div>

              <div className="mt-6 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <section className="rounded-2xl border border-slate-800 bg-slate-900/30 p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white">Linked Assets</h3>
                    <span className="text-xs text-slate-500">{product.assets.length} mapped</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {product.assets.length > 0 ? (
                      product.assets.map((asset) => (
                        <span
                          key={asset.id}
                          className="rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs text-blue-100"
                        >
                          {asset.name} · {asset.serialNumber}
                        </span>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">No infrastructure assets linked yet.</p>
                    )}
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-800 bg-slate-900/30 p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white">Linked Licenses</h3>
                    <span className="text-xs text-slate-500">{product.licenses.length} mapped</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {product.licenses.length > 0 ? (
                      product.licenses.map((license) => (
                        <span
                          key={license.id}
                          className={cn(
                            "rounded-full border px-3 py-1 text-xs",
                            license.isExpired
                              ? "border-red-500/20 bg-red-500/10 text-red-100"
                              : "border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
                          )}
                        >
                          {license.name}
                        </span>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">No licenses linked yet.</p>
                    )}
                  </div>
                </section>
              </div>
            </article>
          ))
        )}
      </section>

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          if (saving) return;
          closeModal();
        }}
        title={editingProduct ? "Edit Product / Application" : "Create Product / Application"}
      >
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Name</div>
              <Input
                value={form.name}
                onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
                placeholder="Billing Platform"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Code</div>
              <Input
                value={form.code}
                onChange={(e) => setForm((current) => ({ ...current, code: e.target.value.toUpperCase() }))}
                placeholder="BILLING-PRD"
              />
            </div>

            {renderOptionSelect(
              "Category",
              form.categoryOptionId,
              "CATEGORY",
              (value) => setForm((current) => ({ ...current, categoryOptionId: value })),
              true
            )}

            {renderOptionSelect(
              "Business Domain",
              form.businessDomainOptionId,
              "BUSINESS_DOMAIN",
              (value) => setForm((current) => ({ ...current, businessDomainOptionId: value }))
            )}

            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Environment</div>
              <select
                value={form.environment}
                onChange={(e) => setForm((current) => ({ ...current, environment: e.target.value as ProductEnvironment }))}
                className="flex h-10 w-full rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:border-blue-500 transition-all"
              >
                {environmentOptions.map((option) => (
                  <option key={option} value={option}>
                    {formatEnum(option)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Lifecycle</div>
              <select
                value={form.lifecycle}
                onChange={(e) => setForm((current) => ({ ...current, lifecycle: e.target.value as ProductLifecycle }))}
                className="flex h-10 w-full rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:border-blue-500 transition-all"
              >
                {lifecycleOptions.map((option) => (
                  <option key={option} value={option}>
                    {formatEnum(option)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Criticality</div>
              <select
                value={form.criticality}
                onChange={(e) => setForm((current) => ({ ...current, criticality: e.target.value as ProductCriticality }))}
                className="flex h-10 w-full rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:border-blue-500 transition-all"
              >
                {criticalityOptions.map((option) => (
                  <option key={option} value={option}>
                    {formatEnum(option)}
                  </option>
                ))}
              </select>
            </div>

            {renderOptionSelect(
              "Support Team",
              form.supportTeamOptionId,
              "SUPPORT_TEAM",
              (value) => setForm((current) => ({ ...current, supportTeamOptionId: value }))
            )}

            {renderOptionSelect(
              "Business Owner",
              form.businessOwnerOptionId,
              "BUSINESS_OWNER",
              (value) => setForm((current) => ({ ...current, businessOwnerOptionId: value })),
              true
            )}

            {renderTechnicalOwnerSelect()}

            <div className="space-y-2 md:col-span-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Documentation URL</div>
              <Input
                value={form.documentationUrl}
                onChange={(e) => setForm((current) => ({ ...current, documentationUrl: e.target.value }))}
                placeholder="https://docs.example.internal/app"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Description</div>
              <textarea
                value={form.description}
                onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))}
                rows={3}
                className="flex w-full rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:border-blue-500 transition-all"
                placeholder="What this product/application does and who it serves"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/25 px-4 py-3 text-xs text-slate-400">
            Category, business domain, support team, and business owner are managed dropdown lists. Technical owner is selected from User Management usernames.
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <section className="rounded-2xl border border-slate-800 bg-slate-900/30 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-bold text-white">Related Assets</h4>
                <span className="text-xs text-slate-500">{form.assetIds.length} selected</span>
              </div>
              <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                {assets.length > 0 ? (
                  assets.map((asset) => (
                    <label
                      key={asset.id}
                      className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-3 text-sm text-slate-300"
                    >
                      <input
                        type="checkbox"
                        checked={form.assetIds.includes(asset.id)}
                        onChange={() =>
                          setForm((current) => ({
                            ...current,
                            assetIds: toggleRelation(current.assetIds, asset.id),
                          }))
                        }
                        className="mt-1"
                      />
                      <div>
                        <div className="font-medium text-white">{asset.name}</div>
                        <div className="text-xs text-slate-500">
                          {asset.serialNumber} · {asset.category} · {formatEnum(asset.status)}
                        </div>
                      </div>
                    </label>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">No assets available for linking yet.</p>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/30 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-bold text-white">Related Licenses</h4>
                <span className="text-xs text-slate-500">{form.licenseIds.length} selected</span>
              </div>
              <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                {licenses.length > 0 ? (
                  licenses.map((license) => (
                    <label
                      key={license.id}
                      className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-3 text-sm text-slate-300"
                    >
                      <input
                        type="checkbox"
                        checked={form.licenseIds.includes(license.id)}
                        onChange={() =>
                          setForm((current) => ({
                            ...current,
                            licenseIds: toggleRelation(current.licenseIds, license.id),
                          }))
                        }
                        className="mt-1"
                      />
                      <div>
                        <div className="font-medium text-white">{license.name}</div>
                        <div className="text-xs text-slate-500">
                          {license.key ? "Key stored" : "No key"} · {license.isExpired ? "Expired" : "Valid"}
                        </div>
                      </div>
                    </label>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">No licenses available for linking yet.</p>
                )}
              </div>
            </section>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Notes</div>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))}
              rows={4}
              className="flex w-full rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:border-blue-500 transition-all"
              placeholder="Operational notes, dependencies, escalation details, or rollout context"
            />
          </div>

          {formError ? (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {formError}
            </div>
          ) : null}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={closeModal} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 size={16} className="mr-2 animate-spin" /> : null}
              {editingProduct ? "Save Changes" : "Create Product"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isOptionsModalOpen}
        onClose={() => {
          if (busyOptionId) return;
          setIsOptionsModalOpen(false);
          setEditingOptionId(null);
          setEditingOptionValue("");
        }}
        title="Manage Product Dropdowns"
      >
        <div className="space-y-6">
          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm leading-6 text-blue-100">
            Admin-only catalog for Product / Application dropdown fields. Technical owners are managed from User Management.
          </div>

          {optionMessage ? (
            <div className="rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3 text-sm text-slate-200">
              {optionMessage}
            </div>
          ) : null}

          <div className="grid gap-4">
            {optionSections.map((section) => (
              <section key={section.type} className="rounded-2xl border border-slate-800 bg-slate-900/30 p-4">
                <div className="mb-4">
                  <h4 className="text-sm font-bold text-white">{section.title}</h4>
                  <p className="mt-1 text-xs text-slate-500">{section.helper}</p>
                </div>

                <div className="mb-4 flex gap-2">
                  <Input
                    value={optionDrafts[section.type]}
                    onChange={(e) =>
                      setOptionDrafts((current) => ({ ...current, [section.type]: e.target.value }))
                    }
                    placeholder={`Add ${section.title}`}
                  />
                  <Button
                    type="button"
                    onClick={() => void handleAddOption(section.type)}
                    disabled={busyOptionId === section.type}
                  >
                    {busyOptionId === section.type ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Plus size={16} className="mr-2" />}
                    Add
                  </Button>
                </div>

                <div className="space-y-2">
                  {(productOptions[section.type] || []).length === 0 ? (
                    <p className="rounded-xl border border-dashed border-slate-700 px-4 py-3 text-sm text-slate-500">
                      No values configured yet.
                    </p>
                  ) : (
                    productOptions[section.type].map((option) => (
                      <div key={option.id} className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-3">
                        {editingOptionId === option.id ? (
                          <Input
                            value={editingOptionValue}
                            onChange={(e) => setEditingOptionValue(e.target.value)}
                            className="flex-1"
                          />
                        ) : (
                          <div className="flex-1 text-sm font-medium text-white">{option.value}</div>
                        )}

                        {editingOptionId === option.id ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => void handleSaveOption(option)}
                              disabled={busyOptionId === option.id}
                            >
                              Save
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingOptionId(null);
                                setEditingOptionValue("");
                              }}
                              disabled={busyOptionId === option.id}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingOptionId(option.id);
                                setEditingOptionValue(option.value);
                              }}
                            >
                              <Pencil size={14} className="mr-2" />
                              Edit
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="danger"
                              onClick={() => void handleDeleteOption(option)}
                              disabled={busyOptionId === option.id}
                            >
                              {busyOptionId === option.id ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Trash2 size={14} className="mr-2" />}
                              Delete
                            </Button>
                          </>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </section>
            ))}
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsOptionsModalOpen(false);
                setEditingOptionId(null);
                setEditingOptionValue("");
              }}
              disabled={!!busyOptionId}
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
