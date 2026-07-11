"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { 
  Users, 
  Ticket, 
  Package, 
  Settings, 
  LayoutDashboard,
  ShieldCheck,
  LogOut,
  User as UserIcon,
  History
} from "lucide-react";

const navItems = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Users", href: "/users", icon: Users },
  { label: "Coupons", href: "/coupons", icon: Ticket },
  { label: "Packages", href: "/packages", icon: Package },
  { label: "Ledger", href: "/ledger", icon: History },
  { label: "Config", href: "/config", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, isAdmin, logout } = useAuth();

  const visibleNavItems = navItems.filter((item) => {
    if (item.href === "/coupons" || item.href === "/packages") {
      return isAdmin;
    }
    return true;
  });

  return (
    <div className="sidebar">
      <div>
        <div className="sidebar-header">
          <ShieldCheck size={32} />
          <span>Admin Panel</span>
        </div>
        <nav className="sidebar-nav">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`nav-item ${isActive ? 'active' : ''}`}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="sidebar-footer">
        {user ? (
          <div className="user-profile">
            <div className="user-info">
              <div className="user-avatar">
                <UserIcon size={16} />
              </div>
              <div className="user-details">
                <p className="user-email">{user.email}</p>
                <p className="user-role">{isAdmin ? "Administrator" : "Team Member"}</p>
              </div>
            </div>
            <button onClick={logout} className="logout-btn" title="Sign Out">
              <LogOut size={20} />
            </button>
          </div>
        ) : (
          <Link href="/login" className="nav-item">
            <UserIcon size={20} />
            <span>Sign In</span>
          </Link>
        )}
      </div>
    </div>
  );
}
