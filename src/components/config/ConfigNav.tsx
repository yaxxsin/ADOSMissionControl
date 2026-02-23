"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Settings,
  Gamepad2,
  Video,
  Bell,
  Palette,
  Database,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
}

const GCS_NAV_ITEMS: NavItem[] = [
  { href: "/config", label: "General", icon: <Settings size={14} /> },
  { href: "/config/input", label: "Input Devices", icon: <Gamepad2 size={14} /> },
  { href: "/config/video", label: "Video", icon: <Video size={14} /> },
  { href: "/config/notifications", label: "Notifications", icon: <Bell size={14} /> },
  { href: "/config/theme", label: "Theme", icon: <Palette size={14} /> },
  { href: "/config/data", label: "Data", icon: <Database size={14} /> },
  { href: "/config/firmware", label: "Flash Tool", icon: <Zap size={14} /> },
];

export function ConfigNav() {
  const pathname = usePathname();

  return (
    <nav className="w-[200px] border-r border-border-default bg-bg-secondary flex-shrink-0 overflow-y-auto">
      {/* GCS Settings */}
      <div className="px-3 py-3 border-b border-border-default">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          GCS Settings
        </h2>
      </div>
      <div className="flex flex-col py-1">
        {GCS_NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors",
              pathname === item.href
                ? "text-accent-primary bg-accent-primary/10 border-l-2 border-l-accent-primary"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary border-l-2 border-l-transparent"
            )}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
