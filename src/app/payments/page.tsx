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
  getDoc
} from "firebase/firestore";
import { 
  Search, 
  CreditCard, 
  Clock, 
  User as UserIcon,
  RefreshCcw,
  ChevronLeft
} from "lucide-react";

interface PaymentEntry {
  id: string;
  orderId: string;
  userId: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | string;
  gateway: string;
  includeMembership: boolean;
  packInfo?: {
    name: string;
    packageId: string;
  };
  createdAt?: Timestamp;
}

interface UserProfile {
  id: string;
  email: string;
  displayName?: string;
}

function PaymentsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialUserId = searchParams.get("userId") || "";

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState(initialUserId);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  // Fetch users for search & dropdown
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
        console.error("Error fetching users for payments:", error);
      } finally {
        setUsersLoading(false);
      }
    }
    fetchUsers();
  }, [initialUserId]);

  // Fetch payments when selectedUserId changes
  useEffect(() => {
    if (!selectedUserId) {
      setPayments([]);
      return;
    }

    async function fetchPayments() {
      setLoading(true);
      try {
        const q = query(
          collection(db, "payments"),
          where("userId", "==", selectedUserId),
          orderBy("createdAt", "desc"),
          limit(50)
        );
        const querySnapshot = await getDocs(q);
        const entries = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as PaymentEntry[];
        setPayments(entries);
      } catch (error) {
        console.error("Error fetching payments history:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchPayments();
  }, [selectedUserId]);

  const refreshPayments = async () => {
    if (!selectedUserId) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, "payments"),
        where("userId", "==", selectedUserId),
        orderBy("createdAt", "desc"),
        limit(50)
      );
      const querySnapshot = await getDocs(q);
      const entries = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PaymentEntry[];
      setPayments(entries);
    } catch (error) {
      console.error("Error refreshing payments:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUserSelect = (user: UserProfile) => {
    setSelectedUserId(user.id);
    setSelectedUser(user);
    setShowUserDropdown(false);
    setSearchTerm("");
    router.push(`/payments?userId=${user.id}`);
  };

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (timestamp?: Timestamp) => {
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
              onClick={() => { setSelectedUserId(""); setSelectedUser(null); router.push('/payments'); }}
              className="btn-outline"
              style={{ padding: '4px', borderRadius: '4px', border: '1px solid var(--border)', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <ChevronLeft size={16} />
            </button>
          )}
          <h1>Payment History</h1>
        </div>
        <p>View Razorpay payment records and billing details for specific users</p>
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
              style={{ paddingLeft: '48px', width: '100%', padding: '12px 16px 12px 48px', background: '#141414', border: '1px solid var(--border)', borderRadius: '8px', color: 'white' }}
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
                fontWeight: 'bold'
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
          <CreditCard size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
          <h3>Select a user to view payment history</h3>
          <p>You can search for users by their email or display name above.</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600' }}>Payment Records</h3>
            <button 
              onClick={refreshPayments} 
              disabled={loading}
              className="btn btn-outline"
              style={{ padding: '8px 12px', fontSize: '13px' }}
            >
              <RefreshCcw size={16} className={loading ? 'spin' : ''} style={{ marginRight: '6px' }} />
              Refresh
            </button>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Package Name</th>
                  <th>Order ID</th>
                  <th>Gateway</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Date & Time</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i}>
                      <td colSpan={6}><div className="skeleton" style={{ height: '24px', width: '100%' }}></div></td>
                    </tr>
                  ))
                ) : payments.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '40px' }}>No payments found for this user</td>
                  </tr>
                ) : (
                  payments.map((entry) => (
                    <tr key={entry.id}>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: '600', color: 'white' }}>
                            {entry.packInfo?.name || "Pro Membership Only"}
                          </span>
                          {entry.includeMembership && entry.packInfo?.name !== "Pro Membership Only" && (
                            <span style={{ fontSize: '11px', color: '#10b981' }}>+ Pro Membership Included</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <code style={{ fontSize: '12px', color: '#9ca3af' }}>{entry.orderId || entry.id}</code>
                      </td>
                      <td>
                        <span style={{ fontSize: '12px', fontWeight: '500', color: '#9ca3af' }}>{entry.gateway}</span>
                      </td>
                      <td style={{ fontWeight: '700', color: 'white' }}>
                        ₹{entry.amount}
                      </td>
                      <td>
                        <span className={`badge ${
                          entry.status === 'SUCCESS' 
                            ? 'badge-success' 
                            : entry.status === 'PENDING' 
                            ? 'badge-warning' 
                            : 'badge-danger'
                        }`}>
                          {entry.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#9ca3af' }}>
                          <Clock size={14} />
                          {formatDate(entry.createdAt)}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default function PaymentsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PaymentsContent />
    </Suspense>
  );
}
