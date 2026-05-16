import React from "react";
import { Link, useLocation } from "wouter";
import { useI18n } from "../../lib/i18n-context";
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
import { LayoutDashboard, Users, Activity, Bell, BookOpen, Languages, Settings } from "lucide-react";
import logoPath from "../../assets/logo.jpg";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { lang, setLang, t } = useI18n();
  const [location] = useLocation();

  const navItems = [
    { href: "/", icon: LayoutDashboard, label: t("nav.dashboard") },
    { href: "/patients", icon: Users, label: t("nav.patients") },
    { href: "/pregnancies", icon: Activity, label: t("nav.pregnancies") },
    { href: "/alerts", icon: Bell, label: t("nav.alerts") },
    { href: "/guide", icon: BookOpen, label: t("nav.guide") },
  ];

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar className="border-r rtl:border-l rtl:border-r-0 border-border bg-sidebar">
          <SidebarHeader className="p-4 flex items-center justify-center">
            <img src={logoPath} alt="Logo" className="w-16 h-16 object-contain" />
            <h1 className="mt-2 text-sm font-bold text-center text-sidebar-foreground">
              High-Risk Pregnancy<br />Jazan Health Cluster
            </h1>
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location === item.href}
                    tooltip={item.label}
                  >
                    <Link href={item.href} className="flex items-center gap-3 w-full">
                      <item.icon className="w-5 h-5" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter className="p-4 space-y-2">
            <SidebarMenuButton onClick={() => setLang(lang === "ar" ? "en" : "ar")} className="justify-center">
              <Languages className="w-5 h-5 mr-2 rtl:ml-2 rtl:mr-0" />
              <span>{lang === "ar" ? "English" : "العربية"}</span>
            </SidebarMenuButton>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <header className="h-14 border-b border-border bg-card flex items-center px-4 shrink-0">
            <SidebarTrigger className="mr-4 rtl:ml-4 rtl:mr-0" />
          </header>
          <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
