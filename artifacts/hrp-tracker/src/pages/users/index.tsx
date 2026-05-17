import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Users, CheckCircle, XCircle, Pencil } from "lucide-react";

interface User {
  id: number;
  username: string;
  role: string;
  nameAr: string;
  nameEn: string | null;
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
}

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
const API = `${BASE}/api`;

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("hrp_access_token");
  return token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
}

const roleColor: Record<string, string> = {
  admin: "bg-red-100 text-red-800",
  coordinator: "bg-blue-100 text-blue-800",
  doctor: "bg-purple-100 text-purple-800",
  viewer: "bg-gray-100 text-gray-700",
};

const roleLabel: Record<string, { ar: string; en: string }> = {
  admin: { ar: "مدير", en: "Admin" },
  coordinator: { ar: "منسق", en: "Coordinator" },
  doctor: { ar: "طبيب", en: "Doctor" },
  viewer: { ar: "عارض", en: "Viewer" },
};

export default function UsersPage() {
  const { lang } = useI18n();
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const ar = lang === "ar";
  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [editRole, setEditRole] = useState<string>("");

  const [form, setForm] = useState({
    username: "",
    password: "",
    nameAr: "",
    nameEn: "",
    role: "viewer" as string,
  });

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await fetch(`${API}/users`, {
        headers: getAuthHeaders(),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load users");
      return res.json();
    },
    enabled: isAdmin,
  });

  const createMutation = useMutation({
    mutationFn: async (body: typeof form) => {
      const res = await fetch(`${API}/users`, {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error);
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      setOpen(false);
      setForm({ username: "", password: "", nameAr: "", nameEn: "", role: "viewer" });
      toast({ title: ar ? "تم إنشاء الحساب بنجاح" : "User created successfully" });
    },
    onError: (err: Error) => {
      toast({ title: ar ? "خطأ" : "Error", description: err.message, variant: "destructive" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const res = await fetch(`${API}/users/${id}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error);
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
    onError: (err: Error) => toast({ title: String(err.message), variant: "destructive" }),
  });

  const changeRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: number; role: string }) => {
      const res = await fetch(`${API}/users/${id}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error);
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      setEditTarget(null);
      toast({ title: ar ? "تم تغيير الدور بنجاح" : "Role changed successfully" });
    },
    onError: (err: Error) => toast({ title: String(err.message), variant: "destructive" }),
  });

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">
          {ar ? "هذه الصفحة للمدراء فقط" : "This page is for admins only"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-6 h-6" style={{ color: "#006633" }} />
          <h1 className="text-2xl font-bold">{ar ? "إدارة المستخدمين" : "User Management"}</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button style={{ background: "#006633", color: "#fff" }}>
              <UserPlus className="w-4 h-4 mx-1" />
              {ar ? "إضافة مستخدم" : "Add User"}
            </Button>
          </DialogTrigger>
          <DialogContent dir={ar ? "rtl" : "ltr"}>
            <DialogHeader>
              <DialogTitle>{ar ? "إنشاء حساب جديد" : "Create New Account"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label>{ar ? "اسم المستخدم" : "Username"}</Label>
                <Input
                  value={form.username}
                  onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                />
              </div>
              <div>
                <Label>{ar ? "كلمة المرور" : "Password"}</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                />
              </div>
              <div>
                <Label>{ar ? "الاسم بالعربية" : "Arabic Name"}</Label>
                <Input
                  value={form.nameAr}
                  onChange={(e) => setForm((p) => ({ ...p, nameAr: e.target.value }))}
                />
              </div>
              <div>
                <Label>{ar ? "الاسم بالإنجليزية (اختياري)" : "English Name (optional)"}</Label>
                <Input
                  value={form.nameEn}
                  onChange={(e) => setForm((p) => ({ ...p, nameEn: e.target.value }))}
                />
              </div>
              <div>
                <Label>{ar ? "الدور" : "Role"}</Label>
                <Select
                  value={form.role}
                  onValueChange={(v) => setForm((p) => ({ ...p, role: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(roleLabel).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {ar ? v.ar : v.en}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                style={{ background: "#006633", color: "#fff" }}
                onClick={() => createMutation.mutate(form)}
                disabled={
                  createMutation.isPending || !form.username || !form.password || !form.nameAr
                }
              >
                {ar ? "إنشاء الحساب" : "Create Account"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Role-edit dialog */}
      {editTarget && (
        <Dialog
          open={!!editTarget}
          onOpenChange={(v) => {
            if (!v) setEditTarget(null);
          }}
        >
          <DialogContent dir={ar ? "rtl" : "ltr"} className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>{ar ? "تغيير دور المستخدم" : "Change User Role"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">
                {ar
                  ? `المستخدم: ${editTarget.nameAr} (@${editTarget.username})`
                  : `User: ${editTarget.nameAr} (@${editTarget.username})`}
              </p>
              <div>
                <Label>{ar ? "الدور الجديد" : "New Role"}</Label>
                <Select value={editRole} onValueChange={setEditRole}>
                  <SelectTrigger className="mt-1">
                    <SelectValue
                      placeholder={
                        ar ? roleLabel[editTarget.role]?.ar : roleLabel[editTarget.role]?.en
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(roleLabel).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {ar ? v.ar : v.en}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEditTarget(null)}>
                  {ar ? "إلغاء" : "Cancel"}
                </Button>
                <Button
                  style={{ background: "#006633" }}
                  className="text-white"
                  disabled={
                    !editRole || editRole === editTarget.role || changeRoleMutation.isPending
                  }
                  onClick={() => changeRoleMutation.mutate({ id: editTarget.id, role: editRole })}
                >
                  {changeRoleMutation.isPending ? "..." : ar ? "حفظ" : "Save"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {ar ? `المستخدمون (${users.length})` : `Users (${users.length})`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">
              {ar ? "جاري التحميل..." : "Loading..."}
            </p>
          ) : (
            <div className="space-y-3">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 border rounded-lg bg-card"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{user.nameAr}</span>
                      {user.nameEn && (
                        <span className="text-sm text-muted-foreground">({user.nameEn})</span>
                      )}
                      <Badge className={roleColor[user.role] ?? "bg-gray-100 text-gray-700"}>
                        {ar ? roleLabel[user.role]?.ar : roleLabel[user.role]?.en}
                      </Badge>
                      {!user.isActive && (
                        <Badge variant="secondary">{ar ? "موقوف" : "Inactive"}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      @{user.username}
                      {user.lastLogin &&
                        ` · ${ar ? "آخر دخول" : "Last login"}: ${new Date(user.lastLogin).toLocaleDateString(ar ? "ar-SA" : "en-GB")}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Change role */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditTarget(user);
                        setEditRole(user.role);
                      }}
                      title={ar ? "تغيير الدور" : "Change role"}
                    >
                      <Pencil className="w-4 h-4 text-muted-foreground" />
                    </Button>
                    {/* Toggle active */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        toggleActiveMutation.mutate({ id: user.id, isActive: !user.isActive })
                      }
                      title={
                        ar
                          ? user.isActive
                            ? "إيقاف الحساب"
                            : "تفعيل الحساب"
                          : user.isActive
                            ? "Deactivate"
                            : "Activate"
                      }
                    >
                      {user.isActive ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
