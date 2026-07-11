"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut, User as FirebaseUser } from "firebase/auth";
import { auth } from "./firebase";
import { usePathname, useRouter } from "next/navigation";
import { useToast } from "./ToastContext";

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  isAdmin: boolean;
  isTeamMember: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAdmin: false,
  isTeamMember: false,
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isTeamMember, setIsTeamMember] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { showToast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        try {
          // Force refresh token to get the latest custom claims
          const tokenResult = await u.getIdTokenResult(true);
          const adminClaim = !!tokenResult.claims.admin;
          const teamMemberClaim = !!tokenResult.claims.team_member;

          if (!adminClaim && !teamMemberClaim) {
            console.warn("User does not have required custom claims. Signing out.");
            await signOut(auth);
            setUser(null);
            setIsAdmin(false);
            setIsTeamMember(false);
            showToast("Unauthorized. You must have admin or team member custom claims to login.", "error");
            if (pathname !== "/login") {
              router.push("/login?error=unauthorized");
            }
          } else {
            setUser(u);
            setIsAdmin(adminClaim);
            setIsTeamMember(teamMemberClaim);

            // Redirect if trying to access admin-only routes
            if ((pathname === "/coupons" || pathname === "/packages") && !adminClaim) {
              console.warn(`Redirecting team member from admin route: ${pathname}`);
              showToast("Access denied. Coupons and packages routes are only accessible by administrators.", "error");
              router.push("/");
            }

            // Redirect from login to dashboard if already logged in and authorized
            if (pathname === "/login") {
              router.push("/");
            }
          }
        } catch (error) {
          console.error("Error fetching custom claims:", error);
          await signOut(auth);
          setUser(null);
          setIsAdmin(false);
          setIsTeamMember(false);
          showToast("Session authentication error. Please sign in again.", "error");
          if (pathname !== "/login") {
            router.push("/login");
          }
        }
      } else {
        setUser(null);
        setIsAdmin(false);
        setIsTeamMember(false);
        if (pathname !== "/login") {
          router.push("/login");
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [pathname, router, showToast]);

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, isTeamMember, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
