"use client";

import { useEffect, useState } from "react";
import { Shield, Plus, Pencil, Trash2, X, Mail } from "lucide-react";
import { useToast } from "@/lib/ToastContext";
import { useAuth } from "@/lib/AuthContext";

interface TeamMember {
  id: string;
  displayName: string;
  email: string;
  role: 'admin' | 'team';
  createdAt?: any;
}

export default function TeamsPage() {
  const { showToast } = useToast();
  const { isAdmin, user } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDrawer, setShowDrawer] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    displayName: "",
    email: "",
    role: "team" as 'admin' | 'team'
  });

  async function fetchTeam() {
    setLoading(true);
    try {
      const token = await user?.getIdToken();
      const response = await fetch("/api/team", {
        headers: token ? { "Authorization": `Bearer ${token}` } : {}
      });
      if (!response.ok) {
        throw new Error("Failed to fetch team members");
      }
      const list = await response.json() as TeamMember[];
      setMembers(list);
    } catch (error) {
      console.error("Error fetching team members:", error);
      showToast("Failed to fetch team members", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTeam();
  }, []);

  const handleOpenAdd = () => {
    setEditingMember(null);
    setFormData({
      displayName: "",
      email: "",
      role: "team"
    });
    setShowDrawer(true);
  };

  const handleOpenEdit = (member: TeamMember) => {
    setEditingMember(member);
    setFormData({
      displayName: member.displayName,
      email: member.email,
      role: member.role
    });
    setShowDrawer(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const token = await user?.getIdToken();
      const apiResponse = await fetch("/api/team", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          email: formData.email.trim().toLowerCase(),
          displayName: formData.displayName || undefined,
          role: formData.role === 'admin' ? 'ADMIN' : 'TEAM_MEMBER'
        })
      });
      if (!apiResponse.ok) {
        const errorData = await apiResponse.json();
        throw new Error(errorData.error || "Failed to update custom claims");
      }

      showToast(editingMember ? "Team member updated successfully" : "Team member added successfully", "success");
      setShowDrawer(false);
      fetchTeam();
    } catch (error: any) {
      console.error("Error saving team member:", error);
      showToast(error.message || "Failed to save team member", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const member = members.find(m => m.id === id);
    if (!member) return;
    if (!confirm("Are you sure you want to remove this team member?")) return;
    try {
      const token = await user?.getIdToken();
      await fetch("/api/team", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          email: member.email,
          action: "DELETE"
        })
      });

      showToast("Team member removed successfully", "success");
      fetchTeam();
    } catch (error) {
      console.error("Error removing team member:", error);
      showToast("Failed to remove team member", "error");
    }
  };

  return (
    <div>
      <div className="title-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1>Teams Management</h1>
          <p>Configure team members and administrative access levels</p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={handleOpenAdd}>
            <Plus size={20} />
            Add Member
          </button>
        )}
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Member Info</th>
              <th>Email Address</th>
              <th>Access Level</th>
              {isAdmin && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(3)].map((_, i) => (
                <tr key={i}>
                  <td colSpan={4}>
                    <div className="skeleton" style={{ height: '36px', borderRadius: '0px' }}></div>
                  </td>
                </tr>
              ))
            ) : members.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '40px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '48px 24px' }}>
                    <Shield size={48} style={{ color: '#9ca3af', opacity: 0.5 }} />
                    <div style={{ fontWeight: '700', fontSize: '16px', color: 'var(--foreground)' }}>No Team Members Found</div>
                    <div style={{ fontSize: '13px', color: '#9ca3af', maxWidth: '280px' }}>
                      There are no registered administrators or team members. Click the button above to add one.
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              members.map((member) => (
                <tr key={member.id}>
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
                        {(member.displayName || member.email || "?")[0].toUpperCase()}
                      </div>
                      <div style={{ fontWeight: '600', color: 'var(--foreground)' }}>{member.displayName || "Unknown Member"}</div>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: '13px', color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Mail size={14} style={{ color: '#9ca3af' }} />
                      {member.email}
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${member.role === 'admin' ? 'badge-success' : 'badge-warning'}`}>
                      {member.role?.toUpperCase()}
                    </span>
                  </td>
                  {isAdmin && (
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          className="btn btn-outline"
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                          onClick={() => handleOpenEdit(member)}
                        >
                          <Pencil size={12} /> Edit
                        </button>
                        <button
                          className="btn btn-outline"
                          style={{ color: '#ef4444', padding: '6px 12px' }}
                          onClick={() => handleDelete(member.id)}
                        >
                          <Trash2 size={14} />
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

      {showDrawer && (
        <div className="offcanvas-overlay" onClick={() => setShowDrawer(false)}>
          <div className="offcanvas-panel" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
              <h2 style={{ margin: 0 }}>{editingMember ? 'Edit Team Member' : 'Add Team Member'}</h2>
              <button className="btn btn-outline" style={{ padding: '8px' }} onClick={() => setShowDrawer(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
              <div className="input-group">
                <label>Email Address</label>
                <input
                  type="email"
                  placeholder="name@example.com"
                  required
                  disabled={!!editingMember}
                  style={editingMember ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
                {!editingMember && (
                  <span style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
                    Note: The user must already have a registered account to be added to the team.
                  </span>
                )}
              </div>

              <div className="input-group">
                <label>Access Level Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                >
                  <option value="team">Team Member</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowDrawer(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : editingMember ? 'Update Role' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
