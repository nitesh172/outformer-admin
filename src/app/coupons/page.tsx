"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, serverTimestamp, query, orderBy, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { Ticket, Plus, Trash2, Percent, IndianRupee, Pencil, X } from "lucide-react";

import { useToast } from "@/lib/ToastContext";
import { useAuth } from "@/lib/AuthContext";

interface Coupon {
  id: string;
  code: string;
  description?: string;
  type: 'PERCENTAGE' | 'FIXED';
  value: number;
  minOrderAmount?: number;
  maxDiscount?: number;
  usageLimit?: number;
  usagePerUser?: number;
  usedCount?: number;
  startDate?: any;
  endDate?: any;
  status: 'ACTIVE' | 'INACTIVE';
}

export default function CouponsPage() {
  const { showToast } = useToast();
  const { isAdmin } = useAuth();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);

  // Custom UI confirmation modal state
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void
  } | null>(null)
  const [newCoupon, setNewCoupon] = useState<Partial<Coupon>>({
    code: '',
    description: '',
    type: 'PERCENTAGE',
    value: 0,
    minOrderAmount: 0,
    usageLimit: 0,
    status: 'ACTIVE',
    usedCount: 0,
    usagePerUser: 1,
    startDate: '',
    endDate: ''
  });

  async function fetchCoupons() {
    setLoading(true);
    try {
      const q = query(collection(db, "coupons"), orderBy("code", "asc"));
      const querySnapshot = await getDocs(q);
      const list = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Coupon[];
      setCoupons(list);
    } catch (error) {
      console.error("Error fetching coupons:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCoupons();
  }, []);

  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      if (editingCoupon) {
        const { id, ...data } = editingCoupon;
        await updateDoc(doc(db, "coupons", id), {
          ...data,
          code: data.code?.toUpperCase(),
          startDate: data.startDate ? new Date(data.startDate) : null,
          endDate: data.endDate ? new Date(data.endDate) : null,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, "coupons"), {
          ...newCoupon,
          code: newCoupon.code?.toUpperCase(),
          startDate: newCoupon.startDate ? new Date(newCoupon.startDate) : null,
          endDate: newCoupon.endDate ? new Date(newCoupon.endDate) : null,
          createdAt: serverTimestamp()
        });
      }
      setShowModal(false);
      setEditingCoupon(null);
      setNewCoupon({
        code: '',
        description: '',
        type: 'PERCENTAGE',
        value: 0,
        minOrderAmount: 0,
        usageLimit: 0,
        status: 'ACTIVE',
        usedCount: 0,
        usagePerUser: 1,
        startDate: '',
        endDate: ''
      });
      fetchCoupons();
    } catch (error) {
      console.error("Error saving coupon:", error);
      showToast("Failed to save coupon", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCoupon = async (id: string) => {
    const coupon = coupons.find(c => c.id === id);
    if (!coupon) return;

    setConfirmState({
      isOpen: true,
      title: "Delete Coupon",
      message: `Are you sure you want to delete the coupon "${coupon.code}"?`,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, "coupons", id));
          fetchCoupons();
          showToast("Coupon deleted successfully", "success");
        } catch (error) {
          console.error("Error deleting coupon:", error);
          showToast("Failed to delete coupon", "error");
        } finally {
          setConfirmState(null);
        }
      }
    });
  };

  const openEditModal = (coupon: Coupon) => {
    // Convert Firestore timestamps to datetime-local string format YYYY-MM-DDTHH:mm
    const formatDateForInput = (date: any) => {
      try {
        if (!date) return "";
        const d = date.toDate ? date.toDate() : new Date(date);
        if (isNaN(d.getTime())) return "";
        // Use local time for datetime-local input
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      } catch (e) {
        console.error("Error formatting date:", e);
        return "";
      }
    };

    setEditingCoupon({
      ...coupon,
      startDate: formatDateForInput(coupon.startDate),
      endDate: formatDateForInput(coupon.endDate)
    });
    setShowModal(true);
  };

  const toggleStatus = async (coupon: Coupon) => {
    try {
      const newStatus = coupon.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await updateDoc(doc(db, "coupons", coupon.id), { status: newStatus });
      fetchCoupons();
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  return (
    <div>
      <div className="title-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1>Coupons Management</h1>
          <p>Create and manage discount codes</p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => {
            setEditingCoupon(null);
            setShowModal(true);
          }}>
            <Plus size={20} />
            Create Coupon
          </button>
        )}
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Discount</th>
              <th>Usage</th>
              <th>Status</th>
              {isAdmin && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(3)].map((_, i) => (
                <tr key={i}><td colSpan={5}><div className="skeleton" style={{ height: '24px' }}></div></td></tr>
              ))
            ) : coupons.filter(coupon => !coupon.usageLimit || (coupon.usedCount || 0) < coupon.usageLimit).length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '48px 24px', textAlign: 'center' }}>
                    <Ticket size={48} style={{ color: '#9ca3af', opacity: 0.5 }} />
                    <div style={{ fontWeight: '700', fontSize: '16px', color: 'var(--foreground)' }}>No Active Coupons Available</div>
                    <div style={{ fontSize: '13px', color: '#9ca3af', maxWidth: '280px' }}>
                      There are no active or unutilized discount coupons. Create one to get started!
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              coupons.filter(coupon => !coupon.usageLimit || (coupon.usedCount || 0) < coupon.usageLimit).map((coupon) => (
                <tr key={coupon.id}>
                  <td>
                    <div style={{ fontWeight: 'bold', color: 'var(--primary)', letterSpacing: '1px' }}>
                      {coupon.code}
                    </div>
                    {coupon.description && (
                      <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                        {coupon.description}
                      </div>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {coupon.type === 'PERCENTAGE' ? <Percent size={14} /> : <IndianRupee size={14} />}
                      <span style={{ fontWeight: '600' }}>{coupon.value}{coupon.type === 'PERCENTAGE' ? '%' : ''}</span>
                    </div>
                    {coupon.minOrderAmount && (
                      <div style={{ fontSize: '11px', color: '#9ca3af' }}>Min: ₹{coupon.minOrderAmount}</div>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ flex: 1, height: '6px', background: 'var(--muted)', borderRadius: '0px', maxWidth: '100px' }}>
                        <div style={{ 
                          height: '100%', 
                          width: `${Math.min(100, ((coupon.usedCount || 0) / (coupon.usageLimit || 1)) * 100)}%`,
                          background: 'var(--primary)',
                          borderRadius: '0px'
                        }}></div>
                      </div>
                      <span style={{ fontSize: '12px' }}>{coupon.usedCount || 0} / {coupon.usageLimit || '∞'}</span>
                    </div>
                  </td>
                  <td>
                    {isAdmin ? (
                      <button
                        className="btn btn-outline"
                        style={{ padding: '4px 10px', fontSize: '12px' }}
                        onClick={() => toggleStatus(coupon)}
                      >
                        <span className={`badge ${coupon.status === 'ACTIVE' ? 'badge-success' : 'badge-danger'}`}>
                          {coupon.status}
                        </span>
                      </button>
                    ) : (
                      <span className={`badge ${coupon.status === 'ACTIVE' ? 'badge-success' : 'badge-danger'}`}>
                        {coupon.status}
                      </span>
                    )}
                  </td>
                  {isAdmin && (
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          className="btn btn-outline" 
                          style={{ padding: '6px 12px' }}
                          onClick={() => openEditModal(coupon)}
                        >
                          <Pencil size={12} />
                        </button>
                        <button 
                          className="btn btn-outline" 
                          style={{ color: '#ef4444', padding: '6px 12px' }}
                          onClick={() => handleDeleteCoupon(coupon.id)}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="offcanvas-overlay" onClick={() => { setShowModal(false); setEditingCoupon(null); }}>
          <div className="offcanvas-panel" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
              <h2 style={{ margin: 0 }}>{editingCoupon ? 'Edit Coupon' : 'Create New Coupon'}</h2>
              <button className="btn btn-outline" style={{ padding: '8px' }} onClick={() => { setShowModal(false); setEditingCoupon(null); }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCoupon} style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
              <div className="input-group">
                <label>Coupon Code</label>
                <input 
                  type="text" 
                  placeholder="E.g. OUTFORMER500" 
                  required 
                  value={(editingCoupon ? editingCoupon.code : newCoupon.code) ?? ''}
                  onChange={(e) => editingCoupon 
                    ? setEditingCoupon({...editingCoupon, code: e.target.value})
                    : setNewCoupon({...newCoupon, code: e.target.value})
                  }
                />
              </div>

              <div className="input-group">
                <label>Description</label>
                <input 
                  type="text" 
                  placeholder="e.g. Flat ₹500 off on orders above ₹2000" 
                  required 
                  value={(editingCoupon ? editingCoupon.description : newCoupon.description) ?? ''}
                  onChange={(e) => editingCoupon
                    ? setEditingCoupon({...editingCoupon, description: e.target.value})
                    : setNewCoupon({...newCoupon, description: e.target.value})
                  }
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="input-group">
                  <label>Type</label>
                  <select 
                    value={editingCoupon ? editingCoupon.type : newCoupon.type}
                    onChange={(e) => editingCoupon
                      ? setEditingCoupon({...editingCoupon, type: e.target.value as any})
                      : setNewCoupon({...newCoupon, type: e.target.value as any})
                    }
                  >
                    <option value="PERCENTAGE">Percentage</option>
                    <option value="FIXED">Fixed Amount</option>
                  </select>
                </div>
                <div className="input-group">
                  <label>Value</label>
                  <input 
                    type="number" 
                    required 
                    value={(editingCoupon ? editingCoupon.value : newCoupon.value) ?? 0}
                    onChange={(e) => editingCoupon
                      ? setEditingCoupon({...editingCoupon, value: Number(e.target.value)})
                      : setNewCoupon({...newCoupon, value: Number(e.target.value)})
                    }
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="input-group">
                  <label>Usage Limit</label>
                  <input 
                    type="number" 
                    placeholder="Unlimited if empty" 
                    value={(editingCoupon ? editingCoupon.usageLimit : newCoupon.usageLimit) ?? ''}
                    onChange={(e) => editingCoupon
                      ? setEditingCoupon({...editingCoupon, usageLimit: Number(e.target.value)})
                      : setNewCoupon({...newCoupon, usageLimit: Number(e.target.value)})
                    }
                  />
                </div>
                <div className="input-group">
                  <label>Usage Per User</label>
                  <input 
                    type="number" 
                    value={editingCoupon ? editingCoupon.usagePerUser : newCoupon.usagePerUser}
                    onChange={(e) => editingCoupon
                      ? setEditingCoupon({...editingCoupon, usagePerUser: Number(e.target.value)})
                      : setNewCoupon({...newCoupon, usagePerUser: Number(e.target.value)})
                    }
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="input-group">
                  <label>Min Order (₹)</label>
                  <input 
                    type="number" 
                    value={(editingCoupon ? editingCoupon.minOrderAmount : newCoupon.minOrderAmount) ?? ''}
                    onChange={(e) => editingCoupon
                      ? setEditingCoupon({...editingCoupon, minOrderAmount: Number(e.target.value)})
                      : setNewCoupon({...newCoupon, minOrderAmount: Number(e.target.value)})
                    }
                  />
                </div>
                <div className="input-group">
                  <label>Status</label>
                  <select 
                    value={editingCoupon ? editingCoupon.status : newCoupon.status}
                    onChange={(e) => editingCoupon
                      ? setEditingCoupon({...editingCoupon, status: e.target.value as any})
                      : setNewCoupon({...newCoupon, status: e.target.value as any})
                    }
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="input-group">
                  <label>Start Date</label>
                  <input 
                    type="datetime-local" 
                    value={(editingCoupon ? editingCoupon.startDate : newCoupon.startDate) ?? ''}
                    onChange={(e) => editingCoupon
                      ? setEditingCoupon({...editingCoupon, startDate: e.target.value})
                      : setNewCoupon({...newCoupon, startDate: e.target.value})
                    }
                  />
                </div>
                <div className="input-group">
                  <label>End Date</label>
                  <input 
                    type="datetime-local" 
                    value={(editingCoupon ? editingCoupon.endDate : newCoupon.endDate) ?? ''}
                    onChange={(e) => editingCoupon
                      ? setEditingCoupon({...editingCoupon, endDate: e.target.value})
                      : setNewCoupon({...newCoupon, endDate: e.target.value})
                    }
                  />
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
                <button 
                  type="button" 
                  className="btn btn-outline" 
                  onClick={() => {
                    setShowModal(false);
                    setEditingCoupon(null);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : editingCoupon ? 'Update Coupon' : 'Create Coupon'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmState && confirmState.isOpen && (
        <div className="modal-overlay" onClick={() => setConfirmState(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "450px", borderRadius: "12px", border: "1px solid var(--border)", background: "var(--card-bg)" }}>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
              <div style={{
                background: "rgba(239, 68, 68, 0.1)",
                color: "#ef4444",
                padding: "10px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
                <Trash2 size={24} />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "600", color: "var(--text)" }}>{confirmState.title}</h3>
                <p style={{ margin: "12px 0 24px 0", fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.5" }}>{confirmState.message}</p>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid var(--border)", cursor: "pointer", fontSize: "14px" }}
                    onClick={() => setConfirmState(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn"
                    style={{ padding: "8px 16px", borderRadius: "8px", background: "#ef4444", color: "#fff", cursor: "pointer", border: "none", fontWeight: "600", fontSize: "14px" }}
                    onClick={() => {
                      confirmState.onConfirm()
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
