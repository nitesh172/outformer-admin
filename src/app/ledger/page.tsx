"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  Timestamp,
  doc,
  getDoc,
  startAfter
} from "firebase/firestore";
import { 
  Search, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Clock, 
  User as UserIcon,
  RefreshCcw,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

interface LedgerEntry {
  id: string;
  userId: string;
  type: 'INFLOW' | 'OUTFLOW';
  category: 'WHISPER' | 'SNIP_TYPING';
  amount: number;
  balanceAfter: number;
  referenceId: string;
  timestamp: Timestamp;
}

interface UserProfile {
  id: string;
  email: string;
  displayName?: string;
}

const PAGE_SIZE = 10;

function LedgerContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialUserId = searchParams.get("userId") || "";

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState(initialUserId);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  // Pagination states
  const [page, setPage] = useState(1);
  const [pageStartDocs, setPageStartDocs] = useState<any[]>([null]);
  const [hasMore, setHasMore] = useState(false);

  // Fetch users for the dropdown/search
  useEffect(() => {
    async function fetchUsers() {
      try {
        const q = query(collection(db, "users"), limit(50));
        const querySnapshot = await getDocs(q);
        const userList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          email: doc.data().email || "",
          displayName: doc.data().displayName || ""
        }));
        setUsers(userList);
        
        // If we have an initialUserId, find that user
        if (initialUserId) {
          const userDoc = await getDoc(doc(db, "users", initialUserId));
          if (userDoc.exists()) {
            setSelectedUser({
              id: userDoc.id,
              email: userDoc.data().email || "",
              displayName: userDoc.data().displayName || ""
            });
          }
        }
      } catch (error) {
        console.error("Error fetching users:", error);
      } finally {
        setUsersLoading(false);
      }
    }
    fetchUsers();
  }, [initialUserId]);

  async function fetchLedger(pageNumber: number, startDoc: any) {
    if (!selectedUserId) return;
    setLoading(true);
    try {
      let q = query(
        collection(db, "ledger"),
        where("userId", "==", selectedUserId),
        orderBy("timestamp", "desc"),
        limit(PAGE_SIZE + 1)
      );
      if (startDoc) {
        q = query(
          collection(db, "ledger"),
          where("userId", "==", selectedUserId),
          orderBy("timestamp", "desc"),
          startAfter(startDoc),
          limit(PAGE_SIZE + 1)
        );
      }
      const querySnapshot = await getDocs(q);
      const docs = querySnapshot.docs;
      
      const hasMoreData = docs.length > PAGE_SIZE;
      setHasMore(hasMoreData);
      
      const pageDocs = hasMoreData ? docs.slice(0, PAGE_SIZE) : docs;
      const entries = pageDocs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as LedgerEntry[];
      
      setLedgerEntries(entries);
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
      console.error("Error fetching ledger:", error);
    } finally {
      setLoading(false);
    }
  }

  // Fetch ledger entries when selectedUserId changes
  useEffect(() => {
    if (!selectedUserId) {
      setLedgerEntries([]);
      setPage(1);
      setPageStartDocs([null]);
      setHasMore(false);
      return;
    }

    setPage(1);
    setPageStartDocs([null]);
    fetchLedger(1, null);
  }, [selectedUserId]);

  const refreshLedger = async () => {
    if (!selectedUserId) return;
    setPage(1);
    setPageStartDocs([null]);
    await fetchLedger(1, null);
  };

  const handleNextPage = () => {
    if (hasMore && !loading) {
      const nextStartDoc = pageStartDocs[page];
      fetchLedger(page + 1, nextStartDoc);
    }
  };

  const handlePrevPage = () => {
    if (page > 1 && !loading) {
      const prevStartDoc = pageStartDocs[page - 2];
      fetchLedger(page - 1, prevStartDoc);
    }
  };

  const handleUserSelect = (user: UserProfile) => {
    setSelectedUserId(user.id);
    setSelectedUser(user);
    setShowUserDropdown(false);
    setSearchTerm("");
    // Update URL without full reload
    router.push(`/ledger?userId=${user.id}`);
  };

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (timestamp: Timestamp) => {
    if (!timestamp) return "N/A";
    const date = timestamp.toDate();
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <div>
      <div className="title-section">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          {selectedUserId && (
            <button 
              onClick={() => { setSelectedUserId(""); setSelectedUser(null); router.push('/ledger'); }}
              className="btn-outline"
              style={{ padding: '4px', borderRadius: '4px' }}
            >
              <ChevronLeft size={16} />
            </button>
          )}
          <h1>User Ledger</h1>
        </div>
        <p>Track credit inflows and outflows for specific users</p>
      </div>

      <div className="card" style={{ position: 'relative', zIndex: 50 }}>
        <label style={{ display: 'block', marginBottom: '12px', fontSize: '14px', color: '#9ca3af' }}>
          Search and Select User
        </label>
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={20} style={{ position: 'absolute', left: '16px', color: '#9ca3af' }} />
            <input 
              type="text" 
              placeholder="Search by name or email..." 
              style={{ paddingLeft: '48px' }}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowUserDropdown(true);
              }}
              onFocus={() => setShowUserDropdown(true)}
            />
          </div>
          
          {showUserDropdown && (searchTerm || users.length > 0) && (
            <div style={{ 
              position: 'absolute', 
              top: '100%', 
              left: 0, 
              right: 0, 
              backgroundColor: 'var(--card-bg)', 
              border: '1px solid var(--border)',
              borderRadius: '8px',
              marginTop: '4px',
              maxHeight: '300px',
              overflowY: 'auto',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)'
            }}>
              {filteredUsers.length > 0 ? (
                filteredUsers.map(u => (
                  <div 
                    key={u.id}
                    onClick={() => handleUserSelect(u)}
                    style={{ 
                      padding: '12px 16px', 
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--border)',
                      display: 'flex',
                      flexDirection: 'column'
                    }}
                    className="nav-item"
                  >
                    <span style={{ fontWeight: '600', color: 'white' }}>{u.displayName || "Unknown User"}</span>
                    <span style={{ fontSize: '12px', color: '#9ca3af' }}>{u.email}</span>
                  </div>
                ))
              ) : (
                <div style={{ padding: '16px', textAlign: 'center', color: '#9ca3af' }}>
                  No users found
                </div>
              )}
            </div>
          )}
        </div>

        {selectedUser && (
          <div style={{ 
            marginTop: '20px', 
            padding: '16px', 
            backgroundColor: 'rgba(59, 130, 246, 0.05)', 
            borderRadius: '8px',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
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
                {(selectedUser.displayName || selectedUser.email || "?")[0].toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: '600', color: 'white' }}>{selectedUser.displayName}</div>
                <div style={{ fontSize: '12px', color: '#9ca3af' }}>{selectedUser.email}</div>
              </div>
            </div>
            <div style={{ fontSize: '11px', color: '#6b7280' }}>
              ID: {selectedUser.id}
            </div>
          </div>
        )}
      </div>

      {!selectedUserId ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '80px 20px', 
          color: '#9ca3af',
          backgroundColor: 'rgba(255, 255, 255, 0.02)',
          borderRadius: '12px',
          border: '1px dashed var(--border)'
        }}>
          <UserIcon size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
          <h3>Select a user to view their ledger</h3>
          <p>You can search for users by their email or display name above.</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600' }}>Transaction History</h3>
            <button 
              onClick={refreshLedger} 
              disabled={loading}
              className="btn btn-outline"
              style={{ padding: '8px 12px', fontSize: '13px' }}
            >
              <RefreshCcw size={16} className={loading ? 'spin' : ''} />
              Refresh
            </button>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Balance After</th>
                  <th>Reference</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(PAGE_SIZE)].map((_, i) => (
                    <tr key={i}>
                      <td colSpan={6}><div className="skeleton" style={{ height: '24px', width: '100%' }}></div></td>
                    </tr>
                  ))
                ) : ledgerEntries.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '40px' }}>No ledger entries found for this user</td>
                  </tr>
                ) : (
                  ledgerEntries.map((entry) => (
                    <tr key={entry.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {entry.type === 'INFLOW' ? (
                            <div style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <ArrowDownLeft size={16} />
                              <span className="badge badge-success">INFLOW</span>
                            </div>
                          ) : (
                            <div style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <ArrowUpRight size={16} />
                              <span className="badge badge-danger">OUTFLOW</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontWeight: '500' }}>{entry.category}</span>
                      </td>
                      <td style={{ fontWeight: '700', color: entry.type === 'INFLOW' ? '#10b981' : '#ef4444' }}>
                        {entry.type === 'INFLOW' ? '+' : '-'}{entry.amount}
                        <span style={{ fontSize: '10px', marginLeft: '4px', opacity: 0.8 }}>
                          {entry.category === 'WHISPER' ? 'sec' : 'credits'}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: '600' }}>
                          {entry.balanceAfter}
                          <span style={{ fontSize: '10px', marginLeft: '4px', opacity: 0.6 }}>
                            {entry.category === 'WHISPER' ? 'sec' : 'credits'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <code style={{ fontSize: '11px', color: '#9ca3af' }}>{entry.referenceId || "N/A"}</code>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#9ca3af' }}>
                          <Clock size={14} />
                          {formatDate(entry.timestamp)}
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
        </>
      )}
    </div>
  );
}

export default function LedgerPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LedgerContent />
    </Suspense>
  );
}

