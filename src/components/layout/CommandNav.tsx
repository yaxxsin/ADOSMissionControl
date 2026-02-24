"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Plane,
  Route,
  History,
  BarChart3,
  HeartPulse,
} from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: Plane, label: "Fly", href: "/fly/alpha-1" },
  { icon: Route, label: "Plan", href: "/plan" },
{ icon: History, label: "History", href: "/history" },
  { icon: BarChart3, label: "Analytics", href: "/analytics" },
  { icon: HeartPulse, label: "Wizard", href: "/wizard" },
] as const;

export function CommandNav() {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <nav className="flex items-center gap-1">
      {tabs.map(({ icon: Icon, label, href }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors",
              active
                ? "text-accent-primary border-b-2 border-accent-primary"
                : "text-text-secondary hover:text-text-primary"
            )}
          >
            <Icon size={14} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
