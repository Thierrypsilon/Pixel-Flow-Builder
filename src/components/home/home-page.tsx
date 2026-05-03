import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { HomeSidebar } from "@/components/home-sidebar";
import { ToolCard } from "@/components/home/tool-card";
import { TOOLS } from "@/tools/registry";

export default function HomePage() {
  const sidebarStyle = {
    "--sidebar-width": "14rem",
    "--sidebar-width-icon": "3.25rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties} defaultOpen={true}>
      <div className="flex min-h-screen w-full bg-background">
        <HomeSidebar />

        <div className="flex flex-col flex-1 min-w-0">
          {/* Top header */}
          <header className="sticky top-0 z-40 flex items-center gap-3 px-5 py-3 border-b border-border/60 bg-background/80 backdrop-blur-sm">
            <SidebarTrigger data-testid="button-sidebar-toggle" className="text-muted-foreground" />
            <div className="flex-1" />
            <a
              href="https://ksawerykomputery.com/tools/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors hidden sm:block"
              data-testid="link-inspiration-header"
            >
              Inspiriert von ksawerykomputery.com/tools
            </a>
          </header>

          {/* Main content */}
          <main className="flex-1 px-6 py-10 max-w-5xl mx-auto w-full">
            {/* Hero */}
            <div className="mb-10">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1.5 h-5 rounded-full bg-gradient-to-b from-violet-500 to-fuchsia-500" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Erkunden</span>
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-foreground leading-tight mb-3">
                <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
                  Pixel-Flow-Builder
                </span>
              </h1>
              <p className="text-muted-foreground text-base max-w-lg leading-relaxed">
                21 Canvas Creative Tools
              </p>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {TOOLS.map(tool => (
                <ToolCard key={tool.id} tool={tool} />
              ))}
            </div>

            {/* Footer */}
            <footer className="mt-16 pt-8 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground/50">
              <span>Pixel-Flow-Builder — 21 Canvas Creative Tools</span>
              <a
                href="https://ksawerykomputery.com/tools/"
                target="_blank"
                rel="noopener noreferrer"
                data-testid="link-inspiration"
                className="hover:text-muted-foreground transition-colors underline underline-offset-2"
              >
                Inspiriert von ksawerykomputery.com/tools
              </a>
            </footer>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
