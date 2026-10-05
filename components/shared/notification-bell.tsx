"use client";

import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useNotifications, useReadAllNotifications, useSetNotificationRead,
} from "@/features/notifications/hooks/use-notifications";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

const SEVERITY_DOT: Record<string, string> = {
  INFO: "bg-muted-foreground",
  WARNING: "bg-amber-500",
  CRITICAL: "bg-destructive",
};

const MAX_BADGE = 99;

/**
 * The notification bell.
 *
 * Reads its own feed rather than taking props: the count has to be correct in the
 * sidebar-free layouts too, and every one of those mounts the same Topbar.
 */
export function NotificationBell() {
  const { data, isLoading } = useNotifications();
  const { mutate: setRead } = useSetNotificationRead();
  const { mutate: readAll } = useReadAllNotifications();

  const unreadCount = data?.unreadCount ?? 0;
  const notifications = data?.notifications ?? [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge className="absolute -right-0.5 -top-0.5 h-4 min-w-4 justify-center rounded-full p-0 text-[9px]">
              {unreadCount > MAX_BADGE ? `${MAX_BADGE}+` : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0">
        <DropdownMenuLabel className="flex items-center justify-between px-3 py-2">
          <span>Notifications</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-1.5 text-xs"
              onClick={(e) => {
                // The trigger is the whole row; a click here must not toggle the menu shut.
                e.stopPropagation();
                readAll();
              }}
            >
              <CheckCheck className="h-3 w-3" /> Mark all read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-0" />

        {isLoading && <p className="px-3 py-6 text-center text-sm text-muted-foreground">Loading...</p>}

        {!isLoading && notifications.length === 0 && (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">You are all caught up.</p>
        )}

        {notifications.map((notification) => (
          <DropdownMenuItem
            key={notification.id}
            onSelect={(e) => {
              e.preventDefault();
              setRead({ id: notification.id, read: true });
            }}
            className="items-start gap-2 px-3 py-2.5"
          >
            <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", SEVERITY_DOT[notification.severity])} />
            <span className="min-w-0 flex-1 space-y-0.5">
              <span className="block text-xs font-medium leading-snug">{notification.title}</span>
              {notification.body && (
                <span className="block text-[11px] leading-snug text-muted-foreground">{notification.body}</span>
              )}
              <span className="block text-[10px] text-muted-foreground">
                {formatDateTime(notification.createdAt)}
              </span>
            </span>
            {notification.href && (
              <Link
                href={notification.href}
                onClick={(e) => {
                  // Following the deep link also settles the alert, otherwise
                  // clicking through to the item you just fixed leaves the badge lit.
                  e.stopPropagation();
                  setRead({ id: notification.id, read: true });
                }}
                className="shrink-0 self-center text-[11px] text-primary hover:underline"
              >
                Open
              </Link>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}