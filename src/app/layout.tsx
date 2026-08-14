"use client";

import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { usePathname } from "next/navigation";
import { AuthProvider, useAuth } from "@/lib/AuthContext";
import { ToastProvider } from "@/lib/ToastContext";
import { cn } from "@/lib/utils";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta-sans"
});

import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";

function LayoutContent({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (loading) {
    return (
      <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--background)' }}>
        <div className="loader"></div>
      </div>
    );
  }

  return isLoginPage ? (
    <>{children}</>
  ) : (
    <div className={`layout-container ${sidebarOpen ? 'sidebar-open' : ''}`}>
      {/* Mobile Top Bar Header */}
      <header className="mobile-header">
        <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)}>
          <Menu size={24} />
        </button>
        <span className="mobile-header-title">Outformer Admin</span>
      </header>

      {/* Sidebar overlay backdrop */}
      {sidebarOpen && (
        <div className="sidebar-overlay-backdrop" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar Wrapper with mobile conditional transition */}
      <div className={`sidebar-wrapper ${sidebarOpen ? 'open' : ''}`}>
        <button className="mobile-menu-close" onClick={() => setSidebarOpen(false)}>
          <X size={20} />
        </button>
        <Sidebar />
      </div>

      <main className="main-content">
        {children}
      </main>
    </div>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("font-sans", inter.variable)}>
      <body className={`${plusJakartaSans.variable} ${plusJakartaSans.className}`}>
        <ToastProvider>
          <AuthProvider>
            <LayoutContent>{children}</LayoutContent>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
