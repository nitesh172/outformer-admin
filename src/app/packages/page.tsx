"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, doc, updateDoc, addDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { Package, Plus, Edit, IndianRupee, Clock, Zap, Trash2, X } from "lucide-react";
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
    if (!confirm("Are you sure you want to delete this package?")) return;
    try {
      await deleteDoc(doc(db, "packages", id));
      fetchPackages();
    } catch (error) {
      console.error("Error deleting package:", error);
    }
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

  const addItem = () => {
    setFormData({
      ...formData,
      items: [
        ...(formData.items || []),
        { label: '', sublabel: '' }
      ]
    });
  };

  const removeItem = (index: number) => {
    const newItems = [...(formData.items || [])];
    newItems.splice(index, 1);
    setFormData({ ...formData, items: newItems });
  };

  const updateItem = (index: number, field: string, value: string) => {
    const newItems = [...(formData.items || [])];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
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

      <div className="stats-grid">
        {loading ? (
          [...Array(3)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: '200px', borderRadius: '16px' }}></div>
          ))
        ) : packages.length === 0 ? (
          <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px' }}>No packages found</div>
        ) : (
          packages.map((pkg) => (
            <div key={pkg.id} className="stat-card" style={{ position: 'relative' }}>
              {pkg.isPopular && (
                <div style={{ 
                  position: 'absolute', 
                  top: '-10px', 
                  right: '20px', 
                  background: 'var(--primary)',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  textTransform: 'uppercase'
                }}>Popular</div>
              )}
              <div 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px', 
                  marginBottom: '16px'
                }}
              >
                <div style={{ padding: '10px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '12px', color: 'var(--primary)' }}>
                  <Package size={24} />
                </div>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '18px' }}>{pkg.name}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <div style={{ fontSize: '20px', fontWeight: '800', color: 'white' }}>₹{pkg.price}</div>
                    {pkg.originalPrice ? (
                      <div style={{ fontSize: '14px', color: '#9ca3af', textDecoration: 'line-through' }}>₹{pkg.originalPrice}</div>
                    ) : null}
                  </div>
                </div>
              </div>
              
              <div style={{ marginBottom: '20px', minHeight: '80px' }}>
                <p style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '12px' }}>{pkg.description}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {pkg.items?.map((item, idx) => (
                    <div key={idx} style={{ fontSize: '13px', borderLeft: '2px solid var(--primary)', paddingLeft: '8px' }}>
                      <div style={{ fontWeight: '600' }}>{item.label}</div>
                      <div style={{ fontSize: '11px', color: '#9ca3af' }}>{item.sublabel}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {pkg.fulfillment?.map((f, i) => (
                  <span key={i} style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                    {f.label}: {f.quantity}
                  </span>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className="btn btn-outline" 
                  style={{ flex: 1, fontSize: '13px' }}
                  onClick={() => openEditModal(pkg)}
                >
                  <Edit size={14} /> Edit
                </button>
                <button 
                  className="btn btn-outline" 
                  style={{ color: '#ef4444', padding: '8px' }}
                  onClick={() => handleDeletePackage(pkg.id)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '600px' }}>
            <h2 style={{ marginBottom: '24px' }}>{editingPackage ? 'Edit Package' : 'Create New Package'}</h2>
            <form onSubmit={handleSavePackage}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <div className="input-group">
                  <label>Accent Color</label>
                  <input 
                    type="text" 
                    placeholder="text-purple-400" 
                    value={formData.accentColor}
                    onChange={(e) => setFormData({...formData, accentColor: e.target.value})}
                  />
                </div>
                <div className="input-group">
                  <label>Border Color</label>
                  <input 
                    type="text" 
                    placeholder="border-purple-500/30" 
                    value={formData.borderColor}
                    onChange={(e) => setFormData({...formData, borderColor: e.target.value})}
                  />
                </div>
                <div className="input-group">
                  <label>Gradient</label>
                  <input 
                    type="text" 
                    placeholder="from-purple-600/30..." 
                    value={formData.gradient}
                    onChange={(e) => setFormData({...formData, gradient: e.target.value})}
                  />
                </div>
              </div>

              <div className="input-group">
                <label>Description</label>
                <textarea 
                  placeholder="What's included in this package?" 
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                {/* Fulfillment Section */}
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <label style={{ margin: 0, fontWeight: '600' }}>Fulfillment Credits</label>
                    <button type="button" className="btn btn-outline" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={addFulfillmentItem}>
                      <Plus size={14} /> Add
                    </button>
                  </div>
                  
                  {formData.fulfillment?.map((item, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 40px', gap: '8px', marginBottom: '8px' }}>
                      <input 
                        type="text" 
                        placeholder="Label" 
                        value={item.label} 
                        onChange={(e) => updateFulfillmentItem(idx, 'label', e.target.value)}
                        style={{ padding: '6px', fontSize: '12px' }}
                      />
                      <input 
                        type="number" 
                        placeholder="Qty" 
                        value={item.quantity} 
                        onChange={(e) => updateFulfillmentItem(idx, 'quantity', Number(e.target.value))}
                        style={{ padding: '6px', fontSize: '12px' }}
                      />
                      <button type="button" style={{ color: '#ef4444' }} onClick={() => removeFulfillmentItem(idx)}>
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Display Items Section */}
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <label style={{ margin: 0, fontWeight: '600' }}>Card Display Items</label>
                    <button type="button" className="btn btn-outline" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={addItem}>
                      <Plus size={14} /> Add
                    </button>
                  </div>
                  
                  {formData.items?.map((item, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 40px', gap: '8px', marginBottom: '8px' }}>
                      <input 
                        type="text" 
                        placeholder="Label" 
                        value={item.label} 
                        onChange={(e) => updateItem(idx, 'label', e.target.value)}
                        style={{ padding: '6px', fontSize: '12px' }}
                      />
                      <input 
                        type="text" 
                        placeholder="Sublabel" 
                        value={item.sublabel} 
                        onChange={(e) => updateItem(idx, 'sublabel', e.target.value)}
                        style={{ padding: '6px', fontSize: '12px' }}
                      />
                      <button type="button" style={{ color: '#ef4444' }} onClick={() => removeItem(idx)}>
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
                    style={{ width: '20px', height: '20px' }}
                  />
                  <label htmlFor="isPopular" style={{ margin: 0 }}>Mark as Popular</label>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '32px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : editingPackage ? 'Update Package' : 'Create Package'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
