import { Link, useLocation } from "wouter";
import { SiGithub, SiX } from "react-icons/si";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarGroup,
  SidebarGroupContent, SidebarSeparator,
} from "@/components/ui/sidebar";
import { Layers, Compass, Info, Mail, BookOpen, GraduationCap, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const navMain = [
  { title: "Erkunden", url: "/", icon: Compass },
  { title: "Artikel", url: "#", icon: BookOpen, soon: true },
  { title: "Tutorials", url: "#", icon: GraduationCap, soon: true },
];

const navSecondary = [
  { title: "Über", url: "#", icon: Info },
  { title: "Kontakt", url: "#", icon: Mail },
];

export function HomeSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2.5 group-data-[collapsible=icon]:justify-center">
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shrink-0">
            <Layers className="w-4 h-4 text-white" />
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <span className="font-bold text-sm leading-none block">Creative Tools</span>
            <span className="text-xs text-muted-foreground leading-none block mt-0.5">Canvas Kreativwerkzeuge</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navMain.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={item.url === location}
                    tooltip={item.title}
                  >
                    <Link href={item.url}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                      {item.soon && (
                        <Badge className="ml-auto text-[10px] h-4 px-1.5 bg-muted text-muted-foreground group-data-[collapsible=icon]:hidden">
                          Bald
                        </Badge>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navSecondary.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <a href={item.url}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3">
        <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-colors"
            data-testid="link-github"
          >
            <SiGithub className="w-4 h-4" />
          </a>
          <a
            href="https://x.com"
            target="_blank"
            rel="noopener noreferrer"
            className="w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-colors group-data-[collapsible=icon]:hidden"
            data-testid="link-twitter"
          >
            <SiX className="w-4 h-4" />
          </a>
          <a
            href="https://ksawerykomputery.com/tools/"
            target="_blank"
            rel="noopener noreferrer"
            className="w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-colors group-data-[collapsible=icon]:hidden"
            data-testid="link-inspiration-footer"
          >
            <Star className="w-4 h-4" />
          </a>
        </div>
        <p className="text-[10px] text-muted-foreground/40 mt-2 group-data-[collapsible=icon]:hidden text-center leading-snug">
          Inspiriert von{" "}
          <a href="https://ksawerykomputery.com/tools/" target="_blank" rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-muted-foreground transition-colors">
            ksawerykomputery.com/tools
          </a>
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
