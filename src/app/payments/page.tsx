"use client";

import { useEffect, useState, Suspense, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useToast } from "@/lib/ToastContext";
import { db } from "@/lib/firebase";
import { CustomSelect } from "@/components/ui/CustomSelect";
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
  Clock, 
  RefreshCcw,
  ChevronLeft,
  ChevronRight,
  X,
  Eye,
  Info,
  DollarSign,
  CheckCircle,
  AlertTriangle
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

const PAGE_SIZE = 15;

export function PaymentsContent({ userIdProp, onBackProp }: { userIdProp?: string; onBackProp?: () => void }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialUserId = userIdProp || searchParams.get("userId") || "";
  const { showToast } = useToast();
  const [usersMap, setUsersMap] = useState<Record<string, UserProfile>>({});
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(initialUserId);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  
  // Search and view states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPayment, setSelectedPayment] = useState<PaymentEntry | null>(null);
  const [showDetailDrawer, setShowDetailDrawer] = useState(false);

  // Dropdown filter states
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [timeframeFilter, setTimeframeFilter] = useState<string>("ALL_TIME");
  const [gatewayFilter, setGatewayFilter] = useState<string>("ALL");

  // Pagination states
  const [page, setPage] = useState(1);

  // Fetch users to populate user cache
  useEffect(() => {
    async function loadUsersCache() {
      try {
        const q = query(collection(db, "users"), limit(500));
        const querySnapshot = await getDocs(q);
        const cache: Record<string, UserProfile> = {};
        querySnapshot.docs.forEach(doc => {
          cache[doc.id] = {
            id: doc.id,
            email: doc.data().email || "",
            displayName: doc.data().displayName || ""
          };
        });
        setUsersMap(cache);

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
      } catch (error: any) {
        console.warn("Error building users cache:", error?.message || error);
      }
    }
    loadUsersCache();
  }, [initialUserId]);

  // Fetch all payments (to allow true metrics computation and local pagination)
  const fetchPayments = async () => {
    setLoading(true);
    try {
      let q;
      if (selectedUserId) {
        q = query(
          collection(db, "payments"),
          where("userId", "==", selectedUserId),
          orderBy("createdAt", "desc")
        );
      } else {
        q = query(
          collection(db, "payments"),
          orderBy("createdAt", "desc")
        );
      }
      const querySnapshot = await getDocs(q);
      const entries = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PaymentEntry[];
      setPayments(entries);
      setPage(1); // Reset page on refresh
    } catch (error: any) {
      console.warn("Error fetching payments:", error?.message || error);
      showToast("Error loading payments: " + (error?.message || "Internal error"), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [selectedUserId]);

  const formatDate = (timestamp?: any) => {
    if (!timestamp) return "N/A";
    let date: Date;
    if (typeof timestamp.toDate === 'function') {
      date = timestamp.toDate();
    } else if (timestamp.seconds !== undefined) {
      date = new Date(timestamp.seconds * 1000);
    } else {
      date = new Date(timestamp);
    }
    if (isNaN(date.getTime())) return "N/A";
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  // Extract unique gateways from loaded payments for the gateway filter
  const uniqueGateways = useMemo(() => {
    const gateways = new Set<string>();
    payments.forEach(p => {
      if (p.gateway) gateways.add(p.gateway);
    });
    return Array.from(gateways);
  }, [payments]);

  // Apply all filters (Status, Timeframe, Gateway, Search Term)
  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      // 1. Status Filter
      if (statusFilter !== "ALL" && p.status?.toUpperCase() !== statusFilter) {
        return false;
      }

      // 2. Gateway Filter
      if (gatewayFilter !== "ALL" && p.gateway !== gatewayFilter) {
        return false;
      }

      // 3. Timeframe Filter
      if (timeframeFilter !== "ALL_TIME" && p.createdAt) {
        let date: Date;
        if (typeof p.createdAt.toDate === 'function') {
          date = p.createdAt.toDate();
        } else if (p.createdAt.seconds !== undefined) {
          date = new Date(p.createdAt.seconds * 1000);
        } else {
          date = new Date(p.createdAt as any);
        }
        if (isNaN(date.getTime())) return false;
        const now = new Date();
        if (timeframeFilter === "LAST_30_DAYS") {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(now.getDate() - 30);
          if (date < thirtyDaysAgo) return false;
        } else if (timeframeFilter === "THIS_MONTH") {
          if (date.getMonth() !== now.getMonth() || date.getFullYear() !== now.getFullYear()) {
            return false;
          }
        } else if (timeframeFilter === "THIS_YEAR") {
          if (date.getFullYear() !== now.getFullYear()) {
            return false;
          }
        }
      }

      // 4. Search Filter
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const user = usersMap[p.userId];
        const emailMatch = user?.email?.toLowerCase().includes(term);
        const nameMatch = user?.displayName?.toLowerCase().includes(term);
        const orderIdMatch = p.orderId?.toLowerCase().includes(term) || p.id.toLowerCase().includes(term);
        const statusMatch = p.status?.toLowerCase().includes(term);
        if (!emailMatch && !nameMatch && !orderIdMatch && !statusMatch) {
          return false;
        }
      }

      return true;
    });
  }, [payments, statusFilter, timeframeFilter, gatewayFilter, searchTerm, usersMap]);

  // Compute Metrics from currently FILTERED payments list
  const metrics = useMemo(() => {
    let totalRevenue = 0;
    let successCount = 0;
    let pendingCount = 0;
    let failedCount = 0;

    filteredPayments.forEach(p => {
      const status = p.status?.toUpperCase();
      const amt = Number(p.amount) || 0;
      
      if (status === "SUCCESS") {
        totalRevenue += amt;
        successCount++;
      } else if (status === "PENDING") {
        pendingCount++;
      } else if (status === "FAILED") {
        failedCount++;
      }
    });

    return {
      totalRevenue,
      successCount,
      pendingCount,
      failedCount,
      totalCount: filteredPayments.length
    };
  }, [filteredPayments]);

  // Local Pagination calculations
  const paginatedPayments = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredPayments.slice(start, start + PAGE_SIZE);
  }, [filteredPayments, page]);

  const totalPages = Math.max(1, Math.ceil(filteredPayments.length / PAGE_SIZE));

  const handleNextPage = () => {
    if (page < totalPages) {
      setPage(page + 1);
    }
  };

  const handlePrevPage = () => {
    if (page > 1) {
      setPage(page - 1);
    }
  };

  const handleClearUserFilter = () => {
    setSelectedUserId("");
    setSelectedUser(null);
    router.push("/payments");
  };

  const handleRowClick = (payment: PaymentEntry) => {
    setSelectedPayment(payment);
    setShowDetailDrawer(true);
  };

  return (
    <div style={{ width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px", padding: "0" }}>
      {/* Title */}
      <div className="title-section">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          {selectedUserId && (
            <button 
              onClick={() => { if (onBackProp) onBackProp(); else handleClearUserFilter(); }}
              className="btn-outline"
              style={{ padding: '6px', borderRadius: '6px', border: '1px solid var(--border)', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <ChevronLeft size={16} />
            </button>
          )}
          <h1>Payments Management</h1>
        </div>
        <p>View metrics and inspect Razorpay billing transactions</p>
      </div>

      {/* Metrics Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        {/* Metric 1: Total Revenue */}
        <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <div style={{ padding: '12px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '10px', color: '#10b981' }}>
            <DollarSign size={24} />
          </div>
          <div>
            <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0, fontWeight: '500' }}>Total Revenue</p>
            <h3 style={{ fontSize: '24px', fontWeight: '800', margin: '4px 0 0' }}>₹{metrics.totalRevenue.toLocaleString('en-IN')}</h3>
          </div>
        </div>

        {/* Metric 2: Successful Transactions */}
        <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <div style={{ padding: '12px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '10px', color: '#3b82f6' }}>
            <CheckCircle size={24} />
          </div>
          <div>
            <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0, fontWeight: '500' }}>Successful Txns</p>
            <h3 style={{ fontSize: '24px', fontWeight: '800', margin: '4px 0 0' }}>{metrics.successCount}</h3>
          </div>
        </div>

        {/* Metric 3: Pending/Failed Transactions */}
        <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '10px', color: '#ef4444' }}>
            <AlertTriangle size={24} />
          </div>
          <div>
            <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0, fontWeight: '500' }}>Failed / Pending</p>
            <h3 style={{ fontSize: '24px', fontWeight: '800', margin: '4px 0 0' }}>{metrics.failedCount} / {metrics.pendingCount}</h3>
          </div>
        </div>
      </div>

      {/* Filter and Selection Section */}
      <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* Search Field */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
          <Search size={20} style={{ position: 'absolute', left: '16px', color: '#9ca3af' }} />
          <input 
            type="text" 
            placeholder="Search payments by email, order ID, or status..." 
            style={{ paddingLeft: '48px', width: '100%', padding: '12px 16px 12px 48px', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--foreground)' }}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
          />
        </div>

        {/* Dropdown Filters Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', zIndex: 10 }}>
          {/* Status Dropdown */}
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 'bold', marginBottom: '6px' }}>Status</label>
            <CustomSelect
              value={statusFilter}
              onChange={(val) => {
                setStatusFilter(val);
                setPage(1);
              }}
              options={[
                { value: "ALL", label: "All Statuses" },
                { value: "SUCCESS", label: "SUCCESS" },
                { value: "PENDING", label: "PENDING" },
                { value: "FAILED", label: "FAILED" }
              ]}
            />
          </div>

          {/* Timeframe Dropdown */}
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 'bold', marginBottom: '6px' }}>Timeframe</label>
            <CustomSelect
              value={timeframeFilter}
              onChange={(val) => {
                setTimeframeFilter(val);
                setPage(1);
              }}
              options={[
                { value: "ALL_TIME", label: "All Time" },
                { value: "THIS_MONTH", label: "This Month" },
                { value: "LAST_30_DAYS", label: "Last 30 Days" },
                { value: "THIS_YEAR", label: "This Year" }
              ]}
            />
          </div>

          {/* Gateway Dropdown */}
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 'bold', marginBottom: '6px' }}>Gateway</label>
            <CustomSelect
              value={gatewayFilter}
              onChange={(val) => {
                setGatewayFilter(val);
                setPage(1);
              }}
              options={[
                { value: "ALL", label: "All Gateways" },
                ...uniqueGateways.map(g => ({ value: g, label: g.toUpperCase() }))
              ]}
            />
          </div>
        </div>

        {selectedUser && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            padding: '12px 16px', 
            backgroundColor: 'rgba(59, 130, 246, 0.08)', 
            borderRadius: '8px',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            marginTop: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
              <span style={{ fontWeight: 'bold' }}>Filtering User:</span>
              <span>{selectedUser.displayName || "Unknown"} ({selectedUser.email})</span>
            </div>
            <button 
              onClick={handleClearUserFilter}
              className="btn btn-outline" 
              style={{ padding: '4px 10px', fontSize: '12px' }}
            >
              Clear Filter
            </button>
          </div>
        )}
      </div>

      {/* Payments Table Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: '600' }}>
          Payment Records ({filteredPayments.length})
        </h3>
        <button 
          onClick={fetchPayments} 
          disabled={loading}
          className="btn btn-outline"
          style={{ padding: '8px 12px', fontSize: '13px' }}
        >
          <RefreshCcw size={16} className={loading ? 'spin' : ''} style={{ marginRight: '6px' }} />
          Refresh
        </button>
      </div>

      {/* Table view */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              {!selectedUserId && <th>User</th>}
              <th>Package Name</th>
              <th>Order ID</th>
              <th>Gateway</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Date & Time</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(6)].map((_, i) => (
                <tr key={i}>
                  <td colSpan={selectedUserId ? 7 : 8}>
                    <div className="skeleton" style={{ height: '24px', width: '100%' }}></div>
                  </td>
                </tr>
              ))
            ) : paginatedPayments.length === 0 ? (
              <tr>
                <td colSpan={selectedUserId ? 7 : 8} style={{ textAlign: 'center', padding: '40px' }}>
                  No payments match the active filters
                </td>
              </tr>
            ) : (
              paginatedPayments.map((entry) => {
                const user = usersMap[entry.userId];
                return (
                  <tr 
                    key={entry.id} 
                    onClick={() => handleRowClick(entry)}
                    style={{ cursor: 'pointer' }}
                    className="hover-row"
                  >
                    {!selectedUserId && (
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: '600', color: 'var(--foreground)' }}>
                            {user?.displayName || "Unknown User"}
                          </span>
                          <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                            {user?.email || entry.userId}
                          </span>
                        </div>
                      </td>
                    )}
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: '600', color: 'var(--foreground)' }}>
                          {entry.packInfo?.name || "Pro Membership Only"}
                        </span>
                        {entry.includeMembership && entry.packInfo?.name !== "Pro Membership Only" && (
                          <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 'bold' }}>
                            + Pro Membership
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <code style={{ fontSize: '12px', color: '#9ca3af' }}>{entry.orderId || entry.id}</code>
                    </td>
                    <td>
                      <span style={{ fontSize: '12px', fontWeight: '500', color: '#9ca3af' }}>{entry.gateway}</span>
                    </td>
                    <td style={{ fontWeight: '700', color: 'var(--foreground)' }}>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#9ca3af', fontSize: '13px' }}>
                        <Clock size={14} />
                        {formatDate(entry.createdAt)}
                      </div>
                    </td>
                    <td>
                      <button 
                        className="btn btn-outline" 
                        style={{ padding: '4px 8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRowClick(entry);
                        }}
                      >
                        <Eye size={12} /> View
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      {filteredPayments.length > PAGE_SIZE && (
        <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '12px',
            padding: '10px 0'
        }}>
            <div style={{ color: '#9ca3af', fontSize: '14px' }}>
                Page {page} of {totalPages}
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
                    disabled={page === totalPages || loading}
                    className="btn btn-outline"
                    style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                    Next
                    <ChevronRight size={16} />
                </button>
            </div>
        </div>
      )}

      {/* Transaction Details Modal/Drawer */}
      {showDetailDrawer && selectedPayment && (
        <div className="offcanvas-overlay" onClick={() => { setShowDetailDrawer(false); setSelectedPayment(null); }}>
          <div className="offcanvas-panel" style={{ width: '100%', maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Info size={24} color="var(--primary)" /> Payment Details
              </h2>
              <button 
                className="btn btn-outline" 
                style={{ padding: '8px' }} 
                onClick={() => { setShowDetailDrawer(false); setSelectedPayment(null); }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto', maxHeight: 'calc(100dvh - 120px)', paddingRight: '4px' }}>
              
              {/* Payment Summary Header */}
              <div style={{ 
                padding: '20px', 
                background: 'var(--bg-secondary)', 
                borderRadius: '12px', 
                border: '1px solid var(--border)',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '14px', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '4px' }}>Amount Paid</div>
                <div style={{ fontSize: '32px', fontWeight: '800', color: 'var(--foreground)' }}>
                  ₹{selectedPayment.amount}
                </div>
                <span className={`badge ${
                  selectedPayment.status === 'SUCCESS' 
                    ? 'badge-success' 
                    : selectedPayment.status === 'PENDING' 
                    ? 'badge-warning' 
                    : 'badge-danger'
                }`} style={{ marginTop: '12px', display: 'inline-block' }}>
                  {selectedPayment.status}
                </span>
              </div>

              {/* Transaction Key Metrics */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h4 style={{ margin: 0, fontSize: '15px', color: '#9ca3af' }}>Transaction Info</h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px' }}>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                    <span style={{ color: '#9ca3af' }}>Order ID:</span>
                    <span style={{ fontWeight: '600' }}>{selectedPayment.orderId || "N/A"}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                    <span style={{ color: '#9ca3af' }}>Payment ID:</span>
                    <span style={{ fontWeight: '600' }}>{selectedPayment.id}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                    <span style={{ color: '#9ca3af' }}>Gateway:</span>
                    <span style={{ fontWeight: '600', textTransform: 'uppercase' }}>{selectedPayment.gateway}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                    <span style={{ color: '#9ca3af' }}>Currency:</span>
                    <span style={{ fontWeight: '600', textTransform: 'uppercase' }}>{selectedPayment.currency}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                    <span style={{ color: '#9ca3af' }}>Date & Time:</span>
                    <span style={{ fontWeight: '600' }}>{formatDate(selectedPayment.createdAt)}</span>
                  </div>
                </div>
              </div>

              {/* Package & Membership Info */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h4 style={{ margin: 0, fontSize: '15px', color: '#9ca3af' }}>Items & Inclusions</h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                    <span style={{ color: '#9ca3af' }}>Package Name:</span>
                    <span style={{ fontWeight: '600' }}>{selectedPayment.packInfo?.name || "Pro Membership Only"}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                    <span style={{ color: '#9ca3af' }}>Package ID:</span>
                    <span style={{ fontWeight: '600', fontSize: '12px', color: '#9ca3af' }}>{selectedPayment.packInfo?.packageId || "N/A"}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                    <span style={{ color: '#9ca3af' }}>Pro Membership Included:</span>
                    <span style={{ fontWeight: '600', color: selectedPayment.includeMembership ? '#10b981' : '#9ca3af' }}>
                      {selectedPayment.includeMembership ? "YES" : "NO"}
                    </span>
                  </div>
                </div>
              </div>

              {/* User Information */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h4 style={{ margin: 0, fontSize: '15px', color: '#9ca3af' }}>User Details</h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                    <span style={{ color: '#9ca3af' }}>User ID:</span>
                    <span style={{ fontWeight: '600', fontSize: '12px', color: '#9ca3af' }}>{selectedPayment.userId}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                    <span style={{ color: '#9ca3af' }}>User Email:</span>
                    <span style={{ fontWeight: '600' }}>{usersMap[selectedPayment.userId]?.email || "Fetching..."}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                    <span style={{ color: '#9ca3af' }}>Display Name:</span>
                    <span style={{ fontWeight: '600' }}>{usersMap[selectedPayment.userId]?.displayName || "Unknown"}</span>
                  </div>
                </div>
              </div>

              {/* Coupon Information */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h4 style={{ margin: 0, fontSize: '15px', color: '#9ca3af' }}>Coupon Details</h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                    <span style={{ color: '#9ca3af' }}>Applied Coupon:</span>
                    <span style={{ 
                      fontWeight: '600', 
                      color: ((selectedPayment as any).couponCode || (selectedPayment as any).coupon || (selectedPayment as any).appliedCoupon) ? '#10b981' : '#9ca3af' 
                    }}>
                      {(() => {
                        const c = (selectedPayment as any).couponCode || (selectedPayment as any).coupon || (selectedPayment as any).appliedCoupon;
                        if (!c) return "None";
                        if (typeof c === "object") return c.code || "Yes";
                        return String(c);
                      })()}
                    </span>
                  </div>
                  {(() => {
                    const c = (selectedPayment as any).couponCode || (selectedPayment as any).coupon || (selectedPayment as any).appliedCoupon;
                    if (c && typeof c === "object" && 'discountAmount' in c) {
                      return (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginTop: '6px' }}>
                          <span style={{ color: '#9ca3af' }}>Discount:</span>
                          <span style={{ fontWeight: '600', color: '#10b981' }}>₹{c.discountAmount}</span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>

            </div>
          </div>
        </div>
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
