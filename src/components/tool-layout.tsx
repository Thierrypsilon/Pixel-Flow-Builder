import { Link } from "wouter";
import { ArrowLeft, Layers } from "lucide-react";

interface ToolLayoutProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  headerRight?: React.ReactNode;
}

export function ToolLayout({ title, description, children, headerRight }: ToolLayoutProps) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="flex items-center justify-between px-5 py-3 border-b border-zinc-800/60 bg-zinc-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Link href="/">
            <button
              data-testid="button-back-to-tools"
              className="flex items-center gap-1.5 text-zinc-400 text-sm hover:text-zinc-100 transition-colors mr-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Tools
            </button>
          </Link>
          <div className="w-px h-5 bg-zinc-700" />
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
              <Layers className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <span className="font-bold text-sm leading-none block">{title}</span>
              {description && <span className="text-xs text-zinc-500 leading-none block mt-0.5">{description}</span>}
            </div>
          </div>
        </div>
        {headerRight && <div className="flex items-center gap-2">{headerRight}</div>}
      </header>
      <div className="flex-1 flex overflow-hidden">{children}</div>
    </div>
  );
}
