"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  setDoc,
  serverTimestamp,
  query,
  orderBy,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import {
  Ticket,
  Plus,
  Trash2,
  Percent,
  IndianRupee,
  Pencil,
  X,
} from "lucide-react";

import { useToast } from "@/lib/ToastContext";
import { useAuth } from "@/lib/AuthContext";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { generateReadableId } from "@/lib/id.utils";
import { CouponType, EntityStatus } from "@/lib/types";

interface Coupon {
  id: string;
  code: string;
  description?: string;
  type: CouponType;
  value: number;
  minOrderAmount?: number;
  maxOrderAmount?: number;
  maxDiscount?: number;
  isNewUserOnly?: boolean;
  isMembershipOnly?: boolean;
  excludesMembership?: boolean;
  usageLimit?: number;
  usagePerUser?: number;
  usedCount?: number;
  reservedCount?: number;
  startDate?: any;
  endDate?: any;
  status: EntityStatus;
}

const DEFAULT_NEW_COUPON: Partial<Coupon> = {
  code: "",
  description: "",
  type: CouponType.PERCENTAGE,
  value: 0,
  minOrderAmount: 0,
  maxOrderAmount: 0,
  maxDiscount: 0,
  isNewUserOnly: false,
  isMembershipOnly: false,
  excludesMembership: false,
  usageLimit: 0,
  status: EntityStatus.ACTIVE,
  usedCount: 0,
  reservedCount: 0,
  usagePerUser: 1,
  startDate: "",
  endDate: "",
};

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
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [newCoupon, setNewCoupon] =
    useState<Partial<Coupon>>(DEFAULT_NEW_COUPON);

  async function fetchCoupons() {
    setLoading(true);
    try {
      const q = query(collection(db, "coupons"), orderBy("code", "asc"));
      const querySnapshot = await getDocs(q);
      const list = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
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
          code: data.code?.trim().toUpperCase(),
          minOrderAmount: Number(data.minOrderAmount) || 0,
          maxOrderAmount: data.maxOrderAmount
            ? Number(data.maxOrderAmount)
            : null,
          maxDiscount: data.maxDiscount ? Number(data.maxDiscount) : null,
          isNewUserOnly: Boolean(data.isNewUserOnly),
          isMembershipOnly: Boolean(data.isMembershipOnly),
          excludesMembership: Boolean(data.excludesMembership),
          startDate: data.startDate ? new Date(data.startDate) : null,
          endDate: data.endDate ? new Date(data.endDate) : null,
          updatedAt: serverTimestamp(),
        });
      } else {
        const couponId = generateReadableId("COUPON");
        await setDoc(doc(db, "coupons", couponId), {
          ...newCoupon,
          id: couponId,
          code: newCoupon.code?.trim().toUpperCase(),
          minOrderAmount: Number(newCoupon.minOrderAmount) || 0,
          maxOrderAmount: newCoupon.maxOrderAmount
            ? Number(newCoupon.maxOrderAmount)
            : null,
          maxDiscount: newCoupon.maxDiscount
            ? Number(newCoupon.maxDiscount)
            : null,
          isNewUserOnly: Boolean(newCoupon.isNewUserOnly),
          isMembershipOnly: Boolean(newCoupon.isMembershipOnly),
          excludesMembership: Boolean(newCoupon.excludesMembership),
          reservedCount: 0,
          startDate: newCoupon.startDate ? new Date(newCoupon.startDate) : null,
          endDate: newCoupon.endDate ? new Date(newCoupon.endDate) : null,
          createdAt: serverTimestamp(),
        });
      }
      setShowModal(false);
      setEditingCoupon(null);
      setNewCoupon(DEFAULT_NEW_COUPON);
      fetchCoupons();
    } catch (error) {
      console.error("Error saving coupon:", error);
      showToast("Failed to save coupon", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCoupon = async (id: string) => {
    const coupon = coupons.find((c) => c.id === id);
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
      },
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
        const pad = (n: number) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      } catch (e) {
        console.error("Error formatting date:", e);
        return "";
      }
    };

    const legacy = coupon as any;
    setEditingCoupon({
      ...coupon,
      isMembershipOnly: Boolean(
        coupon.isMembershipOnly ||
        legacy.forMembersOnly ||
        legacy.requiresMembership,
      ),
      excludesMembership: Boolean(
        coupon.excludesMembership ||
        legacy.allowMembership === false ||
        legacy.disallowMembership,
      ),
      startDate: formatDateForInput(coupon.startDate),
      endDate: formatDateForInput(coupon.endDate),
    });
    setShowModal(true);
  };

  const toggleStatus = async (coupon: Coupon) => {
    try {
      const newStatus =
        coupon.status === EntityStatus.ACTIVE
          ? EntityStatus.INACTIVE
          : EntityStatus.ACTIVE;
      await updateDoc(doc(db, "coupons", coupon.id), { status: newStatus });
      fetchCoupons();
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  return (
    <div>
      <div
        className="title-section"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
        }}
      >
        <div>
          <h1>Coupons Management</h1>
          <p>Create and manage discount codes</p>
        </div>
        {isAdmin && (
          <button
            className="btn btn-primary"
            onClick={() => {
              setEditingCoupon(null);
              setShowModal(true);
            }}
          >
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
                <tr key={i}>
                  <td colSpan={5}>
                    <div className="skeleton" style={{ height: "24px" }}></div>
                  </td>
                </tr>
              ))
            ) : coupons.filter(
                (coupon) =>
                  !coupon.usageLimit ||
                  (coupon.usedCount || 0) < coupon.usageLimit,
              ).length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "12px",
                      padding: "48px 24px",
                      textAlign: "center",
                    }}
                  >
                    <Ticket
                      size={48}
                      style={{ color: "#9ca3af", opacity: 0.5 }}
                    />
                    <div
                      style={{
                        fontWeight: "700",
                        fontSize: "16px",
                        color: "var(--foreground)",
                      }}
                    >
                      No Active Coupons Available
                    </div>
                    <div
                      style={{
                        fontSize: "13px",
                        color: "#9ca3af",
                        maxWidth: "280px",
                      }}
                    >
                      There are no active or unutilized discount coupons. Create
                      one to get started!
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              coupons
                .filter(
                  (coupon) =>
                    !coupon.usageLimit ||
                    (coupon.usedCount || 0) < coupon.usageLimit,
                )
                .map((coupon) => (
                  <tr key={coupon.id}>
                    <td>
                      <div
                        style={{
                          fontWeight: "bold",
                          color: "var(--primary)",
                          letterSpacing: "1px",
                        }}
                      >
                        {coupon.code}
                      </div>
                      {coupon.isNewUserOnly && (
                        <span
                          className="badge badge-warning"
                          style={{
                            fontSize: "10px",
                            marginTop: "3px",
                            display: "inline-block",
                          }}
                        >
                          First Purchase Only
                        </span>
                      )}
                      {coupon.isMembershipOnly && (
                        <span
                          className="badge badge-primary"
                          style={{
                            fontSize: "10px",
                            marginTop: "3px",
                            marginLeft: "4px",
                            display: "inline-block",
                          }}
                        >
                          Pro Only
                        </span>
                      )}
                      {coupon.excludesMembership && (
                        <span
                          className="badge badge-outline"
                          style={{
                            fontSize: "10px",
                            marginTop: "3px",
                            marginLeft: "4px",
                            display: "inline-block",
                          }}
                        >
                          No Pro
                        </span>
                      )}
                      {coupon.description && (
                        <div
                          style={{
                            fontSize: "11px",
                            color: "#9ca3af",
                            marginTop: "2px",
                          }}
                        >
                          {coupon.description}
                        </div>
                      )}
                    </td>
                    <td>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        {coupon.type === CouponType.PERCENTAGE ? (
                          <Percent size={14} />
                        ) : (
                          <IndianRupee size={14} />
                        )}
                        <span style={{ fontWeight: "600" }}>
                          {coupon.value}
                          {coupon.type === CouponType.PERCENTAGE ? "%" : ""}
                        </span>
                      </div>
                      {coupon.type === CouponType.PERCENTAGE &&
                      coupon.maxDiscount ? (
                        <div style={{ fontSize: "11px", color: "#10b981" }}>
                          Max Cap: ₹{coupon.maxDiscount}
                        </div>
                      ) : null}
                      {coupon.minOrderAmount ? (
                        <div style={{ fontSize: "11px", color: "#9ca3af" }}>
                          Min: ₹{coupon.minOrderAmount}
                        </div>
                      ) : null}
                      {coupon.maxOrderAmount ? (
                        <div style={{ fontSize: "11px", color: "#9ca3af" }}>
                          Max Order: ₹{coupon.maxOrderAmount}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <div
                          style={{
                            flex: 1,
                            height: "6px",
                            background: "var(--muted)",
                            borderRadius: "0px",
                            maxWidth: "100px",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${Math.min(100, (((coupon.usedCount || 0) + (coupon.reservedCount || 0)) / (coupon.usageLimit || 1)) * 100)}%`,
                              background: "var(--primary)",
                              borderRadius: "0px",
                            }}
                          ></div>
                        </div>
                        <span style={{ fontSize: "12px" }}>
                          {coupon.usedCount || 0}
                          {coupon.reservedCount
                            ? ` (+${coupon.reservedCount})`
                            : ""}{" "}
                          / {coupon.usageLimit || "∞"}
                        </span>
                      </div>
                    </td>
                    <td>
                      {isAdmin ? (
                        <button
                          className="btn btn-outline"
                          style={{ padding: "4px 10px", fontSize: "12px" }}
                          onClick={() => toggleStatus(coupon)}
                        >
                          <span
                            className={`badge ${coupon.status === EntityStatus.ACTIVE ? "badge-success" : "badge-danger"}`}
                          >
                            {coupon.status}
                          </span>
                        </button>
                      ) : (
                        <span
                          className={`badge ${coupon.status === EntityStatus.ACTIVE ? "badge-success" : "badge-danger"}`}
                        >
                          {coupon.status}
                        </span>
                      )}
                    </td>
                    {isAdmin && (
                      <td>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            className="btn btn-outline"
                            style={{ padding: "6px 12px" }}
                            onClick={() => openEditModal(coupon)}
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            className="btn btn-outline"
                            style={{ color: "#ef4444", padding: "6px 12px" }}
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
        <div
          className="offcanvas-overlay"
          onClick={() => {
            setShowModal(false);
            setEditingCoupon(null);
          }}
        >
          <div className="offcanvas-panel" onClick={(e) => e.stopPropagation()}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "32px",
              }}
            >
              <h2 style={{ margin: 0 }}>
                {editingCoupon ? "Edit Coupon" : "Create New Coupon"}
              </h2>
              <button
                className="btn btn-outline"
                style={{ padding: "8px" }}
                onClick={() => {
                  setShowModal(false);
                  setEditingCoupon(null);
                }}
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={handleSaveCoupon}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "20px",
                flex: 1,
              }}
            >
              <div className="input-group">
                <label>Coupon Code</label>
                <input
                  type="text"
                  placeholder="E.g. OUTFORMER500"
                  required
                  value={
                    (editingCoupon ? editingCoupon.code : newCoupon.code) ?? ""
                  }
                  onChange={(e) =>
                    editingCoupon
                      ? setEditingCoupon({
                          ...editingCoupon,
                          code: e.target.value,
                        })
                      : setNewCoupon({ ...newCoupon, code: e.target.value })
                  }
                />
              </div>

              <div className="input-group">
                <label>Description</label>
                <input
                  type="text"
                  placeholder="e.g. Flat ₹500 off on orders above ₹2000"
                  required
                  value={
                    (editingCoupon
                      ? editingCoupon.description
                      : newCoupon.description) ?? ""
                  }
                  onChange={(e) =>
                    editingCoupon
                      ? setEditingCoupon({
                          ...editingCoupon,
                          description: e.target.value,
                        })
                      : setNewCoupon({
                          ...newCoupon,
                          description: e.target.value,
                        })
                  }
                />
              </div>

              <div className="form-grid">
                <div className="input-group">
                  <label>Type</label>
                  <CustomSelect
                    value={
                      editingCoupon
                        ? editingCoupon.type
                        : newCoupon.type || CouponType.PERCENTAGE
                    }
                    onChange={(type) =>
                      editingCoupon
                        ? setEditingCoupon({ ...editingCoupon, type })
                        : setNewCoupon({ ...newCoupon, type })
                    }
                    options={[
                      { value: CouponType.PERCENTAGE, label: "Percentage" },
                      { value: CouponType.FIXED, label: "Fixed Amount" },
                    ]}
                  />
                </div>
                <div className="input-group">
                  <label>Value</label>
                  <input
                    type="number"
                    required
                    value={
                      (editingCoupon ? editingCoupon.value : newCoupon.value) ??
                      0
                    }
                    onChange={(e) =>
                      editingCoupon
                        ? setEditingCoupon({
                            ...editingCoupon,
                            value: Number(e.target.value),
                          })
                        : setNewCoupon({
                            ...newCoupon,
                            value: Number(e.target.value),
                          })
                    }
                  />
                </div>
              </div>

              {((editingCoupon ? editingCoupon.type : newCoupon.type) ||
                CouponType.PERCENTAGE) === CouponType.PERCENTAGE && (
                <div className="input-group">
                  <label>Max Discount Cap (₹)</label>
                  <input
                    type="number"
                    placeholder="E.g. 1000 (leave 0 or empty for no cap)"
                    value={
                      (editingCoupon
                        ? editingCoupon.maxDiscount
                        : newCoupon.maxDiscount) ?? ""
                    }
                    onChange={(e) =>
                      editingCoupon
                        ? setEditingCoupon({
                            ...editingCoupon,
                            maxDiscount: Number(e.target.value),
                          })
                        : setNewCoupon({
                            ...newCoupon,
                            maxDiscount: Number(e.target.value),
                          })
                    }
                  />
                </div>
              )}

              <div className="form-grid">
                <div className="input-group">
                  <label>Usage Limit</label>
                  <input
                    type="number"
                    placeholder="Unlimited if empty"
                    value={
                      (editingCoupon
                        ? editingCoupon.usageLimit
                        : newCoupon.usageLimit) ?? ""
                    }
                    onChange={(e) =>
                      editingCoupon
                        ? setEditingCoupon({
                            ...editingCoupon,
                            usageLimit: Number(e.target.value),
                          })
                        : setNewCoupon({
                            ...newCoupon,
                            usageLimit: Number(e.target.value),
                          })
                    }
                  />
                </div>
                <div className="input-group">
                  <label>Usage Per User</label>
                  <input
                    type="number"
                    value={
                      editingCoupon
                        ? editingCoupon.usagePerUser
                        : newCoupon.usagePerUser
                    }
                    onChange={(e) =>
                      editingCoupon
                        ? setEditingCoupon({
                            ...editingCoupon,
                            usagePerUser: Number(e.target.value),
                          })
                        : setNewCoupon({
                            ...newCoupon,
                            usagePerUser: Number(e.target.value),
                          })
                    }
                  />
                </div>
              </div>

              <div className="form-grid">
                <div className="input-group">
                  <label>Min Order (₹)</label>
                  <input
                    type="number"
                    value={
                      (editingCoupon
                        ? editingCoupon.minOrderAmount
                        : newCoupon.minOrderAmount) ?? ""
                    }
                    onChange={(e) =>
                      editingCoupon
                        ? setEditingCoupon({
                            ...editingCoupon,
                            minOrderAmount: Number(e.target.value),
                          })
                        : setNewCoupon({
                            ...newCoupon,
                            minOrderAmount: Number(e.target.value),
                          })
                    }
                  />
                </div>
                <div className="input-group">
                  <label>Max Order (₹)</label>
                  <input
                    type="number"
                    placeholder="No limit if empty"
                    value={
                      (editingCoupon
                        ? editingCoupon.maxOrderAmount
                        : newCoupon.maxOrderAmount) ?? ""
                    }
                    onChange={(e) =>
                      editingCoupon
                        ? setEditingCoupon({
                            ...editingCoupon,
                            maxOrderAmount: Number(e.target.value),
                          })
                        : setNewCoupon({
                            ...newCoupon,
                            maxOrderAmount: Number(e.target.value),
                          })
                    }
                  />
                </div>
              </div>

              <div className="input-group">
                <label>Status</label>
                <CustomSelect
                  value={
                    editingCoupon
                      ? editingCoupon.status
                      : newCoupon.status || EntityStatus.ACTIVE
                  }
                  onChange={(status) =>
                    editingCoupon
                      ? setEditingCoupon({ ...editingCoupon, status })
                      : setNewCoupon({ ...newCoupon, status })
                  }
                  options={[
                    { value: EntityStatus.ACTIVE, label: "Active" },
                    { value: EntityStatus.INACTIVE, label: "Inactive" },
                  ]}
                />
              </div>

              <div className="input-group">
                <label>Start Date</label>
                <input
                  type="datetime-local"
                  value={
                    (editingCoupon
                      ? editingCoupon.startDate
                      : newCoupon.startDate) ?? ""
                  }
                  onChange={(e) =>
                    editingCoupon
                      ? setEditingCoupon({
                          ...editingCoupon,
                          startDate: e.target.value,
                        })
                      : setNewCoupon({
                          ...newCoupon,
                          startDate: e.target.value,
                        })
                  }
                />
              </div>
              <div className="input-group">
                <label>End Date</label>
                <input
                  type="datetime-local"
                  value={
                    (editingCoupon
                      ? editingCoupon.endDate
                      : newCoupon.endDate) ?? ""
                  }
                  onChange={(e) =>
                    editingCoupon
                      ? setEditingCoupon({
                          ...editingCoupon,
                          endDate: e.target.value,
                        })
                      : setNewCoupon({ ...newCoupon, endDate: e.target.value })
                  }
                />
              </div>

              <div
                className="input-group"
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <input
                  type="checkbox"
                  id="isNewUserOnly"
                  checked={Boolean(
                    editingCoupon
                      ? editingCoupon.isNewUserOnly
                      : newCoupon.isNewUserOnly,
                  )}
                  onChange={(e) =>
                    editingCoupon
                      ? setEditingCoupon({
                          ...editingCoupon,
                          isNewUserOnly: e.target.checked,
                        })
                      : setNewCoupon({
                          ...newCoupon,
                          isNewUserOnly: e.target.checked,
                        })
                  }
                  style={{ width: "16px", height: "16px", margin: 0 }}
                />
                <label
                  htmlFor="isNewUserOnly"
                  style={{
                    margin: 0,
                    cursor: "pointer",
                    fontWeight: "600",
                    fontSize: "13px",
                  }}
                >
                  First-time buyer only (Valid for user&apos;s first purchase
                  only)
                </label>
              </div>

              <div
                className="input-group"
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <input
                  type="checkbox"
                  id="isMembershipOnly"
                  checked={Boolean(
                    editingCoupon
                      ? editingCoupon.isMembershipOnly
                      : newCoupon.isMembershipOnly,
                  )}
                  onChange={(e) =>
                    editingCoupon
                      ? setEditingCoupon({
                          ...editingCoupon,
                          isMembershipOnly: e.target.checked,
                          ...(e.target.checked
                            ? { excludesMembership: false }
                            : {}),
                        })
                      : setNewCoupon({
                          ...newCoupon,
                          isMembershipOnly: e.target.checked,
                          ...(e.target.checked
                            ? { excludesMembership: false }
                            : {}),
                        })
                  }
                  style={{ width: "16px", height: "16px", margin: 0 }}
                />
                <label
                  htmlFor="isMembershipOnly"
                  style={{
                    margin: 0,
                    cursor: "pointer",
                    fontWeight: "600",
                    fontSize: "13px",
                  }}
                >
                  Pro members only
                </label>
              </div>

              <div
                className="input-group"
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <input
                  type="checkbox"
                  id="excludesMembership"
                  checked={Boolean(
                    editingCoupon
                      ? editingCoupon.excludesMembership
                      : newCoupon.excludesMembership,
                  )}
                  onChange={(e) =>
                    editingCoupon
                      ? setEditingCoupon({
                          ...editingCoupon,
                          excludesMembership: e.target.checked,
                          ...(e.target.checked
                            ? { isMembershipOnly: false }
                            : {}),
                        })
                      : setNewCoupon({
                          ...newCoupon,
                          excludesMembership: e.target.checked,
                          ...(e.target.checked
                            ? { isMembershipOnly: false }
                            : {}),
                        })
                  }
                  style={{ width: "16px", height: "16px", margin: 0 }}
                />
                <label
                  htmlFor="excludesMembership"
                  style={{
                    margin: 0,
                    cursor: "pointer",
                    fontWeight: "600",
                    fontSize: "13px",
                  }}
                >
                  Exclude Pro members &amp; membership cart
                </label>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  justifyContent: "flex-end",
                  marginTop: "auto",
                  paddingTop: "20px",
                  borderTop: "1px solid var(--border)",
                }}
              >
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
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting
                    ? "Saving..."
                    : editingCoupon
                      ? "Update Coupon"
                      : "Create Coupon"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmState && confirmState.isOpen && (
        <div className="modal-overlay" onClick={() => setConfirmState(null)}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "450px",
              borderRadius: "12px",
              border: "1px solid var(--border)",
              background: "var(--card-bg)",
            }}
          >
            <div
              style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}
            >
              <div
                style={{
                  background: "rgba(239, 68, 68, 0.1)",
                  color: "#ef4444",
                  padding: "10px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Trash2 size={24} />
              </div>
              <div style={{ flex: 1 }}>
                <h3
                  style={{
                    margin: 0,
                    fontSize: "18px",
                    fontWeight: "600",
                    color: "var(--text)",
                  }}
                >
                  {confirmState.title}
                </h3>
                <p
                  style={{
                    margin: "12px 0 24px 0",
                    fontSize: "14px",
                    color: "var(--text-secondary)",
                    lineHeight: "1.5",
                  }}
                >
                  {confirmState.message}
                </p>
                <div
                  style={{
                    display: "flex",
                    gap: "12px",
                    justifyContent: "flex-end",
                  }}
                >
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{
                      padding: "8px 16px",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      cursor: "pointer",
                      fontSize: "14px",
                    }}
                    onClick={() => setConfirmState(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn"
                    style={{
                      padding: "8px 16px",
                      borderRadius: "8px",
                      background: "#ef4444",
                      color: "#fff",
                      cursor: "pointer",
                      border: "none",
                      fontWeight: "600",
                      fontSize: "14px",
                    }}
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
