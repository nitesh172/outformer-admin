"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, limit, orderBy } from "firebase/firestore";
import { User, CreditCard, Mail, Calendar, Search, History } from "lucide-react";
import Link from "next/link";

interface UserProfile {
  id: string;
  email: string;
  displayName?: string;
  balances?: {
    whisper_seconds: number;
    snip_typing_credits: number;
  };
  subscription?: {
    plan: string;
    status: string;
  };
  metadata?: {
    createdAt: any;
  };
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    async function fetchUsers() {
      try {
        const q = query(collection(db, "users"), limit(100));
        const querySnapshot = await getDocs(q);
        const userList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as UserProfile[];
        setUsers(userList);
      } catch (error) {
        console.error("Error fetching users:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchUsers();
  }, []);

  const filteredUsers = users.filter(user => 
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div className="title-section">
        <h1>Users Management</h1>
        <p>View and manage your application users</p>
      </div>

      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={20} style={{ position: 'absolute', left: '16px', color: '#9ca3af' }} />
          <input 
            type="text" 
            placeholder="Search by name or email..." 
            style={{ paddingLeft: '48px' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Credits</th>
              <th>Subscription</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>
                  <td colSpan={4}><div className="skeleton" style={{ height: '24px', width: '100%' }}></div></td>
                </tr>
              ))
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '40px' }}>No users found</td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ 
                        width: '40px', 
                        height: '40px', 
                        borderRadius: '50%', 
                        background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold'
                      }}>
                        {(user.displayName || user.email || "?")[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: '600' }}>{user.displayName || "N/A"}</div>
                        <div style={{ color: '#9ca3af', fontSize: '12px' }}>{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: '13px' }}>
                      <div>Whisper: <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{(() => { const totalMin = Math.round((user.balances?.whisper_seconds || 0) / 60); const h = Math.floor(totalMin / 60); const m = totalMin % 60; return h > 0 ? `${h}h ${m}m` : `${m}m`; })()}</span></div>
                      <div>Snip: <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>{user.balances?.snip_typing_credits || 0}</span></div>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${user.subscription?.plan === 'pro' ? 'badge-success' : 'badge-warning'}`}>
                      {user.subscription?.plan?.toUpperCase() || "FREE"}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <Link 
                        href={`/ledger?userId=${user.id}`}
                        className="btn btn-outline" 
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                        title="View Ledger"
                      >
                        <History size={14} />
                        Ledger
                      </Link>
                      <Link 
                        href={`/payments?userId=${user.id}`}
                        className="btn btn-outline" 
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                        title="View Payment History"
                      >
                        <CreditCard size={14} />
                        Payments
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
