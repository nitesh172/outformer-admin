"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, limit, orderBy, startAfter, startAt, endAt, doc, updateDoc, where, addDoc, Timestamp, getCountFromServer } from "firebase/firestore";
import { CreditCard, Mail, Search, History, ChevronLeft, ChevronRight, Pencil, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { LedgerContent } from "../ledger/page";
import { PaymentsContent } from "../payments/page";
import { useToast } from "@/lib/ToastContext";
import { useAuth } from "@/lib/AuthContext";

interface UserProfile {
    id: string;
    email: string;
    displayName?: string;
    role?: string;
    disabled?: boolean;
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

function UsersPageContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const ledgerUserId = searchParams.get("ledgerUserId");
    const paymentsUserId = searchParams.get("paymentsUserId");

    const showLedger = !!ledgerUserId;
    const showPayments = !!paymentsUserId;
    const showList = !showLedger && !showPayments;

    const { showToast } = useToast();
    const { isAdmin, user } = useAuth();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
    const [page, setPage] = useState(1);
    const [pageStartDocs, setPageStartDocs] = useState<any[]>([null]);
    const [hasMore, setHasMore] = useState(false);
    const [totalCount, setTotalCount] = useState(0);
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const [showDrawer, setShowDrawer] = useState(false);
    const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        displayName: "",
        whisperMinutes: 0,
        snipCredits: 0,
        plan: "free",
        subscriptionStatus: "active",
        role: "user",
        disabled: false
    });

    // Fetch users function
    async function fetchUsers(pageNumber: number, startDoc: any, searchStr: string, activeFilter: string) {
        setLoading(true);
        try {
            let q;
            const baseQuery = collection(db, "users");

            if (searchStr.trim()) {
                const queryTerm = searchStr.trim();
                const qConstraints: any[] = [
                    orderBy("email", "asc"),
                    startAt(queryTerm),
                    endAt(queryTerm + "\uf8ff"),
                    limit(PAGE_SIZE + 1)
                ];
                if (startDoc) {
                    qConstraints.push(startAfter(startDoc));
                }
                q = query(baseQuery, ...qConstraints);
            } else {
                const qConstraints: any[] = [limit(PAGE_SIZE + 1)];
                if (activeFilter === "inactive") {
                    qConstraints.unshift(where("disabled", "==", true));
                } else if (activeFilter === "active") {
                    qConstraints.unshift(where("disabled", "==", false));
                } else {
                    qConstraints.push(orderBy("email", "asc"));
                }
                if (startDoc) {
                    qConstraints.push(startAfter(startDoc));
                }
                q = query(baseQuery, ...qConstraints);
            }

            const querySnapshot = await getDocs(q);
            const docs = querySnapshot.docs;

            const hasMoreData = docs.length > PAGE_SIZE;
            setHasMore(hasMoreData);

            const pageDocs = hasMoreData ? docs.slice(0, PAGE_SIZE) : docs;
            let userList = pageDocs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as UserProfile[];

            // Local post-filtering for search + status filter combination
            if (searchStr.trim()) {
                userList = userList.filter(user => {
                    if (activeFilter === "active") return !user.disabled;
                    if (activeFilter === "inactive") return !!user.disabled;
                    return true;
                });
            }

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

            // Fetch total count only on the first page load to save reads
            if (pageNumber === 1) {
                let countQ;
                if (searchStr.trim()) {
                    const queryTerm = searchStr.trim();
                    countQ = query(
                        baseQuery,
                        orderBy("email", "asc"),
                        startAt(queryTerm),
                        endAt(queryTerm + "\uf8ff")
                    );
                } else {
                    const countConstraints: any[] = [];
                    if (activeFilter === "inactive") {
                        countConstraints.push(where("disabled", "==", true));
                    } else if (activeFilter === "active") {
                        countConstraints.push(where("disabled", "==", false));
                    }
                    countQ = query(baseQuery, ...countConstraints);
                }
                const countSnapshot = await getCountFromServer(countQ);
                setTotalCount(countSnapshot.data().count);
            }
        } catch (error: any) {
            console.warn("Error fetching users:", error?.message || error);
            showToast("Error fetching users: " + (error?.message || "Internal error"), "error");
        } finally {
            setLoading(false);
        }
    }

    // Initial load, search, and status filter changes
    useEffect(() => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        searchTimeoutRef.current = setTimeout(() => {
            setPageStartDocs([null]);
            fetchUsers(1, null, searchTerm, statusFilter);
        }, 400);

        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, [searchTerm, statusFilter]);

    const handleNextPage = () => {
        if (hasMore && !loading) {
            const nextStartDoc = pageStartDocs[page];
            fetchUsers(page + 1, nextStartDoc, searchTerm, statusFilter);
        }
    };
    const handlePrevPage = () => {
        if (page > 1 && !loading) {
            const prevStartDoc = pageStartDocs[page - 2];
            fetchUsers(page - 1, prevStartDoc, searchTerm, statusFilter);
        }
    };

    const openEditDrawer = (user: UserProfile) => {
        setEditingUser(user);
        setFormData({
            displayName: user.displayName || "",
            whisperMinutes: Math.round((user.balances?.whisper_seconds || 0) / 60),
            snipCredits: user.balances?.snip_typing_credits || 0,
            plan: user.subscription?.plan || "free",
            subscriptionStatus: user.subscription?.status || "active",
            role: user.role || "user",
            disabled: !!user.disabled
        });
        setShowDrawer(true);
    };

    const handleSaveUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser || submitting) return;
        setSubmitting(true);
        try {
            const token = await user?.getIdToken();
            const authResponse = await fetch("/api/users", {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    ...(token ? { "Authorization": `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    uid: editingUser.id,
                    disabled: formData.disabled
                })
            });

            if (!authResponse.ok) {
                const errorData = await authResponse.json();
                throw new Error(errorData.error || "Failed to update user authentication status");
            }

            const oldWhisper = editingUser.balances?.whisper_seconds || 0;
            const newWhisper = formData.whisperMinutes * 60;
            const oldSnip = editingUser.balances?.snip_typing_credits || 0;
            const newSnip = formData.snipCredits;

            if (newWhisper !== oldWhisper) {
                const diff = newWhisper - oldWhisper;
                await addDoc(collection(db, "ledger"), {
                    userId: editingUser.id,
                    type: diff > 0 ? "INFLOW" : "OUTFLOW",
                    category: "WHISPER",
                    amount: Math.abs(diff),
                    balanceAfter: newWhisper,
                    referenceId: diff > 0 ? "MANUAL_INFLOW" : "OUTFLOW_BY_ADMIN",
                    timestamp: Timestamp.now()
                });
            }

            if (newSnip !== oldSnip) {
                const diff = newSnip - oldSnip;
                await addDoc(collection(db, "ledger"), {
                    userId: editingUser.id,
                    type: diff > 0 ? "INFLOW" : "OUTFLOW",
                    category: "SNIP_TYPING",
                    amount: Math.abs(diff),
                    balanceAfter: newSnip,
                    referenceId: diff > 0 ? "MANUAL_INFLOW" : "OUTFLOW_BY_ADMIN",
                    timestamp: Timestamp.now()
                });
            }

            await updateDoc(doc(db, "users", editingUser.id), {
                displayName: formData.displayName,
                balances: {
                    whisper_seconds: newWhisper,
                    snip_typing_credits: newSnip
                },
                subscription: {
                    plan: formData.plan,
                    status: formData.subscriptionStatus
                },
                disabled: formData.disabled
            });
            showToast("User details updated successfully", "success");
            setShowDrawer(false);
            setEditingUser(null);
            fetchUsers(page, pageStartDocs[page - 1], searchTerm, statusFilter);
        } catch (error: any) {
            console.warn("Error updating user:", error?.message || error);
            showToast(error.message || "Failed to update user details", "error");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div>
            <div style={{ display: showList ? 'block' : 'none' }}>
                <div className="title-section">
                    <h1>Users Management</h1>
                    <p>View and manage your application users</p>
                </div>

                <div className="card" style={{ marginBottom: '24px', display: 'flex', gap: '16px', flexWrap: 'wrap', padding: '20px' }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1, minWidth: '240px' }}>
                        <Search size={20} style={{ position: 'absolute', left: '16px', color: '#9ca3af' }} />
                        <input
                            type="text"
                            placeholder="Search by email..."
                            style={{ paddingLeft: '48px', width: '100%' }}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '200px' }}>
                        <label style={{ margin: 0, fontSize: '13px', color: '#9ca3af', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Status:</label>
                        <select
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value as any);
                                setPageStartDocs([null]);
                            }}
                            style={{ cursor: 'pointer', padding: '10px 14px' }}
                        >
                            <option value="all">All Users</option>
                            <option value="active">Active Only</option>
                            <option value="inactive">Disabled Only</option>
                        </select>
                    </div>
                </div>

                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>User</th>
                                <th>Status</th>
                                <th>Credits</th>
                                <th>Subscription</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                [...Array(PAGE_SIZE)].map((_, i) => (
                                    <tr key={i}>
                                        <td colSpan={5}><div className="skeleton" style={{ height: '24px', width: '100%' }}></div></td>
                                    </tr>
                                ))
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'center', padding: '40px' }}>No users found</td>
                                </tr>
                            ) : (
                                users.map((user) => (
                                    <tr key={user.id}>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{
                                                    width: '36px',
                                                    height: '36px',
                                                    borderRadius: '0px',
                                                    background: 'var(--primary)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontWeight: 'bold',
                                                    color: 'white'
                                                }}>
                                                    {(user.displayName || user.email || "?")[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: '600', color: 'var(--foreground)' }}>{user.displayName || "Unknown User"}</div>
                                                    <div style={{ fontSize: '12px', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <Mail size={12} />
                                                        {user.email}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`badge ${user.disabled ? 'badge-danger' : 'badge-success'}`}>
                                                {user.disabled ? "DISABLED" : "ACTIVE"}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ fontSize: '13px' }}>
                                                <div>Whisper: <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{(() => { const totalMin = Math.round((user.balances?.whisper_seconds || 0) / 60); const h = Math.floor(totalMin / 60); const m = totalMin % 60; return h > 0 ? `${h}h ${m}m` : `${m}m`; })()}</span></div>
                                                <div>Snip: <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{user.balances?.snip_typing_credits || 0}</span></div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`badge ${user.subscription?.plan === 'pro' ? 'badge-success' : 'badge-warning'}`}>
                                                {user.subscription?.plan?.toUpperCase() || "FREE"}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                {isAdmin && (
                                                    <button
                                                        onClick={() => openEditDrawer(user)}
                                                        className="btn btn-outline"
                                                        style={{ padding: '6px 12px', fontSize: '12px' }}
                                                        title="Edit User"
                                                    >
                                                        <Pencil size={12} />
                                                        Edit
                                                    </button>
                                                )}
                                                <Link
                                                    href={`/users?ledgerUserId=${user.id}`}
                                                    className="btn btn-outline"
                                                    style={{ padding: '6px 12px', fontSize: '12px' }}
                                                    title="View Ledger"
                                                >
                                                    <History size={14} />
                                                    Ledger
                                                </Link>
                                                <Link
                                                    href={`/users?paymentsUserId=${user.id}`}
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
                        Page {page} of {Math.max(1, Math.ceil(totalCount / PAGE_SIZE))}
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

            {showLedger && (
                <LedgerContent userIdProp={ledgerUserId || ""} onBackProp={() => router.push('/users')} />
            )}

            {showPayments && (
                <PaymentsContent userIdProp={paymentsUserId || ""} onBackProp={() => router.push('/users')} />
            )}

            {showDrawer && (
                <div className="offcanvas-overlay" onClick={() => { setShowDrawer(false); setEditingUser(null); }}>
                    <div className="offcanvas-panel" onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                            <h2 style={{ margin: 0 }}>Edit User Profile</h2>
                            <button className="btn btn-outline" style={{ padding: '8px' }} onClick={() => { setShowDrawer(false); setEditingUser(null); }}>
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveUser} style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
                            <div className="input-group">
                                <label>Email Address (Read-only)</label>
                                <input
                                    type="text"
                                    value={editingUser?.email || ""}
                                    disabled
                                    style={{ opacity: 0.6, cursor: 'not-allowed' }}
                                />
                            </div>

                            <div className="input-group">
                                <label>Display Name</label>
                                <input
                                    type="text"
                                    placeholder="User Name"
                                    required
                                    value={formData.displayName}
                                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div className="input-group">
                                    <label>Whisper Bal. (Minutes)</label>
                                    <input
                                        type="number"
                                        required
                                        value={formData.whisperMinutes}
                                        onChange={(e) => setFormData({ ...formData, whisperMinutes: Number(e.target.value) })}
                                    />
                                    <span style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px', display: 'block' }}>
                                        = {(() => {
                                            const totalSec = formData.whisperMinutes * 60;
                                            const h = Math.floor(totalSec / 3600);
                                            const m = Math.floor((totalSec % 3600) / 60);
                                            return h > 0 ? `${h}h ${m}m` : `${m}m`;
                                        })()}
                                    </span>
                                </div>
                                <div className="input-group">
                                    <label>Snip Credits</label>
                                    <input
                                        type="number"
                                        required
                                        value={formData.snipCredits}
                                        onChange={(e) => setFormData({ ...formData, snipCredits: Number(e.target.value) })}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div className="input-group">
                                    <label>Subscription Plan</label>
                                    <select
                                        value={formData.plan}
                                        onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
                                    >
                                        <option value="standard">Standard</option>
                                        <option value="pro">Pro</option>
                                    </select>
                                </div>
                                <div className="input-group">
                                    <label>Subscription Status</label>
                                    <select
                                        value={formData.subscriptionStatus}
                                        onChange={(e) => setFormData({ ...formData, subscriptionStatus: e.target.value })}
                                    >
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                        <option value="trialing">Trialing</option>
                                        <option value="canceled">Canceled</option>
                                    </select>
                                </div>
                            </div>

                            <div className="input-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
                                <input
                                    type="checkbox"
                                    id="disabledUser"
                                    checked={formData.disabled}
                                    onChange={(e) => setFormData({ ...formData, disabled: e.target.checked })}
                                    style={{ width: 'auto', margin: 0 }}
                                />
                                <label htmlFor="disabledUser" style={{ margin: 0, cursor: 'pointer', fontWeight: '600' }}>
                                    Disable User Account (Blocks Authentication)
                                </label>
                            </div>

                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
                                <button type="button" className="btn btn-outline" onClick={() => { setShowDrawer(false); setEditingUser(null); }}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={submitting}>
                                    {submitting ? 'Saving...' : 'Update User'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function UsersPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <UsersPageContent />
        </Suspense>
    );
}
