"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import type { ServiceTemplate } from "@/lib/types";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";

const inputClass =
  "rounded-md border border-teal-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20";

export default function TemplatesPage() {
  const { user, loading: userLoading } = useCurrentUser();
  const [templates, setTemplates] = useState<ServiceTemplate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ServiceTemplate | null>(null);

  const [name, setName] = useState("");
  const [type, setType] = useState<"CLASS" | "APPOINTMENT">("CLASS");
  const [duration, setDuration] = useState("60");
  const [capacity, setCapacity] = useState("");
  const [price, setPrice] = useState("");
  const [memberPrice, setMemberPrice] = useState("");

  useEffect(() => {
    if (!user) return;
    loadTemplates().catch(() => setLoadError("Couldn't load templates — please refresh."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function loadTemplates() {
    setTemplates(await apiFetch<ServiceTemplate[]>("/service-templates"));
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch("/service-templates", {
        method: "POST",
        body: JSON.stringify({
          name,
          type,
          defaultDurationMinutes: Number(duration),
          defaultCapacity: capacity ? Number(capacity) : undefined,
          defaultPrice: Number(price),
          defaultMemberPrice: memberPrice ? Number(memberPrice) : undefined,
        }),
      });
      setName("");
      setCapacity("");
      setPrice("");
      setMemberPrice("");
      setShowForm(false);
      await loadTemplates();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
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
        <PageHeader title="HQ Service Templates" />
        <div className="p-8 text-sm text-teal-700">
          HQ Service Templates are managed by HQ Admin only.
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="HQ Service Templates"
        description={`${templates.length} template${templates.length === 1 ? "" : "s"} — master catalog locations activate from`}
        action={<Button onClick={() => setShowForm(true)}>+ New Template</Button>}
      />

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Create a service template"
        description="HQ-defined classes and appointments locations can activate."
      >
        <form onSubmit={onCreate} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-teal-900">Name</span>
            <input
              required
              autoFocus
              placeholder="e.g. G50 Driver Session"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </label>
          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1.5 text-sm">
              <span className="font-medium text-teal-900">Type</span>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as "CLASS" | "APPOINTMENT")}
                className={inputClass}
              >
                <option value="CLASS">Class</option>
                <option value="APPOINTMENT">Appointment</option>
              </select>
            </label>
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
          </div>
          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1.5 text-sm">
              <span className="font-medium text-teal-900">Capacity</span>
              <input
                type="number"
                placeholder="Classes only"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                className={inputClass}
              />
            </label>
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
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create template"}
            </Button>
          </div>
        </form>
      </Modal>

      <EditTemplateModal
        template={editingTemplate}
        onClose={() => setEditingTemplate(null)}
        onSaved={loadTemplates}
      />

      <div className="flex flex-col gap-6 p-8">
        <Card className="overflow-hidden !p-0">
          {templates.length === 0 ? (
            <p className="p-5 text-sm text-teal-700">No templates yet.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-teal-50 text-xs font-semibold tracking-wide text-teal-700 uppercase">
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Duration</th>
                  <th className="px-5 py-3">Capacity</th>
                  <th className="px-5 py-3">Price</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-teal-50">
                {templates.map((tpl) => (
                  <tr key={tpl.id} className="hover:bg-teal-50/40">
                    <td className="px-5 py-3 font-medium text-teal-900">{tpl.name}</td>
                    <td className="px-5 py-3">
                      <Badge variant={tpl.type === "CLASS" ? "neutral" : "gold"}>{tpl.type}</Badge>
                    </td>
                    <td className="px-5 py-3 text-teal-700">{tpl.defaultDurationMinutes} min</td>
                    <td className="px-5 py-3 text-teal-700">{tpl.defaultCapacity ?? "—"}</td>
                    <td className="px-5 py-3 text-teal-700">
                      ${tpl.defaultPrice}
                      {tpl.defaultMemberPrice ? ` / $${tpl.defaultMemberPrice} member` : ""}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button
                        variant="ghost"
                        className="!px-2 !py-1 text-xs"
                        onClick={() => setEditingTemplate(tpl)}
                      >
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </>
  );
}

function EditTemplateModal({
  template,
  onClose,
  onSaved,
}: {
  template: ServiceTemplate | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("");
  const [capacity, setCapacity] = useState("");
  const [price, setPrice] = useState("");
  const [memberPrice, setMemberPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!template) return;
    setName(template.name);
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
          defaultDurationMinutes: Number(duration),
          defaultCapacity: capacity ? Number(capacity) : undefined,
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
      title="Edit service template"
      description={template.type === "CLASS" ? "Class" : "Appointment"}
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
          <label className="flex flex-1 flex-col gap-1.5 text-sm">
            <span className="font-medium text-teal-900">Capacity</span>
            <input
              type="number"
              placeholder="Classes only"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              className={inputClass}
            />
          </label>
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
