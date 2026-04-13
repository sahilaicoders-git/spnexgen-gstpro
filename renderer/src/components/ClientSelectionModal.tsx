import { useEffect, useMemo, useState } from "react";
import { Building2, Plus, Search, UserCheck, X } from "lucide-react";
import type { ClientRecord } from "../types";

type Props = {
  open: boolean;
  clients: ClientRecord[];
  loading: boolean;
  recentlyUsed: ClientRecord[];
  onClose: () => void;
  onSelectClient: (client: ClientRecord) => void;
  onRefresh: () => Promise<void>;
};

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export default function ClientSelectionModal({
  open,
  clients,
  loading,
  recentlyUsed,
  onClose,
  onSelectClient,
  onRefresh,
}: Props) {
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newGstin, setNewGstin] = useState("");
  const [addError, setAddError] = useState("");
  const [creating, setCreating] = useState(false);

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;

    return clients.filter(
      (c) => c.clientName.toLowerCase().includes(q) || c.gstin.toLowerCase().includes(q)
    );
  }, [clients, search]);

  useEffect(() => {
    if (!open) return;
    setSelectedIndex(0);
  }, [open, search]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, Math.max(filteredClients.length - 1, 0)));
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      }

      if (e.key === "Enter" && filteredClients[selectedIndex]) {
        e.preventDefault();
        onSelectClient(filteredClients[selectedIndex]);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, filteredClients, selectedIndex, onClose, onSelectClient]);

  const createClient = async () => {
    setAddError("");
    const normalizedGstin = newGstin.trim().toUpperCase();

    if (!newClientName.trim()) {
      setAddError("Client Name is required.");
      return;
    }
    if (!GSTIN_REGEX.test(normalizedGstin)) {
      setAddError("Enter a valid 15-character GSTIN.");
      return;
    }

    try {
      setCreating(true);
      await window.gstAPI.createClientStructure({
        clientName: newClientName.trim(),
        gstin: normalizedGstin,
        clientType: "Regular",
        status: "Active",
      });
      setCreating(false);
      setShowAddForm(false);
      setNewClientName("");
      setNewGstin("");
      await onRefresh();
    } catch (error) {
      setCreating(false);
      setAddError(error instanceof Error ? error.message : "Could not create client.");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-6">
      <div className="w-full max-w-6xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 p-4 sm:p-5">
          <div className="flex items-center gap-2 text-slate-800">
            <Building2 size={18} />
            <h2 className="text-lg font-semibold">Select Client</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                placeholder="Search by Client Name / GSTIN"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={() => setShowAddForm((v) => !v)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              <Plus size={16} />
              Add New Client
            </button>
          </div>

          {showAddForm && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
              <p className="mb-2 text-sm font-medium text-slate-700">Quick Add Client</p>
              <div className="grid gap-3 md:grid-cols-3">
                <input
                  className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-cyan-500"
                  placeholder="Client Name"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                />
                <input
                  className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm uppercase outline-none focus:border-cyan-500"
                  placeholder="GSTIN"
                  maxLength={15}
                  value={newGstin}
                  onChange={(e) => setNewGstin(e.target.value.toUpperCase())}
                />
                <button
                  type="button"
                  onClick={createClient}
                  disabled={creating}
                  className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-70"
                >
                  {creating ? "Creating..." : "Create"}
                </button>
              </div>
              {addError && <p className="mt-2 text-xs text-rose-600">{addError}</p>}
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="max-h-[45vh] overflow-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="sticky top-0 bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Client Name</th>
                    <th className="px-4 py-3">GSTIN</th>
                    <th className="px-4 py-3">Client Type</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {!loading && filteredClients.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                        No client found
                      </td>
                    </tr>
                  )}

                  {filteredClients.map((client, idx) => {
                    const active = selectedIndex === idx;
                    return (
                      <tr key={client.gstin} className={active ? "bg-cyan-50" : ""}>
                        <td className="px-4 py-3 font-medium text-slate-700">{client.clientName}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-600">{client.gstin}</td>
                        <td className="px-4 py-3 text-slate-600">{client.clientType}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                            {client.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => onSelectClient(client)}
                            className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-700"
                          >
                            Select
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
            <div className="mb-2 flex items-center gap-2 text-slate-700">
              <UserCheck size={16} />
              <p className="text-sm font-semibold">Recently Used Clients</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {recentlyUsed.length === 0 && <p className="text-sm text-slate-500">No recent clients yet.</p>}
              {recentlyUsed.map((client) => (
                <button
                  key={`recent-${client.gstin}`}
                  type="button"
                  onClick={() => onSelectClient(client)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-cyan-300 hover:text-cyan-700"
                >
                  {client.clientName} - {client.gstin}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
