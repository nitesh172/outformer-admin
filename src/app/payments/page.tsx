"use client";

import { useEffect, useState, Suspense, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useToast } from "@/lib/ToastContext";
import { useAuth } from "@/lib/AuthContext";
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
  getDoc,
  addDoc,
  updateDoc,
  serverTimestamp
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
  AlertTriangle,
  Plus,
  PlusCircle,
  User as UserIcon,
  Check,
  FileText,
  CreditCard
} from "lucide-react";

interface PricingPackage {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  description?: string;
  fulfillment?: Array<{
    type: 'WHISPER' | 'SNIP_TYPING';
    quantity: number;
    label: string;
  }>;
  status?: 'ACTIVE' | 'INACTIVE';
}

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
  notes?: string;
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
  const { isAdmin } = useAuth();
  const [usersMap, setUsersMap] = useState<Record<string, UserProfile>>({});
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(initialUserId);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  // Search and view states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPayment, setSelectedPayment] = useState<PaymentEntry | null>(null);
  const [showDetailDrawer, setShowDetailDrawer] = useState(false);

  // Manual payment drawer states
  const [showAddPaymentDrawer, setShowAddPaymentDrawer] = useState(false);
  const [packages, setPackages] = useState<PricingPackage[]>([]);
  const [submittingManualPayment, setSubmittingManualPayment] = useState(false);

  // Form states for manual payment
  const [manualForm, setManualForm] = useState({
    userId: initialUserId || "",
    amount: "",
    orderId: "",
    gateway: "MANUAL",
    status: "SUCCESS",
    packageId: "NONE",
    packageName: "",
    includeMembership: false,
    applyFulfillment: true,
    notes: ""
  });

  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [manualUserIdInput, setManualUserIdInput] = useState("");
  const [useCustomUserId, setUseCustomUserId] = useState(false);

  // Dropdown filter states
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [timeframeFilter, setTimeframeFilter] = useState<string>("ALL_TIME");
  const [gatewayFilter, setGatewayFilter] = useState<string>("ALL");

  // Pagination states
  const [page, setPage] = useState(1);

  // Fetch active packages for manual payment association
  useEffect(() => {
    async function loadPackages() {
      try {
        const q = query(collection(db, "packages"), orderBy("price", "asc"));
        const querySnapshot = await getDocs(q);
        const list = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as PricingPackage[];
        setPackages(list.filter(p => p.status !== 'INACTIVE'));
      } catch (err) {
        console.warn("Error fetching packages for payment drawer:", err);
      }
    }
    loadPackages();
  }, []);

  const handleOpenAddPaymentDrawer = () => {
    const targetUid = selectedUserId || initialUserId || "";
    const existingUser = targetUid ? usersMap[targetUid] : null;

    setManualForm({
      userId: targetUid,
      amount: "",
      orderId: `MANUAL_${Date.now()}`,
      gateway: "MANUAL",
      status: "SUCCESS",
      packageId: "NONE",
      packageName: "",
      includeMembership: false,
      applyFulfillment: true,
      notes: ""
    });
    setUserSearchTerm(existingUser ? (existingUser.email || existingUser.displayName || targetUid) : "");
    setManualUserIdInput(targetUid);
    setUseCustomUserId(!targetUid || !existingUser);
    setShowUserDropdown(false);
    setShowAddPaymentDrawer(true);
  };

  const handlePackageChange = (pkgId: string) => {
    if (!pkgId || pkgId === "NONE") {
      setManualForm(prev => ({
        ...prev,
        packageId: "NONE",
        packageName: ""
      }));
      return;
    }

    const pkg = packages.find(p => p.id === pkgId);
    if (pkg) {
      const isMembershipPkg = pkg.name.toLowerCase().includes("membership") || pkg.name.toLowerCase().includes("pro");
      setManualForm(prev => ({
        ...prev,
        packageId: pkg.id,
        packageName: pkg.name,
        amount: String(pkg.price),
        includeMembership: isMembershipPkg ? true : prev.includeMembership
      }));
    }
  };

  const filteredUsersForPicker = useMemo(() => {
    const list = Object.values(usersMap);
    if (!userSearchTerm.trim()) return list.slice(0, 25);
    const q = userSearchTerm.toLowerCase().trim();
    return list.filter(u =>
      u.email.toLowerCase().includes(q) ||
      (u.displayName && u.displayName.toLowerCase().includes(q)) ||
      u.id.toLowerCase().includes(q)
    ).slice(0, 25);
  }, [usersMap, userSearchTerm]);

  const handleSaveManualPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      showToast("Access denied. Only administrators can record manual payments.", "error");
      return;
    }

    const targetUserId = (useCustomUserId ? manualUserIdInput : manualForm.userId).trim();
    if (!targetUserId) {
      showToast("Please select a user or enter a valid User ID.", "error");
      return;
    }

    const numAmount = Number(manualForm.amount);
    if (isNaN(numAmount) || numAmount < 0) {
      showToast("Please enter a valid payment amount.", "error");
      return;
    }

    const finalOrderId = manualForm.orderId.trim() || `MANUAL_${Date.now()}`;

    setSubmittingManualPayment(true);
    try {
      // 1. Record payment in Firestore payments collection
      const paymentData: any = {
        orderId: finalOrderId,
        userId: targetUserId,
        amount: numAmount,
        currency: "INR",
        status: manualForm.status,
        gateway: manualForm.gateway.toUpperCase(),
        includeMembership: Boolean(manualForm.includeMembership),
        createdAt: serverTimestamp()
      };

      if (manualForm.notes.trim()) {
        paymentData.notes = manualForm.notes.trim();
      }

      if (manualForm.packageId && manualForm.packageId !== "NONE") {
        paymentData.packInfo = {
          packageId: manualForm.packageId,
          name: manualForm.packageName || "Package"
        };
      } else if (manualForm.packageName.trim()) {
        paymentData.packInfo = {
          packageId: "MANUAL",
          name: manualForm.packageName.trim()
        };
      }

      await addDoc(collection(db, "payments"), paymentData);

      // 2. Fulfill user balances & ledger if requested and status is SUCCESS
      if (manualForm.applyFulfillment && manualForm.status === "SUCCESS") {
        try {
          const userDocRef = doc(db, "users", targetUserId);
          const userSnap = await getDoc(userDocRef);

          if (userSnap.exists()) {
            const userData = userSnap.data();
            const balances = userData.balances || { whisper_seconds: 0, snip_typing_credits: 0 };
            let newWhisper = balances.whisper_seconds || 0;
            let newSnip = balances.snip_typing_credits || 0;
            let balancesChanged = false;

            const selectedPkg = packages.find(p => p.id === manualForm.packageId);

            if (selectedPkg && selectedPkg.fulfillment && selectedPkg.fulfillment.length > 0) {
              for (const item of selectedPkg.fulfillment) {
                if (item.type === "WHISPER" && item.quantity > 0) {
                  const addSec = Number(item.quantity);
                  newWhisper += addSec;
                  balancesChanged = true;

                  await addDoc(collection(db, "ledger"), {
                    userId: targetUserId,
                    type: "INFLOW",
                    category: "WHISPER",
                    amount: addSec,
                    balanceAfter: newWhisper,
                    referenceId: finalOrderId,
                    timestamp: Timestamp.now()
                  });
                } else if (item.type === "SNIP_TYPING" && item.quantity > 0) {
                  const addCredits = Number(item.quantity);
                  newSnip += addCredits;
                  balancesChanged = true;

                  await addDoc(collection(db, "ledger"), {
                    userId: targetUserId,
                    type: "INFLOW",
                    category: "SNIP_TYPING",
                    amount: addCredits,
                    balanceAfter: newSnip,
                    referenceId: finalOrderId,
                    timestamp: Timestamp.now()
                  });
                }
              }
            }

            const updates: any = {};
            if (balancesChanged) {
              updates.balances = {
                whisper_seconds: newWhisper,
                snip_typing_credits: newSnip
              };
            }

            if (manualForm.includeMembership) {
              updates.subscription = {
                plan: "pro",
                status: "active"
              };
            }

            if (Object.keys(updates).length > 0) {
              await updateDoc(userDocRef, updates);
            }
          }
        } catch (fulfillmentErr: any) {
          console.warn("Payment saved, but balance fulfillment encountered an issue:", fulfillmentErr);
          showToast("Payment recorded, but user balances could not be updated: " + (fulfillmentErr?.message || "Unknown error"), "error");
        }
      }

      showToast("Manual payment recorded successfully!", "success");
      setShowAddPaymentDrawer(false);
      fetchPayments();
    } catch (err: any) {
      console.error("Error creating manual payment:", err);
      showToast("Failed to record manual payment: " + (err?.message || "Unknown error"), "error");
    } finally {
      setSubmittingManualPayment(false);
    }
  };

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
      <div className="title-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
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
          <p>View metrics and inspect billing transactions</p>
        </div>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isAdmin && (
            <button
              onClick={handleOpenAddPaymentDrawer}
              className="btn btn-primary"
              style={{ padding: '8px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={16} />
              Add Payment
            </button>
          )}
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

              {/* Notes / Remarks Information */}
              {Boolean((selectedPayment as any).notes) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h4 style={{ margin: 0, fontSize: '15px', color: '#9ca3af' }}>Notes & Remarks</h4>

                  <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px', fontSize: '14px', whiteSpace: 'pre-wrap', color: 'var(--foreground)' }}>
                    {(selectedPayment as any).notes}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* Add Manual Payment Offcanvas Drawer (Admin Only) */}
      {showAddPaymentDrawer && isAdmin && (
        <div className="offcanvas-overlay" onClick={() => setShowAddPaymentDrawer(false)}>
          <div className="offcanvas-panel" style={{ width: '100%', maxWidth: '540px' }} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div>
                <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '20px' }}>
                  <PlusCircle size={22} color="var(--primary)" /> Add Manual Payment
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#9ca3af' }}>
                  Record an offline or manual transaction for a user
                </p>
              </div>
              <button
                type="button"
                className="btn btn-outline"
                style={{ padding: '8px' }}
                onClick={() => setShowAddPaymentDrawer(false)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveManualPayment} style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1, overflowY: 'auto', paddingRight: '4px' }}>

              {/* User Selection Section */}
              <div className="input-group" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--foreground)', margin: 0 }}>
                    Target User <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setUseCustomUserId(!useCustomUserId);
                      setShowUserDropdown(false);
                    }}
                    style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '12px', cursor: 'pointer', padding: 0 }}
                  >
                    {useCustomUserId ? "Search from users list" : "Enter raw User ID"}
                  </button>
                </div>

                {!useCustomUserId ? (
                  <div style={{ position: 'relative' }}>
                    {manualForm.userId && usersMap[manualForm.userId] ? (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        background: 'rgba(124, 58, 237, 0.08)',
                        border: '1px solid var(--primary)',
                        borderRadius: '0'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <UserIcon size={16} color="var(--primary)" />
                          <div>
                            <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--foreground)' }}>
                              {usersMap[manualForm.userId].displayName || "User"}
                            </div>
                            <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                              {usersMap[manualForm.userId].email}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-outline"
                          style={{ padding: '4px 8px', fontSize: '11px' }}
                          onClick={() => {
                            setManualForm(prev => ({ ...prev, userId: "" }));
                            setUserSearchTerm("");
                            setShowUserDropdown(true);
                          }}
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      <div style={{ position: 'relative' }}>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                          <Search size={16} style={{ position: 'absolute', left: '12px', color: '#9ca3af' }} />
                          <input
                            type="text"
                            placeholder="Type to search user by email or name..."
                            value={userSearchTerm}
                            onChange={(e) => {
                              setUserSearchTerm(e.target.value);
                              setShowUserDropdown(true);
                            }}
                            onFocus={() => setShowUserDropdown(true)}
                            style={{ paddingLeft: '38px', width: '100%' }}
                          />
                        </div>

                        {showUserDropdown && (
                          <div style={{
                            position: 'absolute',
                            top: 'calc(100% + 4px)',
                            left: 0,
                            right: 0,
                            maxHeight: '220px',
                            overflowY: 'auto',
                            background: 'var(--card-bg)',
                            border: '1px solid var(--border)',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                            zIndex: 100,
                            padding: '4px 0'
                          }}>
                            {filteredUsersForPicker.length === 0 ? (
                              <div style={{ padding: '12px', textAlign: 'center', fontSize: '13px', color: '#9ca3af' }}>
                                No matching users found.
                              </div>
                            ) : (
                              filteredUsersForPicker.map((u) => (
                                <div
                                  key={u.id}
                                  onClick={() => {
                                    setManualForm(prev => ({ ...prev, userId: u.id }));
                                    setUserSearchTerm(u.email);
                                    setShowUserDropdown(false);
                                  }}
                                  style={{
                                    padding: '8px 14px',
                                    cursor: 'pointer',
                                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '2px'
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-secondary)')}
                                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                >
                                  <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--foreground)' }}>
                                    {u.displayName || "Unknown Name"}
                                  </div>
                                  <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                                    {u.email}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <input
                      type="text"
                      placeholder="Paste target Firebase Auth User ID (UID)..."
                      value={manualUserIdInput}
                      onChange={(e) => {
                        setManualUserIdInput(e.target.value);
                        setManualForm(prev => ({ ...prev, userId: e.target.value }));
                      }}
                      required
                    />
                    <span style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px', display: 'block' }}>
                      Enter raw Firebase UID if user is not in the loaded list.
                    </span>
                  </div>
                )}
              </div>

              {/* Package Association */}
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--foreground)' }}>
                  Pricing Package (Optional)
                </label>
                <CustomSelect
                  value={manualForm.packageId}
                  onChange={handlePackageChange}
                  options={[
                    { value: "NONE", label: "None / Custom Manual Amount" },
                    ...packages.map(p => ({
                      value: p.id,
                      label: `${p.name} — ₹${p.price}`
                    }))
                  ]}
                />
                {(() => {
                  const selPkg = packages.find(p => p.id === manualForm.packageId);
                  if (selPkg && selPkg.fulfillment && selPkg.fulfillment.length > 0) {
                    return (
                      <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {selPkg.fulfillment.map((f, idx) => (
                          <span key={idx} className="badge badge-success" style={{ fontSize: '11px' }}>
                            {f.label || `${f.quantity} ${f.type}`}
                          </span>
                        ))}
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Amount & Currency Grid */}
              <div className="form-grid">
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--foreground)' }}>
                    Amount (₹ INR) <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="e.g. 499"
                    required
                    value={manualForm.amount}
                    onChange={(e) => setManualForm({ ...manualForm, amount: e.target.value })}
                  />
                </div>

                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--foreground)' }}>
                    Payment Status
                  </label>
                  <CustomSelect
                    value={manualForm.status}
                    onChange={(val) => setManualForm({ ...manualForm, status: val })}
                    options={[
                      { value: "SUCCESS", label: "SUCCESS" },
                      { value: "PENDING", label: "PENDING" },
                      { value: "FAILED", label: "FAILED" }
                    ]}
                  />
                </div>
              </div>

              {/* Gateway & Order ID Grid */}
              <div className="form-grid">
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--foreground)' }}>
                    Payment Gateway / Mode
                  </label>
                  <CustomSelect
                    value={manualForm.gateway}
                    onChange={(val) => setManualForm({ ...manualForm, gateway: val })}
                    options={[
                      { value: "MANUAL", label: "Manual (Offline / Direct)" },
                      { value: "UPI", label: "UPI (GPay / PhonePe / Paytm)" },
                      { value: "BANK_TRANSFER", label: "Bank Transfer (NEFT/IMPS)" },
                      { value: "CASH", label: "Cash" },
                      { value: "CHEQUE", label: "Cheque / DD" },
                      { value: "RAZORPAY", label: "Razorpay (Manual Log)" },
                      { value: "OTHER", label: "Other" }
                    ]}
                  />
                </div>

                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--foreground)' }}>
                    Order / Reference ID <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. MANUAL_12345 or UTR..."
                    value={manualForm.orderId}
                    onChange={(e) => setManualForm({ ...manualForm, orderId: e.target.value })}
                  />
                </div>
              </div>

              {/* Membership Toggle */}
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '12px 14px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)'
              }}>
                <input
                  type="checkbox"
                  id="includeMembership"
                  checked={manualForm.includeMembership}
                  onChange={(e) => setManualForm({ ...manualForm, includeMembership: e.target.checked })}
                  style={{ width: '18px', height: '18px', marginTop: '2px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                />
                <label htmlFor="includeMembership" style={{ margin: 0, cursor: 'pointer' }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--foreground)' }}>
                    Include Pro Membership
                  </div>
                  <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                    Marks transaction as including membership and activates Pro subscription on user account.
                  </div>
                </label>
              </div>

              {/* Fulfill User Account Toggle */}
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '12px 14px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)'
              }}>
                <input
                  type="checkbox"
                  id="applyFulfillment"
                  disabled={manualForm.status !== "SUCCESS"}
                  checked={manualForm.applyFulfillment && manualForm.status === "SUCCESS"}
                  onChange={(e) => setManualForm({ ...manualForm, applyFulfillment: e.target.checked })}
                  style={{ width: '18px', height: '18px', marginTop: '2px', accentColor: 'var(--primary)', cursor: manualForm.status === "SUCCESS" ? 'pointer' : 'not-allowed' }}
                />
                <label htmlFor="applyFulfillment" style={{ margin: 0, cursor: manualForm.status === "SUCCESS" ? 'pointer' : 'not-allowed' }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--foreground)' }}>
                    Apply Package Fulfillment to User
                  </div>
                  <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                    Automatically credits Whisper minutes and Snip typing credits to the user profile and records INFLOW in the ledger.
                  </div>
                </label>
              </div>

              {/* Notes / Remarks */}
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--foreground)' }}>
                  Notes / Internal Remarks (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Received via NEFT UTR #48291048, client authorized manually."
                  value={manualForm.notes}
                  onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowAddPaymentDrawer(false)}
                  disabled={submittingManualPayment}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submittingManualPayment}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  {submittingManualPayment ? (
                    <>
                      <RefreshCcw size={16} className="spin" /> Recording Payment...
                    </>
                  ) : (
                    <>
                      <Check size={16} /> Record Payment
                    </>
                  )}
                </button>
              </div>

            </form>
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
