"use client";

import { useEffect, useState, useRef } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, limit, orderBy, startAfter, startAt, endAt } from "firebase/firestore";
import { User, CreditCard, Mail, Calendar, Search, History, ChevronLeft, ChevronRight } from "lucide-react";
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

const PAGE_SIZE = 10;

export default function UsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [pageStartDocs, setPageStartDocs] = useState<any[]>([null]);
  const [hasMore, setHasMore] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch users function
  async function fetchUsers(pageNumber: number, startDoc: any, searchStr: string) {
    setLoading(true);
    try {
      let q;
      const baseQuery = collection(db, "users");
      
      if (searchStr.trim()) {
        const queryTerm = searchStr.trim();
        q = query(
          baseQuery,
          orderBy("email", "asc"),
          startAt(queryTerm),
          endAt(queryTerm + "\uf8ff"),
          limit(PAGE_SIZE + 1)
        );
        if (startDoc) {
          q = query(
            baseQuery,
            orderBy("email", "asc"),
            startAt(queryTerm),
            endAt(queryTerm + "\uf8ff"),
            startAfter(startDoc),
            limit(PAGE_SIZE + 1)
          );
        }
      } else {
        q = query(
          baseQuery,
          orderBy("email", "asc"),
          limit(PAGE_SIZE + 1)
        );
        if (startDoc) {
          q = query(
            baseQuery,
            orderBy("email", "asc"),
            startAfter(startDoc),
            limit(PAGE_SIZE + 1)
          );
        }
      }

      const querySnapshot = await getDocs(q);
      const docs = querySnapshot.docs;
      
      const hasMoreData = docs.length > PAGE_SIZE;
      setHasMore(hasMoreData);
      
      const pageDocs = hasMoreData ? docs.slice(0, PAGE_SIZE) : docs;
      const userList = pageDocs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as UserProfile[];
      
      setUsers(userList);
      setPage(pageNumber);
      
      if (hasMoreData) {
        const lastDoc = pageDocs[pageDocs.length - 1];
        setPageStartDocs(prev => {
          const nextDocs = [...prev];
          nextDocs[pageNumber] = lastDoc;
          return nextDocs;
        });
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  }

  // Initial load and search changes
  useEffect(() => {
    // Reset to page 1 on search change
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setPageStartDocs([null]);
      fetchUsers(1, null, searchTerm);
    }, 400);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm]);

  const handleNextPage = () => {
    if (hasMore && !loading) {
      const nextStartDoc = pageStartDocs[page];
      fetchUsers(page + 1, nextStartDoc, searchTerm);
    }
  };

  const handlePrevPage = () => {
    if (page > 1 && !loading) {
      const prevStartDoc = pageStartDocs[page - 2];
      fetchUsers(page - 1, prevStartDoc, searchTerm);
    }
  };

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
            placeholder="Search by email..." 
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
              [...Array(PAGE_SIZE)].map((_, i) => (
                <tr key={i}>
                  <td colSpan={4}><div className="skeleton" style={{ height: '24px', width: '100%' }}></div></td>
                </tr>
              ))
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '40px' }}>No users found</td>
              </tr>
            ) : (
              users.map((user) => (
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
                        fontWeight: 'bold',
                        color: 'white'
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

      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginTop: '20px',
        padding: '10px 0' 
      }}>
        <div style={{ color: '#9ca3af', fontSize: '14px' }}>
          Page {page}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={handlePrevPage} 
            disabled={page === 1 || loading}
            className="btn btn-outline"
            style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <ChevronLeft size={16} />
            Previous
          </button>
          <button 
            onClick={handleNextPage} 
            disabled={!hasMore || loading}
            className="btn btn-outline"
            style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            Next
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

