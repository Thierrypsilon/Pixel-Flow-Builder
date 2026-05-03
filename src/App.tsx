import { Suspense } from "react";
import { Switch, Route } from "wouter";
import HomePage from "@/components/home/home-page";
import NotFound from "@/pages/not-found";
import { Toaster } from "@/components/ui/toaster";
import { TOOLS } from "@/tools/registry";

export default function App() {
  return (
    <>
      <Suspense
        fallback={
          <div className="grid place-items-center h-dvh text-foreground bg-background">
            <p>Lädt …</p>
          </div>
        }
      >
        <Switch>
          <Route path="/" component={HomePage} />
          {TOOLS.map((t) => (
            <Route key={t.id} path={t.path} component={t.page} />
          ))}
          <Route component={NotFound} />
        </Switch>
      </Suspense>
      <Toaster />
    </>
  );
}
