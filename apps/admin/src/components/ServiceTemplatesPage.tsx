"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { apiFetch, ApiError } from "@/lib/api";
import type { ServiceTemplate } from "@/lib/types";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { DropdownMenu } from "@/components/DropdownMenu";

const inputClass =
  "rounded-md border border-teal-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20";

function pluralize(word: string): string {
  const lower = word.toLowerCase();
  return /[sxz]$|[cs]h$/.test(lower) ? `${lower}es` : `${lower}s`;
}

interface Props {
  type: "CLASS" | "APPOINTMENT";
  title: string;
  singular: string;
}

export function ServiceTemplatesPage({ type, title, singular }: Props) {
  const { user, loading: userLoading } = useCurrentUser();
  const [templates, setTemplates] = useState<ServiceTemplate[] | null>(null);
  const [search, setSearch] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ServiceTemplate | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [duration, setDuration] = useState("60");
  const [capacity, setCapacity] = useState("");
  const [price, setPrice] = useState("");
  const [memberPrice, setMemberPrice] = useState("");
  const [description, setDescription] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    load().catch(() => setLoadError("Couldn't load — please refresh."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function load() {
    const all = await apiFetch<ServiceTemplate[]>("/service-templates");
    setTemplates(all.filter((t) => t.type === type));
  }

  const filtered = useMemo(() => {
    if (!templates) return [];
    const q = search.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t) => t.name.toLowerCase().includes(q));
  }, [templates, search]);

  function resetCreateForm() {
    setName("");
    setDuration("60");
    setCapacity("");
    setPrice("");
    setMemberPrice("");
    setDescription("");
    setCreateError(null);
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setSubmitting(true);
    try {
      await apiFetch("/service-templates", {
        method: "POST",
        body: JSON.stringify({
          name,
          type,
          description: description || undefined,
          defaultDurationMinutes: Number(duration),
          defaultCapacity: type === "CLASS" && capacity ? Number(capacity) : undefined,
          defaultPrice: Number(price),
          defaultMemberPrice: memberPrice ? Number(memberPrice) : undefined,
        }),
      });
      resetCreateForm();
      setShowForm(false);
      await load();
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function onToggleActive(tpl: ServiceTemplate) {
    setActionError(null);
    await apiFetch(`/service-templates/${tpl.id}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: !tpl.isActive }),
    });
    await load();
  }

  async function onDelete(tpl: ServiceTemplate) {
    setActionError(null);
    try {
      await apiFetch(`/service-templates/${tpl.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Couldn't delete this item.");
    }
  }

  if (loadError) {
    return <div className="flex h-screen items-center justify-center text-red-600">{loadError}</div>;
  }

  if (userLoading || templates === null) {
    return (
      <div className="flex h-screen items-center justify-center text-teal-700">Loading...</div>
    );
  }

  if (user?.globalRole !== "HQ_ADMIN") {
    return (
      <>
        <PageHeader title={title} />
        <div className="p-8 text-sm text-teal-700">Managed by HQ Admin only.</div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={title}
        description={`${templates.length} ${templates.length === 1 ? singular.toLowerCase() : pluralize(singular)} — master catalog locations activate from`}
        action={<Button onClick={() => setShowForm(true)}>+ Add {singular}</Button>}
      />

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={`Create a ${singular.toLowerCase()}`}
        description="HQ-defined — locations activate this into their own bookable service."
      >
        <form onSubmit={onCreate} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-teal-900">Name</span>
            <input
              required
              autoFocus
              placeholder={type === "CLASS" ? "e.g. Bunkers" : "e.g. 1:1 Coaching"}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-teal-900">Description</span>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputClass}
            />
          </label>
          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1.5 text-sm">
              <span className="font-medium text-teal-900">Duration (min)</span>
              <input
                required
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className={inputClass}
              />
            </label>
            {type === "CLASS" && (
              <label className="flex flex-1 flex-col gap-1.5 text-sm">
                <span className="font-medium text-teal-900">Capacity</span>
                <input
                  type="number"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  className={inputClass}
                />
              </label>
            )}
          </div>
          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1.5 text-sm">
              <span className="font-medium text-teal-900">Default price</span>
              <input
                required
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="flex flex-1 flex-col gap-1.5 text-sm">
              <span className="font-medium text-teal-900">Member price</span>
              <input
                type="number"
                placeholder="Optional"
                value={memberPrice}
                onChange={(e) => setMemberPrice(e.target.value)}
                className={inputClass}
              />
            </label>
          </div>
          {createError && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{createError}</p>
          )}
          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating..." : `Create ${singular.toLowerCase()}`}
            </Button>
          </div>
        </form>
      </Modal>

      <EditTemplateModal
        template={editingTemplate}
        type={type}
        onClose={() => setEditingTemplate(null)}
        onSaved={load}
      />

      <div className="flex flex-col gap-6 p-8">
        <input
          placeholder={`Search ${pluralize(singular)}...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`max-w-xs ${inputClass}`}
        />

        {actionError && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{actionError}</p>
        )}

        {filtered.length === 0 ? (
          <p className="text-sm text-teal-700">
            {templates.length === 0 ? `No ${pluralize(singular)} yet.` : "No matches."}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((tpl) => (
              <div
                key={tpl.id}
                className={`flex gap-3 rounded-lg border-l-4 border-teal-100 bg-white p-4 shadow-sm ${
                  type === "CLASS" ? "border-l-teal-500" : "border-l-gold-500"
                }`}
              >
                <Image
                  src="/logo.png"
                  alt=""
                  width={818}
                  height={616}
                  className="h-12 w-12 shrink-0 rounded-md border border-teal-50 bg-teal-900 object-contain p-1"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-1">
                    <h3 className="truncate text-sm font-semibold text-teal-900">{tpl.name}</h3>
                    <DropdownMenu
                      items={[
                        { label: "Edit", onClick: () => setEditingTemplate(tpl) },
                        {
                          label: tpl.isActive ? "Deactivate" : "Activate",
                          onClick: () => onToggleActive(tpl),
                        },
                        { label: "Delete", onClick: () => onDelete(tpl), danger: true },
                      ]}
                    />
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-teal-700">
                    <span>{tpl.defaultDurationMinutes} min</span>
                    <span>·</span>
                    <span>${tpl.defaultPrice}</span>
                    {tpl.defaultMemberPrice && <span>(${tpl.defaultMemberPrice} member)</span>}
                    {type === "CLASS" && tpl.defaultCapacity && (
                      <>
                        <span>·</span>
                        <span>cap {tpl.defaultCapacity}</span>
                      </>
                    )}
                  </div>
                  {tpl.description && (
                    <p className="mt-1.5 line-clamp-2 text-xs text-teal-700/80">{tpl.description}</p>
                  )}
                  <div className="mt-2">
                    <Badge variant={tpl.isActive ? "success" : "danger"}>
                      {tpl.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function EditTemplateModal({
  template,
  type,
  onClose,
  onSaved,
}: {
  template: ServiceTemplate | null;
  type: "CLASS" | "APPOINTMENT";
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("");
  const [capacity, setCapacity] = useState("");
  const [price, setPrice] = useState("");
  const [memberPrice, setMemberPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!template) return;
    setName(template.name);
    setDescription(template.description ?? "");
    setDuration(String(template.defaultDurationMinutes));
    setCapacity(template.defaultCapacity != null ? String(template.defaultCapacity) : "");
    setPrice(template.defaultPrice);
    setMemberPrice(template.defaultMemberPrice ?? "");
    setError(null);
  }, [template]);

  if (!template) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!template) return;
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch(`/service-templates/${template.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name,
          description: description || undefined,
          defaultDurationMinutes: Number(duration),
          defaultCapacity: type === "CLASS" && capacity ? Number(capacity) : undefined,
          defaultPrice: Number(price),
          defaultMemberPrice: memberPrice ? Number(memberPrice) : undefined,
        }),
      });
      onClose();
      await onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={!!template}
      onClose={onClose}
      title={`Edit ${type === "CLASS" ? "class" : "appointment"}`}
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-teal-900">Name</span>
          <input
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-teal-900">Description</span>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass}
          />
        </label>
        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1.5 text-sm">
            <span className="font-medium text-teal-900">Duration (min)</span>
            <input
              required
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className={inputClass}
            />
          </label>
          {type === "CLASS" && (
            <label className="flex flex-1 flex-col gap-1.5 text-sm">
              <span className="font-medium text-teal-900">Capacity</span>
              <input
                type="number"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                className={inputClass}
              />
            </label>
          )}
        </div>
        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1.5 text-sm">
            <span className="font-medium text-teal-900">Default price</span>
            <input
              required
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1.5 text-sm">
            <span className="font-medium text-teal-900">Member price</span>
            <input
              type="number"
              placeholder="Optional"
              value={memberPrice}
              onChange={(e) => setMemberPrice(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
