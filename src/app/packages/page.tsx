"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  updateDoc,
  setDoc,
  deleteDoc,
  serverTimestamp
} from "firebase/firestore";
import { Plus, Edit, Trash2, X, Package, Puzzle, Percent, Clock } from "lucide-react";
import { useToast } from "@/lib/ToastContext";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { generateReadableId } from "@/lib/id.utils";
import { PlanType, EntityStatus, FulfillmentType, PricingPackage, AddonItem } from "@/lib/types";

export default function PackagesPage() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<"packages" | "addons">("packages");

  // Packages state
  const [packages, setPackages] = useState<PricingPackage[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [editingPackage, setEditingPackage] = useState<PricingPackage | null>(null);

  // Addons state
  const [addons, setAddons] = useState<AddonItem[]>([]);
  const [loadingAddons, setLoadingAddons] = useState(true);
  const [showAddonModal, setShowAddonModal] = useState(false);
  const [editingAddon, setEditingAddon] = useState<AddonItem | null>(null);

  const [submitting, setSubmitting] = useState(false);

  // Custom UI confirmation modal state
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // Form states
  const [packageFormData, setPackageFormData] = useState<Partial<PricingPackage>>({
    name: '',
    price: 0,
    originalPrice: 0,
    planType: PlanType.HOURLY,
    description: '',
    accentColor: 'text-purple-400',
    borderColor: 'border-purple-500/30',
    gradient: 'from-purple-600/30 via-purple-500/5 to-transparent',
    status: EntityStatus.ACTIVE,
    isPopular: false,
    fulfillment: [],
    items: []
  });

  const [addonFormData, setAddonFormData] = useState<Partial<AddonItem>>({
    name: '',
    type: 'MEMBERSHIP',
    price: 499,
    durationMonths: 1,
    discountPercent: 10,
    description: '',
    status: 'ACTIVE'
  });

  // --- FETCHERS ---
  async function fetchPackages() {
    setLoadingPackages(true);
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
      setLoadingPackages(false);
    }
  }

  async function fetchAddons() {
    setLoadingAddons(true);
    try {
      const q = query(collection(db, "addons"), orderBy("price", "asc"));
      const querySnapshot = await getDocs(q);
      const list = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AddonItem[];
      setAddons(list);
    } catch (error) {
      console.error("Error fetching addons:", error);
    } finally {
      setLoadingAddons(false);
    }
  }

  useEffect(() => {
    fetchPackages();
    fetchAddons();
  }, []);

  // --- PACKAGE ACTIONS ---
  const handleSavePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const payload: any = {
        ...packageFormData,
        planType: packageFormData.planType || PlanType.HOURLY,
        status: packageFormData.status || EntityStatus.ACTIVE
      };

      if (editingPackage) {
        await updateDoc(doc(db, "packages", editingPackage.id), {
          ...payload,
          updatedAt: serverTimestamp()
        });
        showToast("Package updated successfully", "success");
      } else {
        const pkgId = generateReadableId("PACKAGE");
        await setDoc(doc(db, "packages", pkgId), {
          ...payload,
          id: pkgId,
          createdAt: serverTimestamp()
        });
        showToast("Package created successfully", "success");
      }
      setShowPackageModal(false);
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
      message: `Are you sure you want to delete the package "${pkg.name}" (${id})?`,
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

  const togglePackageStatus = async (pkg: PricingPackage) => {
    const newStatus = pkg.status === EntityStatus.ACTIVE ? EntityStatus.INACTIVE : EntityStatus.ACTIVE;
    try {
      await updateDoc(doc(db, "packages", pkg.id), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      showToast(`Package marked as ${newStatus}`, "success");
      fetchPackages();
    } catch (err: any) {
      showToast(err?.message || "Failed to toggle package status", "error");
    }
  };

  const openAddPackageModal = () => {
    setEditingPackage(null);
    setPackageFormData({
      name: '',
      price: 0,
      originalPrice: 0,
      planType: PlanType.HOURLY,
      description: '',
      accentColor: 'text-purple-400',
      borderColor: 'border-purple-500/30',
      gradient: 'from-purple-600/30 via-purple-500/5 to-transparent',
      status: EntityStatus.ACTIVE,
      isPopular: false,
      fulfillment: [
        { type: FulfillmentType.WHISPER, quantity: 18000, label: '5h Transcription' },
        { type: FulfillmentType.SNIP_TYPING, quantity: 25, label: '25 AI Consultations' }
      ],
      items: [
        { label: '5 Hours', sublabel: 'Transcription' },
        { label: '25 Questions', sublabel: 'AI Consultation' }
      ]
    });
    setShowPackageModal(true);
  };

  const openEditPackageModal = (pkg: PricingPackage) => {
    setEditingPackage(pkg);
    setPackageFormData({
      ...pkg,
      planType: pkg.planType || PlanType.HOURLY
    });
    setShowPackageModal(true);
  };

  const addFulfillmentItem = () => {
    setPackageFormData({
      ...packageFormData,
      fulfillment: [
        ...(packageFormData.fulfillment || []),
        { type: FulfillmentType.WHISPER, quantity: 0, label: '' }
      ]
    });
  };

  const removeFulfillmentItem = (index: number) => {
    const newFulfillment = [...(packageFormData.fulfillment || [])];
    newFulfillment.splice(index, 1);
    setPackageFormData({ ...packageFormData, fulfillment: newFulfillment });
  };

  const updateFulfillmentItem = (index: number, field: string, value: any) => {
    const newFulfillment = [...(packageFormData.fulfillment || [])];
    newFulfillment[index] = { ...newFulfillment[index], [field]: value };
    setPackageFormData({ ...packageFormData, fulfillment: newFulfillment });
  };

  // --- ADDON ACTIONS ---
  const handleSaveAddon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const payload: any = {
        name: addonFormData.name?.trim(),
        type: addonFormData.type || 'MEMBERSHIP',
        price: Number(addonFormData.price) || 0,
        description: addonFormData.description?.trim() || '',
        status: addonFormData.status || 'ACTIVE'
      };

      if (addonFormData.type === 'MEMBERSHIP') {
        payload.durationMonths = Number(addonFormData.durationMonths) || 1;
        payload.discountPercent = Number(addonFormData.discountPercent) || 10;
      }

      if (editingAddon) {
        await updateDoc(doc(db, "addons", editingAddon.id), {
          ...payload,
          updatedAt: serverTimestamp()
        });
        showToast("Add-on updated successfully", "success");
      } else {
        const addonId = generateReadableId("ADDON");
        await setDoc(doc(db, "addons", addonId), {
          ...payload,
          id: addonId,
          createdAt: serverTimestamp()
        });
        showToast("Add-on created successfully", "success");
      }
      setShowAddonModal(false);
      setEditingAddon(null);
      fetchAddons();
    } catch (error) {
      console.error("Error saving add-on:", error);
      showToast("Failed to save add-on", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAddon = async (id: string) => {
    const addon = addons.find(a => a.id === id);
    if (!addon) return;

    setConfirmState({
      isOpen: true,
      title: "Delete Add-on",
      message: `Are you sure you want to delete the add-on "${addon.name}" (${id})?`,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, "addons", id));
          fetchAddons();
          showToast("Add-on deleted successfully", "success");
        } catch (error) {
          console.error("Error deleting add-on:", error);
          showToast("Failed to delete add-on", "error");
        } finally {
          setConfirmState(null);
        }
      }
    });
  };

  const toggleAddonStatus = async (addon: AddonItem) => {
    const newStatus = addon.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await updateDoc(doc(db, "addons", addon.id), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      showToast(`Add-on marked as ${newStatus}`, "success");
      fetchAddons();
    } catch (err: any) {
      showToast(err?.message || "Failed to toggle add-on status", "error");
    }
  };

  const openAddAddonModal = () => {
    setEditingAddon(null);
    setAddonFormData({
      name: '',
      type: 'MEMBERSHIP',
      price: 499,
      durationMonths: 1,
      discountPercent: 10,
      description: 'Unlocks Ultra Sonic engine, 32+ languages, and 10% discount on packages',
      status: 'ACTIVE'
    });
    setShowAddonModal(true);
  };

  const openEditAddonModal = (addon: AddonItem) => {
    setEditingAddon(addon);
    setAddonFormData({
      ...addon,
      durationMonths: addon.durationMonths ?? 1,
      discountPercent: addon.discountPercent ?? 10
    });
    setShowAddonModal(true);
  };

  return (
    <div>
      {/* Title & Actions Section */}
      <div className="title-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '20px' }}>
        <div>
          <h1>Packages & Add-ons</h1>
          <p>Configure pricing catalogue, unlimited monthly plans, and checkout add-ons</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {activeTab === 'packages' ? (
            <button className="btn btn-primary" onClick={openAddPackageModal} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Plus size={18} />
              Add Package
            </button>
          ) : (
            <button className="btn btn-primary" onClick={openAddAddonModal} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Plus size={18} />
              Add Add-on
            </button>
          )}
        </div>
      </div>

      {/* Tab Switcher */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
        <button
          onClick={() => setActiveTab("packages")}
          style={{
            padding: "8px 18px",
            borderRadius: "6px",
            background: activeTab === "packages" ? "var(--primary)" : "transparent",
            color: activeTab === "packages" ? "#fff" : "var(--text-muted)",
            border: activeTab === "packages" ? "1px solid var(--primary)" : "1px solid var(--border)",
            cursor: "pointer",
            fontWeight: "600",
            fontSize: "13px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            transition: "all 0.2s"
          }}
        >
          <Package size={16} />
          Packages ({packages.length})
        </button>

        <button
          onClick={() => setActiveTab("addons")}
          style={{
            padding: "8px 18px",
            borderRadius: "6px",
            background: activeTab === "addons" ? "var(--primary)" : "transparent",
            color: activeTab === "addons" ? "#fff" : "var(--text-muted)",
            border: activeTab === "addons" ? "1px solid var(--primary)" : "1px solid var(--border)",
            cursor: "pointer",
            fontWeight: "600",
            fontSize: "13px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            transition: "all 0.2s"
          }}
        >
          <Puzzle size={16} />
          Add-ons ({addons.length})
        </button>
      </div>

      {/* --- TAB 1: PACKAGES --- */}
      {activeTab === 'packages' && (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Package Name</th>
                <th>Type</th>
                <th>Price</th>
                <th>Fulfillment Credits</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingPackages ? (
                [...Array(3)].map((_, i) => (
                  <tr key={i}>
                    <td colSpan={6}>
                      <div className="skeleton" style={{ height: '36px', borderRadius: '0px' }}></div>
                    </td>
                  </tr>
                ))
              ) : packages.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px' }}>No packages found</td>
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
                      <div style={{ fontSize: '10px', color: '#9ca3af', fontFamily: 'monospace', marginTop: '2px' }}>
                        ID: {pkg.id}
                      </div>
                      <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>{pkg.description}</div>
                    </td>
                    <td>
                      <span className={`badge ${pkg.planType === PlanType.MONTHLY ? 'badge-primary' : 'badge-outline'}`} style={{ fontSize: '11px', fontWeight: 'bold' }}>
                        {pkg.planType || PlanType.HOURLY}
                      </span>
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
                      <button
                        className="btn btn-outline"
                        style={{ padding: '3px 8px', fontSize: '11px' }}
                        onClick={() => togglePackageStatus(pkg)}
                      >
                        <span className={`badge ${pkg.status === EntityStatus.ACTIVE ? 'badge-success' : 'badge-danger'}`}>
                          {pkg.status}
                        </span>
                      </button>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          className="btn btn-outline"
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                          onClick={() => openEditPackageModal(pkg)}
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
      )}

      {/* --- TAB 2: ADD-ONS --- */}
      {activeTab === 'addons' && (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Add-on Name</th>
                <th>Type</th>
                <th>Price</th>
                <th>Benefits & Inclusions</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingAddons ? (
                [...Array(2)].map((_, i) => (
                  <tr key={i}>
                    <td colSpan={6}>
                      <div className="skeleton" style={{ height: '36px', borderRadius: '0px' }}></div>
                    </td>
                  </tr>
                ))
              ) : addons.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px' }}>
                    No add-ons found. Click &quot;Add Add-on&quot; to create one (e.g. Pro Membership).
                  </td>
                </tr>
              ) : (
                addons.map((addon) => (
                  <tr key={addon.id}>
                    <td>
                      <div style={{ fontWeight: '700', fontSize: '14px' }}>{addon.name}</div>
                      <div style={{ fontSize: '10px', color: '#9ca3af', fontFamily: 'monospace', marginTop: '2px' }}>
                        ID: {addon.id}
                      </div>
                      <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>{addon.description}</div>
                    </td>
                    <td>
                      <span className="badge badge-primary" style={{ fontSize: '11px', fontWeight: 'bold' }}>
                        {addon.type}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: '700', fontSize: '14px', color: 'var(--foreground)' }}>₹{addon.price}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '12px' }}>
                        {addon.durationMonths && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#9ca3af' }}>
                            <Clock size={12} /> Duration: <strong style={{ color: 'var(--foreground)' }}>{addon.durationMonths} month{addon.durationMonths > 1 ? 's' : ''}</strong>
                          </div>
                        )}
                        {addon.discountPercent && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#10b981' }}>
                            <Percent size={12} /> Package Discount: <strong>{addon.discountPercent}% OFF</strong>
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <button
                        className="btn btn-outline"
                        style={{ padding: '3px 8px', fontSize: '11px' }}
                        onClick={() => toggleAddonStatus(addon)}
                      >
                        <span className={`badge ${addon.status === 'ACTIVE' ? 'badge-success' : 'badge-danger'}`}>
                          {addon.status}
                        </span>
                      </button>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          className="btn btn-outline"
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                          onClick={() => openEditAddonModal(addon)}
                        >
                          <Edit size={12} /> Edit
                        </button>
                        <button
                          className="btn btn-outline"
                          style={{ color: '#ef4444', padding: '6px 12px' }}
                          onClick={() => handleDeleteAddon(addon.id)}
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
      )}

      {/* --- MODAL: CREATE / EDIT PACKAGE --- */}
      {showPackageModal && (
        <div className="offcanvas-overlay" onClick={() => setShowPackageModal(false)}>
          <div className="offcanvas-panel" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
              <h2 style={{ margin: 0 }}>{editingPackage ? 'Edit Package' : 'Create New Package'}</h2>
              <button className="btn btn-outline" style={{ padding: '8px' }} onClick={() => setShowPackageModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePackage} style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
              <div className="input-group">
                <label>Package Name</label>
                <input
                  type="text"
                  placeholder="E.g. 1 Month Unlimited"
                  required
                  value={packageFormData.name}
                  onChange={(e) => setPackageFormData({...packageFormData, name: e.target.value})}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="input-group">
                  <label>Plan Type (Sonic-API)</label>
                  <CustomSelect
                    value={packageFormData.planType || PlanType.HOURLY}
                    onChange={(planType) => setPackageFormData({...packageFormData, planType: planType as PlanType})}
                    options={[
                      { value: PlanType.HOURLY, label: "Hourly Pack (Metered credits)" },
                      { value: PlanType.MONTHLY, label: "Monthly Unlimited (Subscription)" }
                    ]}
                  />
                </div>
                <div className="input-group">
                  <label>Status</label>
                  <CustomSelect
                    value={packageFormData.status || EntityStatus.ACTIVE}
                    onChange={(status) => setPackageFormData({...packageFormData, status: status as EntityStatus})}
                    options={[
                      { value: EntityStatus.ACTIVE, label: "Active" },
                      { value: EntityStatus.INACTIVE, label: "Inactive (Retired)" }
                    ]}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="input-group">
                  <label>Price (₹)</label>
                  <input
                    type="number"
                    required
                    value={packageFormData.price}
                    onChange={(e) => setPackageFormData({...packageFormData, price: Number(e.target.value)})}
                  />
                </div>
                <div className="input-group">
                  <label>Original Price (₹)</label>
                  <input
                    type="number"
                    value={packageFormData.originalPrice}
                    onChange={(e) => setPackageFormData({...packageFormData, originalPrice: Number(e.target.value)})}
                  />
                </div>
              </div>

              <div className="input-group">
                <label>Description</label>
                <textarea
                  placeholder="What's included in this package?"
                  rows={2}
                  value={packageFormData.description}
                  onChange={(e) => setPackageFormData({...packageFormData, description: e.target.value})}
                />
              </div>

              {/* Fulfillment Section */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <label style={{ margin: 0, fontWeight: '700', fontSize: '13px' }}>Fulfillment Credits & Entitlements</label>
                  <button type="button" className="btn btn-outline" style={{ padding: '4px 10px', fontSize: '11px' }} onClick={addFulfillmentItem}>
                    <Plus size={12} /> Add
                  </button>
                </div>

                {packageFormData.fulfillment?.map((item, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 70px 30px', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                    <CustomSelect
                      value={item.type}
                      onChange={(type) => updateFulfillmentItem(idx, 'type', type)}
                      options={[
                        { value: FulfillmentType.WHISPER, label: 'Whisper (Sec)' },
                        { value: FulfillmentType.SNIP_TYPING, label: 'Snip/Typing' },
                        { value: FulfillmentType.MONTHLY_SUBSCRIPTION, label: 'Monthly Sub' },
                        { value: FulfillmentType.MEMBERSHIP, label: 'Pro Member' }
                      ]}
                    />
                    <input
                      type="text"
                      placeholder="Label (e.g. 1h Transcription)"
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

              <div className="input-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                <input
                  type="checkbox"
                  id="isPopular"
                  checked={packageFormData.isPopular}
                  onChange={(e) => setPackageFormData({...packageFormData, isPopular: e.target.checked})}
                  style={{ width: '18px', height: '18px', margin: 0 }}
                />
                <label htmlFor="isPopular" style={{ margin: 0, cursor: 'pointer' }}>Mark as Popular</label>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowPackageModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : editingPackage ? 'Update Package' : 'Create Package'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: CREATE / EDIT ADDON --- */}
      {showAddonModal && (
        <div className="offcanvas-overlay" onClick={() => setShowAddonModal(false)}>
          <div className="offcanvas-panel" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
              <h2 style={{ margin: 0 }}>{editingAddon ? 'Edit Add-on' : 'Create New Add-on'}</h2>
              <button className="btn btn-outline" style={{ padding: '8px' }} onClick={() => setShowAddonModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveAddon} style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
              <div className="input-group">
                <label>Add-on Name</label>
                <input
                  type="text"
                  placeholder="E.g. Pro Membership"
                  required
                  value={addonFormData.name}
                  onChange={(e) => setAddonFormData({...addonFormData, name: e.target.value})}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="input-group">
                  <label>Type</label>
                  <CustomSelect
                    value={addonFormData.type || "MEMBERSHIP"}
                    onChange={(type) => setAddonFormData({...addonFormData, type})}
                    options={[
                      { value: "MEMBERSHIP", label: "Pro Membership" },
                      { value: "WHISPER", label: "Whisper Credits" },
                      { value: "SNIP_TYPING", label: "Snip/Typing Credits" },
                      { value: "CUSTOM", label: "Custom" }
                    ]}
                  />
                </div>
                <div className="input-group">
                  <label>Price (₹)</label>
                  <input
                    type="number"
                    required
                    value={addonFormData.price}
                    onChange={(e) => setAddonFormData({...addonFormData, price: Number(e.target.value)})}
                  />
                </div>
              </div>

              {addonFormData.type === 'MEMBERSHIP' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', background: 'rgba(59, 130, 246, 0.05)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.15)' }}>
                  <div className="input-group">
                    <label>Duration (Months)</label>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={addonFormData.durationMonths}
                      onChange={(e) => setAddonFormData({...addonFormData, durationMonths: Number(e.target.value)})}
                    />
                  </div>
                  <div className="input-group">
                    <label>Package Discount (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={addonFormData.discountPercent}
                      onChange={(e) => setAddonFormData({...addonFormData, discountPercent: Number(e.target.value)})}
                    />
                  </div>
                </div>
              )}

              <div className="input-group">
                <label>Description</label>
                <textarea
                  placeholder="Describe what features or perks this add-on unlocks..."
                  rows={3}
                  value={addonFormData.description}
                  onChange={(e) => setAddonFormData({...addonFormData, description: e.target.value})}
                />
              </div>

              <div className="input-group">
                <label>Status</label>
                <CustomSelect
                  value={addonFormData.status || "ACTIVE"}
                  onChange={(status) => setAddonFormData({...addonFormData, status: status as 'ACTIVE' | 'INACTIVE'})}
                  options={[
                    { value: "ACTIVE", label: "Active" },
                    { value: "INACTIVE", label: "Inactive" }
                  ]}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowAddonModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : editingAddon ? 'Update Add-on' : 'Create Add-on'}
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
                      confirmState.onConfirm();
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
