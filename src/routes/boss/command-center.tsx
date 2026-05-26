import { createFileRoute } from "@tanstack/react-router";
import {
  Users,
  Boxes,
  Cpu,
  Activity,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { requireBoss } from "@/lib/route-guards";

export const Route = createFileRoute("/boss/command-center")({
  beforeLoad: requireBoss,
  head: () => ({
    meta: [
      { title: "Command Center · Boss" },
      { name: "description", content: "Unified Boss mega dashboard: users, portals, AI engine, ops & sync." },
    ],
  }),
  component: CommandCenterPage,
});

function CommandCenterPage() {
  return (
    <div className="py-6">
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-gold">
          Mega Command Center
        </h1>
        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground mt-1">
          Unified surface · users · portals · AI · ops
        </p>
      </header>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full bg-background/60 border border-border rounded-xl p-1 mb-6">
          <TabsTrigger
            value="users"
            className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm gap-1.5 text-xs sm:text-sm"
          >
            <Users className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">1. Users & CRM</span>
            <span className="sm:hidden">Users</span>
          </TabsTrigger>
          <TabsTrigger
            value="portals"
            className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm gap-1.5 text-xs sm:text-sm"
          >
            <Boxes className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">2. Portals & Content</span>
            <span className="sm:hidden">Portals</span>
          </TabsTrigger>
          <TabsTrigger
            value="ai"
            className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm gap-1.5 text-xs sm:text-sm"
          >
            <Cpu className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">3. AI Engine</span>
            <span className="sm:hidden">AI</span>
          </TabsTrigger>
          <TabsTrigger
            value="ops"
            className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm gap-1.5 text-xs sm:text-sm"
          >
            <Activity className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">4. Ops & Sync</span>
            <span className="sm:hidden">Ops</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <ModulePlaceholder title="Users & CRM" />
        </TabsContent>
        <TabsContent value="portals">
          <ModulePlaceholder title="Portals & Content" />
        </TabsContent>
        <TabsContent value="ai">
          <ModulePlaceholder title="AI Engine" />
        </TabsContent>
        <TabsContent value="ops">
          <ModulePlaceholder title="Ops & Sync" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ModulePlaceholder({ title }: { title: string }) {
  return (
    <div className="rounded-xl border border-border bg-background shadow-2xl p-8 sm:p-12">
      <div className="flex flex-col items-center justify-center gap-4 text-center">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
          <Activity className="h-6 w-6 text-primary/60" />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Loading {title} Module…
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            This operational surface is being prepared. Check back shortly for live data.
          </p>
        </div>
      </div>
    </div>
  );
}
