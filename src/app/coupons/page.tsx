"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, serverTimestamp, query, orderBy, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { Ticket, Plus, Trash2, Calendar, Percent, IndianRupee, Clock, Pencil } from "lucide-react";

import { useToast } from "@/lib/ToastContext";

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
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
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
    if (!confirm("Are you sure you want to delete this coupon?")) return;
    try {
      await deleteDoc(doc(db, "coupons", id));
      fetchCoupons();
    } catch (error) {
      console.error("Error deleting coupon:", error);
    }
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
        <button className="btn btn-primary" onClick={() => {
          setEditingCoupon(null);
          setShowModal(true);
        }}>
          <Plus size={20} />
          Create Coupon
        </button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Discount</th>
              <th>Usage</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(3)].map((_, i) => (
                <tr key={i}><td colSpan={5}><div className="skeleton" style={{ height: '24px' }}></div></td></tr>
              ))
            ) : coupons.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px' }}>No coupons found</td></tr>
            ) : (
              coupons.map((coupon) => (
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
                      <div style={{ flex: 1, height: '6px', background: '#333', borderRadius: '3px', maxWidth: '100px' }}>
                        <div style={{ 
                          height: '100%', 
                          width: `${Math.min(100, ((coupon.usedCount || 0) / (coupon.usageLimit || 1)) * 100)}%`,
                          background: 'var(--primary)',
                          borderRadius: '3px'
                        }}></div>
                      </div>
                      <span style={{ fontSize: '12px' }}>{coupon.usedCount || 0} / {coupon.usageLimit || '∞'}</span>
                    </div>
                  </td>
                  <td>
                    <button onClick={() => toggleStatus(coupon)}>
                      <span className={`badge ${coupon.status === 'ACTIVE' ? 'badge-success' : 'badge-danger'}`}>
                        {coupon.status}
                      </span>
                    </button>
                  </td>
                  <td style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      className="btn btn-outline" 
                      style={{ padding: '6px' }}
                      onClick={() => openEditModal(coupon)}
                    >
                      <Pencil size={16} />
                    </button>
                    <button 
                      className="btn btn-outline" 
                      style={{ color: '#ef4444', padding: '6px' }}
                      onClick={() => handleDeleteCoupon(coupon.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2 style={{ marginBottom: '24px' }}>{editingCoupon ? 'Edit Coupon' : 'Create New Coupon'}</h2>
            <form onSubmit={handleSaveCoupon}>
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
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
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
    </div>
  );
}
