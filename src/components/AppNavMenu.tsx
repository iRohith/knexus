"use client";

import { BrainCircuit, ChevronDown, Grid2X2, Network, ShieldCheck } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { FaSlack } from "react-icons/fa";
import {
  SiConfluence,
  SiFireflyiii,
  SiGmail,
  SiGoogledrive,
  SiGithub,
  SiHubspot,
  SiJira,
  SiLinear,
} from "react-icons/si";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navItems = [
  { label: "Intelligence", href: "/", icon: BrainCircuit, aliases: ["/intelligence"] },
  { label: "Knowledge Graph", href: "/knowledge-graph", icon: Network },
  { label: "Admin", href: "/admin", icon: ShieldCheck },
  { label: "Gmail", href: "/gmail", icon: SiGmail },
  { label: "Slack", href: "/slack", icon: FaSlack },
  { label: "GitHub", href: "/github", icon: SiGithub },
  { label: "Linear", href: "/linear", icon: SiLinear },
  { label: "Jira", href: "/jira", icon: SiJira },
  { label: "HubSpot", href: "/hubspot", icon: SiHubspot },
  { label: "Google Drive", href: "/google-drive", icon: SiGoogledrive },
  { label: "Confluence", href: "/confluence", icon: SiConfluence },
  { label: "Fireflies", href: "/fireflies", icon: SiFireflyiii },
] as const;

export function AppNavMenu() {
  const pathname = usePathname();
  const router = useRouter();
  const activeItem = navItems.find((item) => {
    const aliases = "aliases" in item ? item.aliases : [];
    return (
      pathname === item.href ||
      pathname.startsWith(`${item.href}/`) ||
      aliases.some((alias) => pathname === alias || pathname.startsWith(`${alias}/`))
    );
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" className="gap-2">
            {activeItem ? <activeItem.icon className="size-4" /> : <Grid2X2 className="size-4" />}
            {activeItem?.label ?? "Apps"}
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuGroup>
          {navItems.map((item) => {
            const isActive = activeItem?.href === item.href;

            return (
              <DropdownMenuItem
                key={item.href}
                className={isActive ? "bg-accent text-accent-foreground" : undefined}
                onClick={() => router.push(item.href)}
              >
                <item.icon className="size-4" />
                {item.label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
