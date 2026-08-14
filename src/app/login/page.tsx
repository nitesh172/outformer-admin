"use client";

import { useState, useEffect } from "react";
import { auth } from "@/lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import { ShieldCheck, Mail, Lock, ArrowRight, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("error") === "unauthorized") {
        setError("Access denied. Only admins and team members are authorized.");
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);

      // Check claims immediately
      const tokenResult = await userCredential.user.getIdTokenResult(true);
      const claims = tokenResult.claims;
      let isAuthorized = !!claims.admin || !!claims.team_member;

      if (!isAuthorized && userCredential.user.email) {
        const { collection, query, where, getDocs } = await import("firebase/firestore");
        const { db } = await import("@/lib/firebase");
        const q = query(collection(db, "users"), where("email", "==", userCredential.user.email.toLowerCase()), where("role", "in", ["team", "admin"]));
        const snap = await getDocs(q);
        if (!snap.empty) {
          isAuthorized = true;
        }
      }

      if (!isAuthorized) {
        await auth.signOut();
        setError("Access denied. Only admins and team members are authorized.");
        setLoading(false);
        return;
      }

      router.push("/");
    } catch (err: any) {
      const errorCode = err?.code;
      let friendlyMsg = "Authentication failed. Please try again.";

      if (errorCode === "auth/invalid-credential" || errorCode === "auth/wrong-password" || errorCode === "auth/user-not-found") {
        friendlyMsg = "Invalid email or password.";
      } else if (errorCode === "auth/too-many-requests") {
        friendlyMsg = "Access temporarily disabled due to many failed login attempts. Please try again later or reset password.";
      } else if (errorCode === "auth/invalid-email") {
        friendlyMsg = "Invalid email address format.";
      } else if (errorCode === "auth/user-disabled") {
        friendlyMsg = "This user account has been disabled.";
      } else {
        console.error("Auth system error:", err);
        friendlyMsg = err.message || "Authentication failed";
      }
      setError(friendlyMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">
            <ShieldCheck size={32} />
          </div>
          <h1>Welcome Back</h1>
          <p>Enter your credentials to access the admin panel</p>
        </div>

        {error && (
          <div className="auth-error">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <label htmlFor="email">Email Address</label>
            <div className="auth-input-wrap">
              <Mail className="auth-input-icon" size={18} />
              <input 
                id="email"
                type="email" 
                placeholder="admin@example.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required 
              />
            </div>
          </div>

          <div className="auth-field">
            <label htmlFor="password">Password</label>
            <div className="auth-input-wrap">
              <Lock className="auth-input-icon" size={18} />
              <input 
                id="password"
                type="password" 
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required 
              />
            </div>
          </div>

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? <Loader2 className="auth-spinner" size={20} /> : (
              <>
                Sign In
                <ArrowRight size={20} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
