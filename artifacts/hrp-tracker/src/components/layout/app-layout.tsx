import React from "react";
import { Link, useLocation } from "wouter";
import { useI18n } from "../../lib/i18n-context";
import { useAuth } from "../../lib/auth-context";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard,
  Users,
  Activity,
  Bell,
  BookOpen,
  Languages,
  Shield,
  LogOut,
  UserCog,
  ChevronUp,
  FileDown,
  Database,
} from "lucide-react";
import logoPath from "../../assets/logo.jpg";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { lang, setLang, t } = useI18n();
  const { user, logout, isAdmin } = useAuth();
  const [location] = useLocation();

  const navItems = [
    { href: "/", icon: LayoutDashboard, label: t("nav.dashboard") },
    { href: "/patients", icon: Users, label: t("nav.patients") },
    { href: "/pregnancies", icon: Activity, label: t("nav.pregnancies") },
    { href: "/alerts", icon: Bell, label: t("nav.alerts") },
    { href: "/reports", icon: FileDown, label: t("nav.reports") },
    { href: "/guide", icon: BookOpen, label: t("nav.guide") },
    ...(isAdmin ? [
      { href: "/users", icon: UserCog, label: t("nav.users") },
      { href: "/admin/reference", icon: Database, label: t("nav.reference") },
    ] : []),
  ];

  const roleLabel: Record<string, { ar: string; en: string }> = {
    admin: { ar: "مدير النظام", en: "System Admin" },
    coordinator: { ar: "منسق", en: "Coordinator" },
    doctor: { ar: "طبيب", en: "Doctor" },
    viewer: { ar: "عارض", en: "Viewer" },
  };

  const userRole = user?.role ?? "viewer";
  const roleDisplay = lang === "ar" ? roleLabel[userRole]?.ar : roleLabel[userRole]?.en;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar className="border-e border-border">
          <SidebarHeader
            className="p-4 flex flex-col items-center"
            style={{ background: "#004d26" }}
          >
            <div
              className="w-full h-1 rounded mb-3"
              style={{ background: "linear-gradient(90deg, #00a651, #006633, #00a651)" }}
            />
            <img
              src={logoPath}
              alt={lang === "ar" ? "شعار تجمع جازان الصحي" : "Jazan Health Cluster Logo"}
              className="w-16 h-16 object-contain"
            />
            <h1 className="mt-2 text-xs font-bold text-center text-white/90 leading-relaxed">
              {lang === "ar" ? (
                <>منظومة الحمل عالي الخطورة<br />تجمع جازان الصحي</>
              ) : (
                <>High-Risk Pregnancy<br />Jazan Health Cluster</>
              )}
            </h1>
          </SidebarHeader>

          <SidebarContent style={{ background: "#004d26" }}>
            <SidebarMenu className="px-2 py-2">
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.href}
                    tooltip={item.label}
                    className="text-white/80 hover:text-white hover:bg-white/10 data-[active=true]:bg-white/20 data-[active=true]:text-white"
                  >
                    <Link href={item.href} className="flex items-center gap-3 w-full">
                      <item.icon className="w-5 h-5 shrink-0" aria-hidden="true" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter
            className="p-3 space-y-2 border-t border-white/10"
            style={{ background: "#004d26" }}
          >
            <SidebarMenuButton
              onClick={() => setLang(lang === "ar" ? "en" : "ar")}
              className="justify-center text-white/70 hover:text-white hover:bg-white/10"
              aria-label={lang === "ar" ? "Switch to English" : "التبديل للعربية"}
            >
              <Languages className="w-4 h-4" aria-hidden="true" />
              <span className="text-sm">{lang === "ar" ? "English" : "العربية"}</span>
            </SidebarMenuButton>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton className="text-white/80 hover:text-white hover:bg-white/10 w-full">
                  <div className="flex items-center gap-2 w-full min-w-0">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: "#00a651", color: "#fff" }}
                      aria-hidden="true"
                    >
                      {user?.nameAr?.charAt(0) ?? "م"}
                    </div>
                    <div className="flex-1 min-w-0 text-start">
                      <p className="text-xs font-medium truncate text-white">{user?.nameAr}</p>
                      <p className="text-[10px] text-white/50">{roleDisplay}</p>
                    </div>
                    <ChevronUp className="w-3 h-3 text-white/50 shrink-0" aria-hidden="true" />
                  </div>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align="start"
                className="w-52"
              >
                <Link href="/privacy">
                  <DropdownMenuItem>
                    <Shield className="w-4 h-4 mx-2" aria-hidden="true" />
                    {lang === "ar" ? "سياسة الخصوصية" : "Privacy Policy"}
                  </DropdownMenuItem>
                </Link>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="text-red-600 focus:text-red-600"
                >
                  <LogOut className="w-4 h-4 mx-2" aria-hidden="true" />
                  {lang === "ar" ? "تسجيل الخروج" : "Sign Out"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col min-w-0 overflow-hidden" role="main">
          <header
            className="h-14 border-b border-border bg-card flex items-center justify-between px-4 shrink-0"
            role="banner"
          >
            <div className="flex items-center gap-3">
              <SidebarTrigger
                aria-label={lang === "ar" ? "تبديل القائمة الجانبية" : "Toggle sidebar"}
              />
              <div
                className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-white"
                style={{ background: "#006633" }}
              >
                <Shield className="w-3 h-3" aria-hidden="true" />
                {lang === "ar" ? "نظام آمن ومشفّر" : "Secure & Encrypted"}
              </div>
            </div>

            <div className="text-xs text-muted-foreground hidden md:block">
              {lang === "ar"
                ? "منظومة المعلومات الصحية | تجمع جازان الصحي 2026"
                : "Health Information System | Jazan Health Cluster 2026"}
            </div>
          </header>

          {/* Skip to content link for WCAG 2.1 AA */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:start-2 focus:z-50 focus:px-4 focus:py-2 focus:rounded focus:text-white focus:font-medium"
            style={{ background: "#006633" }}
          >
            {lang === "ar" ? "تخطى إلى المحتوى" : "Skip to content"}
          </a>

          <div id="main-content" className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
            {children}
          </div>

          <footer
            className="border-t border-border bg-card px-6 py-3 flex items-center justify-between text-xs text-muted-foreground"
            role="contentinfo"
          >
            <span>
              © 2026{" "}
              {lang === "ar"
                ? "تجمع جازان الصحي"
                : "Jazan Health Cluster"}
            </span>
            <div className="flex items-center gap-3">
              <Link
                href="/privacy"
                className="hover:underline focus:outline-none focus:ring-2 focus:ring-offset-1 rounded"
                style={{ color: "#006633" }}
              >
                {lang === "ar" ? "الخصوصية" : "Privacy"}
              </Link>
              <span aria-hidden="true">|</span>
              <span>{lang === "ar" ? "الإصدار 2.0" : "v2.0"}</span>
            </div>
          </footer>
        </main>
      </div>
    </SidebarProvider>
  );
}
