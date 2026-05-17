import { useState } from "react";
import { useI18n } from "@/lib/i18n-context";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Building2, MapPin, Plus, Pencil, Database, Trash2, AlertTriangle, Settings } from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
const API = `${BASE}/api`;

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("hrp_access_token");
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}

interface Hospital {
  id: number;
  nameAr: string;
  nameEn: string;
  isKfch: boolean;
  totalCases: number | null;
}

interface HealthCenter {
  id: number;
  nameAr: string;
  nameEn: string | null;
  sectorId: number;
  sectorNameAr: string | null;
}

interface Sector {
  id: number;
  nameAr: string;
  nameEn: string | null;
  hospitalId: number;
  hospitalNameAr: string | null;
  healthCenterCount: number;
}

// ─── Hospitals tab ─────────────────────────────────────────────────────────────
function HospitalsTab() {
  const { lang, t } = useI18n();
  const ar = lang === "ar";
  const qc = useQueryClient();
  const { toast } = useToast();

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Hospital | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Hospital | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ nameAr: "", nameEn: "", isKfch: false });

  const { data: hospitals = [], isLoading } = useQuery<Hospital[]>({
    queryKey: ["hospitals"],
    queryFn: async () => {
      const res = await fetch(`${API}/hospitals`, { headers: getAuthHeaders(), credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  function resetForm() {
    setForm({ nameAr: "", nameEn: "", isKfch: false });
  }

  const addMutation = useMutation({
    mutationFn: async (body: typeof form) => {
      const res = await fetch(`${API}/hospitals`, {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error ?? "Failed");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hospitals"] });
      toast({ title: t("reference.saved") });
      setAddOpen(false);
      resetForm();
    },
    onError: (e) => toast({ title: String(e.message), variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: Partial<typeof form> }) => {
      const res = await fetch(`${API}/hospitals/${id}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error ?? "Failed");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hospitals"] });
      toast({ title: t("reference.saved") });
      setEditTarget(null);
    },
    onError: (e) => toast({ title: String(e.message), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${API}/hospitals/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
        credentials: "include",
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error ?? "Failed");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hospitals"] });
      toast({ title: t("reference.deleted") });
      setDeleteTarget(null);
    },
    onError: (e) => { toast({ title: String(e.message), variant: "destructive" }); setDeleteTarget(null); },
  });

  const filtered = hospitals.filter(
    (h) =>
      h.nameAr.includes(search) ||
      h.nameEn.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <Input
          placeholder={ar ? "بحث..." : "Search..."}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex-1" />
        <Dialog open={addOpen} onOpenChange={(v) => { setAddOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button style={{ background: "#006633" }} className="gap-2 text-white">
              <Plus className="h-4 w-4" />
              {t("reference.addHospital")}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("reference.addHospital")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1">
                <Label>{t("reference.nameAr")} *</Label>
                <Input
                  value={form.nameAr}
                  onChange={(e) => setForm((f) => ({ ...f, nameAr: e.target.value }))}
                  placeholder="مستشفى..."
                  dir="rtl"
                />
              </div>
              <div className="space-y-1">
                <Label>{t("reference.nameEn")} *</Label>
                <Input
                  value={form.nameEn}
                  onChange={(e) => setForm((f) => ({ ...f, nameEn: e.target.value }))}
                  placeholder="Hospital..."
                  dir="ltr"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isKfch-add"
                  checked={form.isKfch}
                  onChange={(e) => setForm((f) => ({ ...f, isKfch: e.target.checked }))}
                  className="h-4 w-4 rounded"
                />
                <Label htmlFor="isKfch-add" className="font-normal cursor-pointer">
                  {t("reference.isKfch")}
                </Label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setAddOpen(false)}>{t("general.cancel")}</Button>
                <Button
                  style={{ background: "#006633" }}
                  className="text-white"
                  disabled={!form.nameAr || !form.nameEn || addMutation.isPending}
                  onClick={() => addMutation.mutate(form)}
                >
                  {addMutation.isPending ? "..." : t("general.save")}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Delete confirm dialog */}
      {deleteTarget && (
        <Dialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                {t("reference.deleteHospital")}
              </DialogTitle>
            </DialogHeader>
            <div className="py-2">
              <p className="text-sm text-muted-foreground">{t("reference.confirmDelete")}</p>
              <p className="mt-2 font-semibold">{deleteTarget.nameAr}</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>{t("general.cancel")}</Button>
              <Button
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
              >
                {deleteMutation.isPending ? "..." : ar ? "حذف" : "Delete"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit dialog */}
      {editTarget && (
        <Dialog open={!!editTarget} onOpenChange={(v) => { if (!v) setEditTarget(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("reference.editHospital")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1">
                <Label>{t("reference.nameAr")} *</Label>
                <Input
                  value={editTarget.nameAr}
                  onChange={(e) => setEditTarget((h) => h ? { ...h, nameAr: e.target.value } : h)}
                  dir="rtl"
                />
              </div>
              <div className="space-y-1">
                <Label>{t("reference.nameEn")} *</Label>
                <Input
                  value={editTarget.nameEn}
                  onChange={(e) => setEditTarget((h) => h ? { ...h, nameEn: e.target.value } : h)}
                  dir="ltr"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isKfch-edit"
                  checked={editTarget.isKfch}
                  onChange={(e) => setEditTarget((h) => h ? { ...h, isKfch: e.target.checked } : h)}
                  className="h-4 w-4 rounded"
                />
                <Label htmlFor="isKfch-edit" className="font-normal cursor-pointer">
                  {t("reference.isKfch")}
                </Label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEditTarget(null)}>{t("general.cancel")}</Button>
                <Button
                  style={{ background: "#006633" }}
                  className="text-white"
                  disabled={editMutation.isPending}
                  onClick={() =>
                    editMutation.mutate({
                      id: editTarget.id,
                      body: { nameAr: editTarget.nameAr, nameEn: editTarget.nameEn, isKfch: editTarget.isKfch },
                    })
                  }
                >
                  {editMutation.isPending ? "..." : t("general.save")}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Table */}
      {isLoading ? (
        <p className="text-center py-10 text-muted-foreground">{t("general.loading")}</p>
      ) : filtered.length === 0 ? (
        <p className="text-center py-10 text-muted-foreground">{t("general.noData")}</p>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead style={{ background: "#006633", color: "#fff" }}>
              <tr>
                <th className="px-4 py-3 text-start">#</th>
                <th className="px-4 py-3 text-start">{t("reference.nameAr")}</th>
                <th className="px-4 py-3 text-start">{t("reference.nameEn")}</th>
                <th className="px-4 py-3 text-center">KFCH</th>
                <th className="px-4 py-3 text-center">{t("general.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((h, i) => (
                <tr key={h.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="px-4 py-3 text-muted-foreground">{h.id}</td>
                  <td className="px-4 py-3 font-medium">{h.nameAr}</td>
                  <td className="px-4 py-3">{h.nameEn}</td>
                  <td className="px-4 py-3 text-center">
                    {h.isKfch ? (
                      <Badge style={{ background: "#e8f5ee", color: "#006633" }}>KFCH</Badge>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditTarget(h)}
                        className="h-7 px-2"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteTarget(h)}
                        className="h-7 px-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Health Centers tab ────────────────────────────────────────────────────────
function HealthCentersTab() {
  const { lang, t } = useI18n();
  const ar = lang === "ar";
  const qc = useQueryClient();
  const { toast } = useToast();

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<HealthCenter | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HealthCenter | null>(null);
  const [search, setSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState<string>("all");
  const [form, setForm] = useState({ nameAr: "", nameEn: "", sectorId: "" });

  const { data: centers = [], isLoading } = useQuery<HealthCenter[]>({
    queryKey: ["health-centers"],
    queryFn: async () => {
      const res = await fetch(`${API}/health-centers`, { headers: getAuthHeaders(), credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: sectors = [] } = useQuery<Sector[]>({
    queryKey: ["sectors"],
    queryFn: async () => {
      const res = await fetch(`${API}/sectors`, { headers: getAuthHeaders(), credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  function resetForm() {
    setForm({ nameAr: "", nameEn: "", sectorId: "" });
  }

  const addMutation = useMutation({
    mutationFn: async (body: { nameAr: string; nameEn?: string; sectorId: number }) => {
      const res = await fetch(`${API}/health-centers`, {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error ?? "Failed");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["health-centers"] });
      qc.invalidateQueries({ queryKey: ["sectors"] });
      toast({ title: t("reference.saved") });
      setAddOpen(false);
      resetForm();
    },
    onError: (e) => toast({ title: String(e.message), variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: { nameAr?: string; nameEn?: string; sectorId?: number } }) => {
      const res = await fetch(`${API}/health-centers/${id}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error ?? "Failed");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["health-centers"] });
      toast({ title: t("reference.saved") });
      setEditTarget(null);
    },
    onError: (e) => toast({ title: String(e.message), variant: "destructive" }),
  });

  const filtered = centers.filter((c) => {
    const matchSearch =
      c.nameAr.includes(search) ||
      (c.nameEn ?? "").toLowerCase().includes(search.toLowerCase());
    const matchSector = sectorFilter === "all" || String(c.sectorId) === sectorFilter;
    return matchSearch && matchSector;
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${API}/health-centers/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
        credentials: "include",
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error ?? "Failed");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["health-centers"] });
      qc.invalidateQueries({ queryKey: ["sectors"] });
      toast({ title: t("reference.deleted") });
      setDeleteTarget(null);
    },
    onError: (e) => { toast({ title: String(e.message), variant: "destructive" }); setDeleteTarget(null); },
  });

  const [editSectorId, setEditSectorId] = useState<string>("");

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder={ar ? "بحث بالاسم..." : "Search by name..."}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={sectorFilter} onValueChange={setSectorFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder={ar ? "كل القطاعات" : "All sectors"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{ar ? "كل القطاعات" : "All sectors"}</SelectItem>
            {sectors.map((s) => (
              <SelectItem key={s.id} value={String(s.id)}>{s.nameAr}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <span className="text-sm text-muted-foreground">
          {filtered.length} {ar ? "مركز" : "centers"}
        </span>
        <Dialog open={addOpen} onOpenChange={(v) => { setAddOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button style={{ background: "#006633" }} className="gap-2 text-white">
              <Plus className="h-4 w-4" />
              {t("reference.addHealthCenter")}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("reference.addHealthCenter")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1">
                <Label>{t("reference.nameAr")} *</Label>
                <Input
                  value={form.nameAr}
                  onChange={(e) => setForm((f) => ({ ...f, nameAr: e.target.value }))}
                  placeholder="مركز صحي..."
                  dir="rtl"
                />
              </div>
              <div className="space-y-1">
                <Label>{t("reference.nameEn")}</Label>
                <Input
                  value={form.nameEn}
                  onChange={(e) => setForm((f) => ({ ...f, nameEn: e.target.value }))}
                  placeholder="Health Center..."
                  dir="ltr"
                />
              </div>
              <div className="space-y-1">
                <Label>{t("reference.sector")} *</Label>
                <Select
                  value={form.sectorId}
                  onValueChange={(v) => setForm((f) => ({ ...f, sectorId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={ar ? "اختر القطاع" : "Select sector"} />
                  </SelectTrigger>
                  <SelectContent>
                    {sectors.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.nameAr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setAddOpen(false)}>{t("general.cancel")}</Button>
                <Button
                  style={{ background: "#006633" }}
                  className="text-white"
                  disabled={!form.nameAr || !form.sectorId || addMutation.isPending}
                  onClick={() =>
                    addMutation.mutate({
                      nameAr: form.nameAr,
                      nameEn: form.nameEn || undefined,
                      sectorId: Number(form.sectorId),
                    })
                  }
                >
                  {addMutation.isPending ? "..." : t("general.save")}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Delete confirm dialog */}
      {deleteTarget && (
        <Dialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                {t("reference.deleteHealthCenter")}
              </DialogTitle>
            </DialogHeader>
            <div className="py-2">
              <p className="text-sm text-muted-foreground">{t("reference.confirmDelete")}</p>
              <p className="mt-2 font-semibold">{deleteTarget.nameAr}</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>{t("general.cancel")}</Button>
              <Button
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
              >
                {deleteMutation.isPending ? "..." : ar ? "حذف" : "Delete"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit dialog */}
      {editTarget && (
        <Dialog open={!!editTarget} onOpenChange={(v) => { if (!v) { setEditTarget(null); setEditSectorId(""); } }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("reference.editHealthCenter")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1">
                <Label>{t("reference.nameAr")} *</Label>
                <Input
                  value={editTarget.nameAr}
                  onChange={(e) => setEditTarget((c) => c ? { ...c, nameAr: e.target.value } : c)}
                  dir="rtl"
                />
              </div>
              <div className="space-y-1">
                <Label>{t("reference.nameEn")}</Label>
                <Input
                  value={editTarget.nameEn ?? ""}
                  onChange={(e) => setEditTarget((c) => c ? { ...c, nameEn: e.target.value } : c)}
                  dir="ltr"
                />
              </div>
              <div className="space-y-1">
                <Label>{t("reference.sector")}</Label>
                <Select
                  value={editSectorId || String(editTarget.sectorId)}
                  onValueChange={(v) => setEditSectorId(v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sectors.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.nameAr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => { setEditTarget(null); setEditSectorId(""); }}>{t("general.cancel")}</Button>
                <Button
                  style={{ background: "#006633" }}
                  className="text-white"
                  disabled={editMutation.isPending}
                  onClick={() => {
                    const body: { nameAr?: string; nameEn?: string; sectorId?: number } = {
                      nameAr: editTarget.nameAr,
                      nameEn: editTarget.nameEn ?? undefined,
                    };
                    if (editSectorId) body.sectorId = Number(editSectorId);
                    editMutation.mutate({ id: editTarget.id, body });
                  }}
                >
                  {editMutation.isPending ? "..." : t("general.save")}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Table */}
      {isLoading ? (
        <p className="text-center py-10 text-muted-foreground">{t("general.loading")}</p>
      ) : filtered.length === 0 ? (
        <p className="text-center py-10 text-muted-foreground">{t("general.noData")}</p>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead style={{ background: "#006633", color: "#fff" }}>
              <tr>
                <th className="px-4 py-3 text-start">#</th>
                <th className="px-4 py-3 text-start">{t("reference.nameAr")}</th>
                <th className="px-4 py-3 text-start">{t("reference.nameEn")}</th>
                <th className="px-4 py-3 text-start">{t("reference.sector")}</th>
                <th className="px-4 py-3 text-center">{t("general.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr key={c.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="px-4 py-3 text-muted-foreground">{c.id}</td>
                  <td className="px-4 py-3 font-medium">{c.nameAr}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.nameEn ?? "-"}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-xs">{c.sectorNameAr}</Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setEditTarget(c); setEditSectorId(""); }}
                        className="h-7 px-2"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteTarget(c)}
                        className="h-7 px-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Settings tab ──────────────────────────────────────────────────────────────
const URGENT_THRESHOLD_KEY = "hrp_urgent_threshold";
const DEFAULT_URGENT_THRESHOLD = 5;

function SettingsTab() {
  const { lang, t } = useI18n();
  const ar = lang === "ar";
  const { toast } = useToast();

  const [inputValue, setInputValue] = useState<string>(() => {
    const stored = localStorage.getItem(URGENT_THRESHOLD_KEY);
    if (stored !== null) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed) && parsed >= 0) return String(parsed);
    }
    return String(DEFAULT_URGENT_THRESHOLD);
  });

  const handleSave = () => {
    const parsed = parseInt(inputValue, 10);
    if (isNaN(parsed) || parsed < 0) {
      toast({ title: ar ? "يجب أن تكون القيمة رقمًا صحيحًا غير سالب" : "Value must be a non-negative integer", variant: "destructive" });
      return;
    }
    localStorage.setItem(URGENT_THRESHOLD_KEY, String(parsed));
    toast({ title: t("reference.urgentThresholdSaved") });
  };

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h2 className="text-base font-semibold" style={{ color: "#006633" }}>
          {t("reference.urgentThresholdLabel")}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("reference.urgentThresholdDesc")}
        </p>
        <div className="flex items-center gap-3 mt-3">
          <Input
            type="number"
            min={0}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="w-32"
            dir="ltr"
          />
          <Button
            style={{ background: "#006633" }}
            className="text-white"
            onClick={handleSave}
          >
            {t("general.save")}
          </Button>
          <Button
            variant="ghost"
            className="text-muted-foreground text-xs"
            onClick={() => {
              setInputValue(String(DEFAULT_URGENT_THRESHOLD));
              localStorage.removeItem(URGENT_THRESHOLD_KEY);
              toast({ title: ar ? "تم استعادة القيمة الافتراضية" : "Reset to default" });
            }}
          >
            {ar ? "إعادة تعيين" : "Reset to default"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function ReferencePage() {
  const { lang, t } = useI18n();
  const { isAdmin } = useAuth();
  const ar = lang === "ar";

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {ar ? "هذه الصفحة للمدير فقط" : "This page is for admins only"}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg" style={{ background: "#e8f5ee" }}>
          <Database className="h-6 w-6" style={{ color: "#006633" }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#006633" }}>
            {t("reference.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {ar ? "إدارة قوائم المستشفيات والمراكز الصحية" : "Manage hospitals and health centers lists"}
          </p>
        </div>
      </div>

      <Card className="border-0 shadow-md">
        <CardHeader className="pb-0">
          <Tabs defaultValue="hospitals">
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="hospitals" className="gap-2">
                <Building2 className="h-4 w-4" />
                {t("reference.hospitals")}
              </TabsTrigger>
              <TabsTrigger value="health-centers" className="gap-2">
                <MapPin className="h-4 w-4" />
                {t("reference.healthCenters")}
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-2">
                <Settings className="h-4 w-4" />
                {t("reference.settings")}
              </TabsTrigger>
            </TabsList>

            <CardContent className="pt-6">
              <TabsContent value="hospitals" className="mt-0">
                <HospitalsTab />
              </TabsContent>
              <TabsContent value="health-centers" className="mt-0">
                <HealthCentersTab />
              </TabsContent>
              <TabsContent value="settings" className="mt-0">
                <SettingsTab />
              </TabsContent>
            </CardContent>
          </Tabs>
        </CardHeader>
      </Card>
    </div>
  );
}
