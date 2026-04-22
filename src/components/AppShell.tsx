// =============================================================================
// AppShell — layout for pages that live under the four-tab navigation
// =============================================================================
// Renders the anonymous "sign in to save" banner, then the TopNav, then an
// <Outlet /> for the actual page. Login and the full-bleed driller pages sit
// OUTSIDE this shell (defined as sibling routes in App.tsx).
// =============================================================================

import { Outlet } from "react-router-dom";
import { AnonymousBanner } from "@/components/AnonymousBanner";
import { TopNav } from "@/components/TopNav";
import { PotemkinChat } from "@/components/PotemkinChat";

export function AppShell() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <AnonymousBanner />
      <TopNav />
      <Outlet />
      <PotemkinChat />
    </div>
  );
}
