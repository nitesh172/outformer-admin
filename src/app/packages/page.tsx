"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, doc, updateDoc, addDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { Plus, Edit, Trash2, X } from "lucide-react";
import { useToast } from "@/lib/ToastContext";

interface PricingPackage {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  description: string;
  accentColor?: string;
  borderColor?: string;
  gradient?: string;
  isPopular?: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  fulfillment: Array<{
    type: 'WHISPER' | 'SNIP_TYPING';
    quantity: number;
    label: string;
  }>;
  items?: Array<{
    label: string;
    sublabel: string;
  }>;
}

export default function PackagesPage() {
  const { showToast } = useToast();
  const [packages, setPackages] = useState<PricingPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPackage, setEditingPackage] = useState<PricingPackage | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Custom UI confirmation modal state
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void
  } | null>(null)
  const [formData, setFormData] = useState<Partial<PricingPackage>>({
    name: '',
    price: 0,
    originalPrice: 0,
    description: '',
    accentColor: 'text-purple-400',
    borderColor: 'border-purple-500/30',
    gradient: 'from-purple-600/30 via-purple-500/5 to-transparent',
    status: 'ACTIVE',
    isPopular: false,
    fulfillment: [],
    items: []
  });

  async function fetchPackages() {
    setLoading(true);
    try {
      const q = query(collection(db, "packages"), orderBy("price", "asc"));
      const querySnapshot = await getDocs(q);
      const list = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PricingPackage[];
      setPackages(list);
    } catch (error) {
      console.error("Error fetching packages:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleSavePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      if (editingPackage) {
        await updateDoc(doc(db, "packages", editingPackage.id), {
          ...formData,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, "packages"), {
          ...formData,
          createdAt: serverTimestamp()
        });
      }
      setShowModal(false);
      setEditingPackage(null);
      fetchPackages();
    } catch (error) {
      console.error("Error saving package:", error);
      showToast("Failed to save package", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePackage = async (id: string) => {
    const pkg = packages.find(p => p.id === id);
    if (!pkg) return;

    setConfirmState({
      isOpen: true,
      title: "Delete Package",
      message: `Are you sure you want to delete the package "${pkg.name}"?`,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, "packages", id));
          fetchPackages();
          showToast("Package deleted successfully", "success");
        } catch (error) {
          console.error("Error deleting package:", error);
          showToast("Failed to delete package", "error");
        } finally {
          setConfirmState(null);
        }
      }
    });
  };

  const openAddModal = () => {
    setEditingPackage(null);
    setFormData({
      name: '',
      price: 0,
      originalPrice: 0,
      description: '',
      accentColor: 'text-purple-400',
      borderColor: 'border-purple-500/30',
      gradient: 'from-purple-600/30 via-purple-500/5 to-transparent',
      status: 'ACTIVE',
      isPopular: false,
      fulfillment: [
        { type: 'WHISPER', quantity: 18000, label: '5h Transcription' },
        { type: 'SNIP_TYPING', quantity: 25, label: '25 AI Consultations' }
      ],
      items: [
        { label: '5 Hours', sublabel: 'Transcription' },
        { label: '25 Questions', sublabel: 'AI Consultation' }
      ]
    });
    setShowModal(true);
  };

  const openEditModal = (pkg: PricingPackage) => {
    setEditingPackage(pkg);
    setFormData({ ...pkg });
    setShowModal(true);
  };

  const addFulfillmentItem = () => {
    setFormData({
      ...formData,
      fulfillment: [
        ...(formData.fulfillment || []),
        { type: 'WHISPER', quantity: 0, label: '' }
      ]
    });
  };

  const removeFulfillmentItem = (index: number) => {
    const newFulfillment = [...(formData.fulfillment || [])];
    newFulfillment.splice(index, 1);
    setFormData({ ...formData, fulfillment: newFulfillment });
  };

  const updateFulfillmentItem = (index: number, field: string, value: any) => {
    const newFulfillment = [...(formData.fulfillment || [])];
    newFulfillment[index] = { ...newFulfillment[index], [field]: value };
    setFormData({ ...formData, fulfillment: newFulfillment });
  };


  useEffect(() => {
    fetchPackages();
  }, []);

  return (
    <div>
      <div className="title-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1>Packages Management</h1>
          <p>Configure pricing and credit bundles</p>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>
          <Plus size={20} />
          Add Package
        </button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Package Name</th>
              <th>Price</th>
              <th>Fulfillment Credits</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(3)].map((_, i) => (
                <tr key={i}>
                  <td colSpan={5}>
                    <div className="skeleton" style={{ height: '36px', borderRadius: '0px' }}></div>
                  </td>
                </tr>
              ))
            ) : packages.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '40px' }}>No packages found</td>
              </tr>
            ) : (
              packages.map((pkg) => (
                <tr key={pkg.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: '700', fontSize: '14px' }}>{pkg.name}</span>
                      {pkg.isPopular && (
                        <span style={{
                          background: 'var(--primary)',
                          color: 'white',
                          fontSize: '9px',
                          fontWeight: 'bold',
                          padding: '2px 6px',
                          borderRadius: '0px',
                          textTransform: 'uppercase'
                        }}>Popular</span>
                      )}
                    </div>
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>{pkg.description}</div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                      <span style={{ fontWeight: '700', fontSize: '14px', color: 'var(--foreground)' }}>₹{pkg.price}</span>
                      {pkg.originalPrice ? (
                        <span style={{ fontSize: '11px', color: '#9ca3af', textDecoration: 'line-through' }}>₹{pkg.originalPrice}</span>
                      ) : null}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {pkg.fulfillment?.map((f, i) => (
                        <span key={i} className="badge badge-success" style={{ fontSize: '10px' }}>
                          {f.label}: {f.quantity}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${pkg.status === 'ACTIVE' ? 'badge-success' : 'badge-danger'}`}>
                      {pkg.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className="btn btn-outline"
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                        onClick={() => openEditModal(pkg)}
                      >
                        <Edit size={12} /> Edit
                      </button>
                      <button
                        className="btn btn-outline"
                        style={{ color: '#ef4444', padding: '6px 12px' }}
                        onClick={() => handleDeletePackage(pkg.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="offcanvas-overlay" onClick={() => setShowModal(false)}>
          <div className="offcanvas-panel" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
              <h2 style={{ margin: 0 }}>{editingPackage ? 'Edit Package' : 'Create New Package'}</h2>
              <button className="btn btn-outline" style={{ padding: '8px' }} onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleSavePackage} style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
              <div className="input-group">
                <label>Package Name</label>
                <input
                  type="text"
                  placeholder="E.g. Pro Monthly"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="input-group">
                  <label>Price (₹)</label>
                  <input
                    type="number"
                    required
                    value={formData.price}
                    onChange={(e) => setFormData({...formData, price: Number(e.target.value)})}
                  />
                </div>
                <div className="input-group">
                  <label>Original Price (₹)</label>
                  <input
                    type="number"
                    value={formData.originalPrice}
                    onChange={(e) => setFormData({...formData, originalPrice: Number(e.target.value)})}
                  />
                </div>
              </div>

              <div className="input-group">
                <label>Description</label>
                <textarea
                  placeholder="What's included in this package?"
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                />
              </div>

              {/* Fulfillment Section */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <label style={{ margin: 0, fontWeight: '700', fontSize: '13px' }}>Fulfillment Credits</label>
                  <button type="button" className="btn btn-outline" style={{ padding: '4px 10px', fontSize: '11px' }} onClick={addFulfillmentItem}>
                    <Plus size={12} /> Add
                  </button>
                </div>
                
                {formData.fulfillment?.map((item, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 40px', gap: '8px', marginBottom: '8px' }}>
                    <input
                      type="text"
                      placeholder="Label (e.g. 5h Transcription)"
                      value={item.label}
                      onChange={(e) => updateFulfillmentItem(idx, 'label', e.target.value)}
                      style={{ padding: '8px', fontSize: '12px' }}
                    />
                    <input
                      type="number"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => updateFulfillmentItem(idx, 'quantity', Number(e.target.value))}
                      style={{ padding: '8px', fontSize: '12px' }}
                    />
                    <button type="button" style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => removeFulfillmentItem(idx)}>
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
                <div className="input-group">
                  <label>Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
                <div className="input-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', height: '100%', marginTop: '10px' }}>
                  <input
                    type="checkbox"
                    id="isPopular"
                    checked={formData.isPopular}
                    onChange={(e) => setFormData({...formData, isPopular: e.target.checked})}
                    style={{ width: '18px', height: '18px', margin: 0 }}
                  />
                  <label htmlFor="isPopular" style={{ margin: 0, cursor: 'pointer' }}>Mark as Popular</label>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : editingPackage ? 'Update Package' : 'Create Package'}
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
