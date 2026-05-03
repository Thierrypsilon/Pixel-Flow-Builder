import { useEffect, useRef } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import type { ToolDefinition } from "@/tools/types";

interface ToolCardProps {
  tool: ToolDefinition;
}

export function ToolCard({ tool }: ToolCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const tRef = useRef(Math.random() * 10);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const loop = () => {
      tRef.current += 0.025;
      tool.preview(ctx, tRef.current, canvas.width, canvas.height);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [tool]);

  return (
    <Link href={tool.path} data-testid={`card-tool-${tool.id}`}>
      <article
        className="group relative bg-card border border-card-border rounded-lg overflow-hidden cursor-pointer hover-elevate transition-all duration-200"
      >
        {/* Canvas Preview */}
        <div className="relative w-full aspect-[3/2] overflow-hidden bg-black">
          <canvas
            ref={canvasRef}
            width={300}
            height={200}
            className="block w-full h-full"
            style={{ imageRendering: "pixelated" }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/10 to-transparent" />

          {/* Popular badge */}
          {tool.popular && (
            <div className="absolute top-2.5 left-2.5">
              <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 backdrop-blur-sm">
                <Sparkles className="w-2.5 h-2.5" />
                Beliebt
              </span>
            </div>
          )}

          {/* Tags */}
          <div className="absolute top-2.5 right-2.5 flex gap-1 flex-wrap justify-end">
            {tool.tags?.map(tag => (
              <span key={tag} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-black/50 text-zinc-300 backdrop-blur-sm border border-white/10">
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <h3 className="font-bold text-sm text-foreground leading-tight">{tool.title}</h3>
            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all duration-200 shrink-0" />
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-3">
            {tool.description}
          </p>
          <Button
            size="sm"
            variant="secondary"
            className="w-full text-xs font-medium"
            data-testid={`button-open-${tool.id}`}
            tabIndex={-1}
          >
            Jetzt öffnen
          </Button>
        </div>
      </article>
    </Link>
  );
}
