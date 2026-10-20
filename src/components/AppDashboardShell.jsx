import React, { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  GraduationCap,
  Users,
  BookOpen,
  CalendarDays,
  ClipboardList,
  Wallet,
  FileText,
  PencilLine,
  Files,
  IdCard,
  LibraryBig,
  BookMarked,
  Info,
  Settings,
  LogOut,
  ChevronsUpDown,
  BadgeCheck,
  Bell,
} from "lucide-react";
import { APP_BRAND_LOGO } from "@/shared/theme";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { TooltipProvider } from "@/components/ui/tooltip";

const NAV_ICONS = {
  dashboard: LayoutDashboard,
  students: GraduationCap,
  staff: Users,
  academic: BookOpen,
  timetable: CalendarDays,
  attendance: ClipboardList,
  fees: Wallet,
  examination: FileText,
  "daily-register": PencilLine,
  paper: Files,
  card: IdCard,
  "book-bank": LibraryBig,
  library: BookMarked,
  about: Info,
  settings: Settings,
};

function navIcon(id) {
  return NAV_ICONS[id] || LayoutDashboard;
}

function NavGlyph({ id, className }) {
  return React.createElement(navIcon(id), { className, "aria-hidden": true });
}

function SyncDot({ isSupabaseConfigured, isOnline, cloudReady, cloudSyncing }) {
  const label = !isSupabaseConfigured
    ? "Local only · This device"
    : !isOnline
      ? "Offline · Will sync"
      : cloudReady
        ? "Cloud · Worldwide"
        : cloudSyncing
          ? "Syncing…"
          : "Connecting…";
  const color = !isSupabaseConfigured
    ? "bg-neutral-400"
    : !isOnline
      ? "bg-neutral-800"
      : cloudReady
        ? "bg-neutral-900"
        : "bg-neutral-500";
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 text-[11px] text-muted-foreground">
      <span className={`size-1.5 shrink-0 rounded-full ${color}`} />
      <span className="truncate group-data-[collapsible=icon]:hidden">{label}</span>
    </div>
  );
}

function ShellNav({ nav, page, onNavigate }) {
  const { isMobile, setOpenMobile } = useSidebar();
  return (
    <SidebarMenu>
      {nav.map((item) => {
        const isActive = page === item.id;
        return (
          <SidebarMenuItem key={item.id}>
            <SidebarMenuButton
              isActive={isActive}
              tooltip={item.l}
              onClick={() => {
                onNavigate?.(item.id);
                if (isMobile) setOpenMobile(false);
              }}
            >
              <NavGlyph id={item.id} className="size-4" />
              <span>{item.l}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

function MenuRow({ icon, label, onClick, destructive = false }) {
  return (
    <button
      type="button"
      role="menuitem"
      className={
        destructive
          ? "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-destructive outline-none hover:bg-destructive/10"
          : "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground"
      }
      onClick={onClick}
    >
      {React.createElement(icon, { className: "size-4 shrink-0", "aria-hidden": true })}
      <span>{label}</span>
    </button>
  );
}

/**
 * shadcn-style account menu (no Upgrade / Billing).
 * Local popover — avoids Base UI Menu modal backdrop that dims the page.
 */
function UserAccountMenu({
  currentUser,
  session,
  roleLabel,
  initials,
  onSignOut,
  onChangePassword,
  onNavigate,
  canOpenSettings = false,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const displayName = currentUser?.name || "User";
  const displayEmail = currentUser?.email || roleLabel || "";

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const closeThen = (fn) => () => {
    setOpen(false);
    fn?.();
  };

  return (
    <div ref={rootRef} className="relative w-full">
      <SidebarMenuButton
        size="lg"
        tooltip={displayName}
        aria-expanded={open}
        aria-haspopup="menu"
        className="data-[state=open]:bg-sidebar-accent"
        data-state={open ? "open" : "closed"}
        onClick={() => setOpen((v) => !v)}
      >
        <Avatar className="size-8 rounded-lg">
          <AvatarFallback className="rounded-lg bg-neutral-900 text-xs font-semibold text-white">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="grid min-w-0 flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
          <span className="truncate font-semibold">{displayName}</span>
          <span className="truncate text-xs text-muted-foreground">{displayEmail}</span>
        </div>
        <ChevronsUpDown className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
      </SidebarMenuButton>

      {open ? (
        <div
          role="menu"
          className="absolute bottom-[calc(100%+8px)] left-0 z-50 w-56 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md"
        >
          <div className="flex items-center gap-2 px-2 py-1.5 text-left text-sm">
            <Avatar className="size-8 rounded-lg">
              <AvatarFallback className="rounded-lg bg-neutral-900 text-xs font-semibold text-white">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="grid min-w-0 flex-1 leading-tight">
              <span className="truncate font-semibold">{displayName}</span>
              <span className="truncate text-xs text-muted-foreground">{displayEmail}</span>
            </div>
          </div>

          <div className="my-1 h-px bg-border" />

          {session?.userId ? (
            <MenuRow
              icon={BadgeCheck}
              label="Account"
              onClick={closeThen(onChangePassword)}
            />
          ) : null}

          <MenuRow
            icon={Bell}
            label="Notifications"
            onClick={closeThen(() => onNavigate?.("dashboard"))}
          />

          {canOpenSettings ? (
            <MenuRow
              icon={Settings}
              label="Settings"
              onClick={closeThen(() => onNavigate?.("settings"))}
            />
          ) : null}

          <div className="my-1 h-px bg-border" />

          <MenuRow icon={LogOut} label="Log out" destructive onClick={closeThen(onSignOut)} />
        </div>
      ) : null}
    </div>
  );
}

export function AppDashboardShell({
  nav = [],
  page,
  onNavigate,
  schoolName,
  schoolCode,
  pageTitle,
  pageSubtitle,
  currentUser,
  session,
  roleLabel,
  isSupabaseConfigured,
  isOnline,
  cloudReady,
  cloudSyncing,
  onSignOut,
  onChangePassword,
  children,
  className = "",
}) {
  const active = nav.find((n) => n.id === page);
  const initials = String(currentUser?.name || currentUser?.email || "U")
    .charAt(0)
    .toUpperCase();
  const canOpenSettings = nav.some((n) => n.id === "settings");

  const defaultSidebarOpen =
    typeof window === "undefined" ? true : window.innerWidth >= 1280;

  return (
    <TooltipProvider>
      <SidebarProvider
        defaultOpen={defaultSidebarOpen}
        className={`flex h-full min-h-0! w-full overflow-hidden ${className}`.trim()}
      >
        <Sidebar
          collapsible="icon"
          className="app-sidebar no-print border-r border-border bg-sidebar text-sidebar-foreground"
        >
          <SidebarHeader className="border-b border-border">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  size="lg"
                  className="pointer-events-none"
                  tooltip={(schoolName || "").trim() || "PSMS"}
                >
                  <img
                    src={APP_BRAND_LOGO}
                    alt=""
                    className="size-8 shrink-0 rounded-lg object-contain"
                  />
                  <div className="grid min-w-0 flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="truncate font-semibold">
                      {(schoolName || "").trim() || "PSMS"}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {schoolCode || "School workspace"}
                    </span>
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Platform</SidebarGroupLabel>
              <SidebarGroupContent>
                <ShellNav nav={nav} page={page} onNavigate={onNavigate} />
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="relative z-20 gap-0 overflow-visible">
            <SyncDot
              isSupabaseConfigured={isSupabaseConfigured}
              isOnline={isOnline}
              cloudReady={cloudReady}
              cloudSyncing={cloudSyncing}
            />
            <SidebarSeparator className="mx-0" />
            <SidebarMenu>
              <SidebarMenuItem className="relative overflow-visible">
                <UserAccountMenu
                  currentUser={currentUser}
                  session={session}
                  roleLabel={roleLabel}
                  initials={initials}
                  onSignOut={onSignOut}
                  onChangePassword={onChangePassword}
                  onNavigate={onNavigate}
                  canOpenSettings={canOpenSettings}
                />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>

        <SidebarInset className="app-main min-w-0 flex-1 overflow-hidden bg-muted/30">
          <header className="app-header no-print sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background/95 px-2 backdrop-blur supports-backdrop-filter:bg-background/80 sm:h-14 sm:px-4">
            <SidebarTrigger className="-ml-0.5 shrink-0" />
            <Separator orientation="vertical" className="mr-1 hidden h-4 sm:block" />
            <Breadcrumb className="min-w-0 flex-1 overflow-hidden">
              <BreadcrumbList className="flex-nowrap">
                <BreadcrumbItem className="hidden min-w-0 md:inline-flex">
                  <span className="truncate text-muted-foreground">
                    {(schoolName || "").trim() || "PSMS"}
                  </span>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem className="min-w-0">
                  <BreadcrumbPage className="flex min-w-0 items-center gap-2 font-medium text-foreground">
                    <NavGlyph id={page} className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{pageTitle || active?.l || "Page"}</span>
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            {pageSubtitle ? (
              <Badge variant="secondary" className="hidden max-w-[40%] truncate font-normal lg:inline-flex">
                {pageSubtitle}
              </Badge>
            ) : null}
          </header>

          <div
            id="print-section"
            className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-4 md:p-6"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
