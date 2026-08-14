"use client"

import { useEffect, useState, useMemo } from "react"
import {
  Save,
  RefreshCw,
  Plus,
  Trash2,
  MessageSquare,
  ChevronRight,
  ArrowLeft,
  Search,
  Sparkles,
  X,
  Edit2
} from "lucide-react"
import { appCheck } from "@/lib/firebase"
import { getToken } from "firebase/app-check"
import { useAuth } from "@/lib/AuthContext"
import { useToast } from "@/lib/ToastContext"

interface Specialization {
  id: string
  label: string
  prompt?: string
}

interface ConfigData {
  categories: Array<{ id: string; label: string }>
  specializations: Record<string, Array<Specialization>>
  prompts: Record<string, string>
  commonInstructions: string
  dsaInstructions: string
  criticalInstructions: string
  snipInstructions: string
}

const LOCAL_API_URL = "/api/config"

type ViewState =
  | { type: "categories" }
  | { type: "category-detail"; categoryId: string }
  | { type: "specialization-detail"; categoryId: string; specializationId: string };

type OffcanvasState =
  | { type: null }
  | { type: "add-category" }
  | { type: "edit-category"; categoryId: string; label: string }
  | { type: "add-specialization"; categoryId: string }
  | { type: "edit-specialization"; categoryId: string; specializationId: string; label: string; prompt: string };

export default function ConfigPage() {
  const { isAdmin, user } = useAuth()
  const { showToast } = useToast()
  const [config, setConfig] = useState<ConfigData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Drill-down view state
  const [viewState, setViewState] = useState<ViewState>({ type: "categories" })
  const [activeTab, setActiveTab] = useState<"categories" | "global">("categories")

  // Search state for specializations
  const [specSearchQuery, setSpecSearchQuery] = useState("")

  // Offcanvas state
  const [offcanvas, setOffcanvas] = useState<OffcanvasState>({ type: null })
  const [formLabel, setFormLabel] = useState("")
  const [formPrompt, setFormPrompt] = useState("")

  // Custom UI confirmation modal state
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void
  } | null>(null)

  const openOffcanvas = (state: OffcanvasState) => {
    setOffcanvas(state)
    if (state.type === "edit-category") {
      setFormLabel(state.label)
      setFormPrompt("")
    } else if (state.type === "edit-specialization") {
      setFormLabel(state.label)
      setFormPrompt(state.prompt)
    } else {
      setFormLabel("")
      setFormPrompt("")
    }
  }

  async function fetchConfig() {
    setLoading(true)
    try {
      const headers: Record<string, string> = {}
      if (appCheck) {
        try {
          const result = await getToken(appCheck)
          headers["X-Firebase-AppCheck"] = result.token
        } catch (err) {
          console.warn("App Check token fetch failed", err)
        }
      }
      const token = await user?.getIdToken()
      if (token) {
        headers["Authorization"] = `Bearer ${token}`
      }
      const response = await fetch(LOCAL_API_URL, { headers })
      const data = await response.json()
      setConfig(data)
    } catch (error) {
      console.warn("Error fetching config:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchConfig()
  }, [])

  const handleSave = async () => {
    if (!config) return
    setSaving(true)
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      }

      if (appCheck) {
        try {
          const result = await getToken(appCheck)
          headers["X-Firebase-AppCheck"] = result.token
        } catch (err) {
          console.warn("App Check token fetch failed", err)
        }
      }

      const token = await user?.getIdToken()
      if (token) {
        headers["Authorization"] = `Bearer ${token}`
      }

      const response = await fetch(LOCAL_API_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(config),
      })
      if (response.ok) {
        showToast("Configuration saved successfully!", "success")
      } else {
        showToast("Failed to save configuration", "error")
      }
    } catch (error) {
      console.warn("Error saving config:", error)
      showToast("Error saving configuration", "error")
    } finally {
      setSaving(false)
    }
  }


  const updateInstruction = (
    field: "commonInstructions" | "dsaInstructions" | "criticalInstructions" | "snipInstructions",
    value: string,
  ) => {
    if (!config) return
    setConfig({
      ...config,
      [field]: value,
    })
  }

  const handleAddCategorySubmit = (label: string) => {
    if (!config) return
    if (!label.trim()) return
    const id = label.trim().toLowerCase().replace(/\s+/g, "-")

    if (config.categories.some((c) => c.id === id)) {
      showToast("Category already exists!", "error")
      return
    }

    const newCategories = [...config.categories, { id, label: label.trim() }]
    const newSpecializations = { ...config.specializations, [id]: [] }
    const newPrompts = { ...config.prompts, [id]: "" }

    setConfig({
      ...config,
      categories: newCategories,
      specializations: newSpecializations,
      prompts: newPrompts,
    })
    setOffcanvas({ type: null })
    setViewState({ type: "category-detail", categoryId: id })
  }

  const handleEditCategorySubmit = (categoryId: string, newLabel: string) => {
    if (!config) return
    if (!newLabel.trim()) return

    const newCategories = config.categories.map((c) =>
      c.id === categoryId ? { ...c, label: newLabel.trim() } : c
    )

    setConfig({
      ...config,
      categories: newCategories,
    })
    setOffcanvas({ type: null })
    showToast("Category updated", "success")
  }

  const removeCategory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!config) return

    const categoryLabel = config.categories.find((c) => c.id === id)?.label || id

    setConfirmState({
      isOpen: true,
      title: "Remove Category",
      message: `Are you sure you want to remove the category "${categoryLabel}" and all its specializations?`,
      onConfirm: () => {
        const newCategories = config.categories.filter((c) => c.id !== id)
        const newSpecializations = { ...config.specializations }
        delete newSpecializations[id]
        const newPrompts = { ...config.prompts }
        delete newPrompts[id]

        setConfig({
          ...config,
          categories: newCategories,
          specializations: newSpecializations,
          prompts: newPrompts,
        })
        setViewState({ type: "categories" })
        setConfirmState(null)
        showToast("Category removed", "success")
      }
    })
  }

  const handleAddSpecializationSubmit = (categoryId: string, label: string) => {
    if (!config) return
    if (!label.trim()) return
    const id = label.trim().toLowerCase().replace(/\s+/g, "-")

    const currentSpecs = config.specializations[categoryId] || []
    if (currentSpecs.some((s) => s.id === id)) {
      showToast("Specialization already exists!", "error")
      return
    }

    const newSpecs = [...currentSpecs, { id, label: label.trim(), prompt: "" }]
    setConfig({
      ...config,
      specializations: {
        ...config.specializations,
        [categoryId]: newSpecs,
      },
    })
    setOffcanvas({ type: null })
    setViewState({ type: "specialization-detail", categoryId, specializationId: id })
  }

  const handleEditSpecializationSubmit = (categoryId: string, specializationId: string, newLabel: string, newPrompt: string) => {
    if (!config) return
    if (!newLabel.trim()) return

    const currentSpecs = config.specializations[categoryId] || []
    const newSpecs = currentSpecs.map((s) =>
      s.id === specializationId ? { ...s, label: newLabel.trim(), prompt: newPrompt } : s
    )

    setConfig({
      ...config,
      specializations: {
        ...config.specializations,
        [categoryId]: newSpecs,
      },
    })
    setOffcanvas({ type: null })
    showToast("Specialization updated", "success")
  }

  const removeSpecialization = (categoryId: string, specId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!config) return

    const specLabel = config.specializations[categoryId]?.find((s) => s.id === specId)?.label || specId

    setConfirmState({
      isOpen: true,
      title: "Remove Specialization",
      message: `Are you sure you want to remove the specialization "${specLabel}"?`,
      onConfirm: () => {
        const newSpecs = config.specializations[categoryId].filter(
          (s) => s.id !== specId,
        )
        setConfig({
          ...config,
          specializations: {
            ...config.specializations,
            [categoryId]: newSpecs,
          },
        })
        if (viewState.type === "specialization-detail" && viewState.specializationId === specId) {
          setViewState({ type: "category-detail", categoryId })
        }
        setConfirmState(null)
        showToast("Specialization removed", "success")
      }
    })
  }

  // Filtered specializations for Level 2 search
  const filteredSpecs = useMemo(() => {
    if (viewState.type !== "category-detail" || !config) return []
    const specs = config.specializations[viewState.categoryId] || []
    if (!specSearchQuery.trim()) return specs
    return specs.filter(s => s.label.toLowerCase().includes(specSearchQuery.toLowerCase()))
  }, [config, viewState, specSearchQuery])

  if (loading)
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "100px" }}>
        <div className="loader"></div>
      </div>
    )

  if (!config)
    return (
      <div className="card" style={{ textAlign: "center", margin: "40px" }}>
        <p>Failed to load configuration data. Please try again later.</p>
        <button className="btn btn-primary" style={{ marginTop: "16px" }} onClick={fetchConfig}>
          Retry
        </button>
      </div>
    )

  const promptEditorStyle = {
    fontFamily: "'Fira Code', 'Consolas', monospace",
    fontSize: "14px",
    lineHeight: "1.6",
    padding: "16px",
    borderRadius: "12px",
    border: "1px solid var(--border)",
    background: "var(--bg-secondary)",
    color: "var(--text)",
    width: "100%",
    boxSizing: "border-box" as const,
    resize: "vertical" as const,
    outline: "none",
    minHeight: "350px",
    transition: "border-color 0.2s"
  };

  return (
    <div style={{  width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px", padding: "0" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px"
        }}
      >
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: "800", display: "flex", alignItems: "center", gap: "8px" }}>
            <Sparkles size={28} color="var(--primary)" /> Configuration
          </h1>
        </div>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
          style={{ padding: "10px 20px", fontWeight: "bold", borderRadius: "10px" }}
        >
          {saving ? <RefreshCw className="spin" size={18} /> : <Save size={18} />}
          {saving ? "Saving..." : "Save Config"}
        </button>
      </div>

      {/* Tabs (only visible when not in drill-down details view on mobile) */}
      <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid var(--border)", paddingBottom: "8px" }}>
        <button
          onClick={() => {
            setActiveTab("categories")
            setViewState({ type: "categories" })
          }}
          style={{
            padding: "10px 20px", borderRadius: "8px",
            background: activeTab === "categories" ? "var(--primary)" : "transparent",
            color: activeTab === "categories" ? "#fff" : "var(--text-muted)",
            border: "none", cursor: "pointer", fontWeight: "600",
            transition: "all 0.2s"
          }}
        >
          Categories & Prompts
        </button>
        {isAdmin && (
          <button
            onClick={() => setActiveTab("global")}
            style={{
              padding: "10px 20px", borderRadius: "8px",
              background: activeTab === "global" ? "var(--primary)" : "transparent",
              color: activeTab === "global" ? "#fff" : "var(--text-muted)",
              border: "none", cursor: "pointer", fontWeight: "600",
              transition: "all 0.2s"
            }}
          >
            Global Instructions
          </button>
        )}
      </div>

      {/* Categories View */}
      {activeTab === "categories" && (
        <div style={{ width: "100%" }}>
          {viewState.type === "categories" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h2 style={{ fontSize: "20px", fontWeight: "700" }}>Manage Categories</h2>
                <button
                  className="btn btn-primary"
                  onClick={() => openOffcanvas({ type: "add-category" })}
                  style={{ display: "flex", alignItems: "center", gap: "6px", borderRadius: "8px", padding: "8px 16px" }}
                >
                  <Plus size={16} /> New Category
                </button>
              </div>

              {/* Grid of categories */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
                {config.categories.map((cat) => {
                  const specCount = config.specializations[cat.id]?.length || 0;
                  return (
                    <div
                      key={cat.id}
                      onClick={() => setViewState({ type: "category-detail", categoryId: cat.id })}
                      style={{
                        padding: "20px",
                        background: "var(--bg-secondary)",
                        border: "1px solid var(--border)",
                        borderRadius: "12px",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        minHeight: "120px",
                        transition: "all 0.2s",
                        position: "relative"
                      }}
                      className="category-card"
                    >
                      <div>
                        <h3 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "4px" }}>{cat.label}</h3>
                        <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                          {specCount} specialization{specCount !== 1 ? "s" : ""}
                        </p>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px" }}>
                        <span style={{ fontSize: "12px", color: "var(--primary)", fontWeight: "600", display: "flex", alignItems: "center", gap: "4px" }}>
                          Configure <ChevronRight size={14} />
                        </span>

                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }} onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => openOffcanvas({ type: "edit-category", categoryId: cat.id, label: cat.label })}
                            style={{
                              color: "var(--primary)",
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: "4px",
                              opacity: 0.8
                            }}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={(e) => removeCategory(cat.id, e)}
                            style={{
                              color: "#ef4444",
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: "4px",
                              opacity: 0.6
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Level 2: Category Details (Base Prompt & Specializations) */}
          {viewState.type === "category-detail" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              {/* Back Nav */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  onClick={() => setViewState({ type: "categories" })}
                  style={{
                    background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
                    color: "var(--primary)", fontWeight: "600", fontSize: "14px"
                  }}
                >
                  <ArrowLeft size={16} /> Back to Categories
                </button>
              </div>

              {/* Title Card */}
              <div className="card" style={{ padding: "24px" }}>
                <h2 style={{ fontSize: "24px", fontWeight: "800", marginBottom: "4px" }}>
                  {config.categories.find(c => c.id === viewState.categoryId)?.label}
                </h2>
                <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>Configure base prompt and individual specializations.</p>
              </div>



              {/* Specializations Searchable List */}
              <div className="card" style={{ padding: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", marginBottom: "16px" }}>
                  <div>
                    <h3 style={{ fontSize: "18px", fontWeight: "700" }}>Specializations</h3>
                    <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>Search and configure custom prompts.</p>
                  </div>
                  <button
                    className="btn btn-outline"
                    onClick={() => openOffcanvas({ type: "add-specialization", categoryId: viewState.categoryId })}
                    style={{ padding: "6px 12px", fontSize: "14px" }}
                  >
                    <Plus size={16} /> Add Specialization
                  </button>
                </div>

                {/* Search box if there are many */}
                <div style={{ position: "relative", marginBottom: "16px" }}>
                  <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                  <input
                    type="text"
                    placeholder="Search specializations..."
                    value={specSearchQuery}
                    onChange={(e) => setSpecSearchQuery(e.target.value)}
                    style={{
                      width: "100%", padding: "10px 12px 10px 36px", borderRadius: "8px",
                      border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text)"
                    }}
                  />
                </div>

                {/* List */}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "400px", overflowY: "auto", paddingRight: "4px" }}>
                  {filteredSpecs.length === 0 ? (
                    <div style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)", fontSize: "14px" }}>
                      No specializations found.
                    </div>
                  ) : (
                    filteredSpecs.map((spec) => (
                      <div
                        key={spec.id}
                        onClick={() => setViewState({ type: "specialization-detail", categoryId: viewState.categoryId, specializationId: spec.id })}
                        style={{
                          display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px",
                          background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "8px", cursor: "pointer",
                          transition: "background 0.2s"
                        }}
                      >
                        <span style={{ fontWeight: "600" }}>{spec.label}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                            {spec.prompt ? "Custom prompt set" : "No custom prompt"}
                          </span>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }} onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => openOffcanvas({
                                type: "edit-specialization",
                                categoryId: viewState.categoryId,
                                specializationId: spec.id,
                                label: spec.label,
                                prompt: spec.prompt || ""
                              })}
                              style={{
                                color: "var(--primary)", background: "none", border: "none", cursor: "pointer", padding: "4px", opacity: 0.8
                              }}
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={(e) => removeSpecialization(viewState.categoryId, spec.id, e)}
                              style={{
                                color: "#ef4444", background: "none", border: "none", cursor: "pointer", padding: "4px", opacity: 0.7
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          <ChevronRight size={16} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Level 3: Specialization Details (Editor) */}
          {viewState.type === "specialization-detail" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              {/* Back Nav */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  onClick={() => setViewState({ type: "category-detail", categoryId: viewState.categoryId })}
                  style={{
                    background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
                    color: "var(--primary)", fontWeight: "600", fontSize: "14px"
                  }}
                >
                  <ArrowLeft size={16} /> Back to Category
                </button>
              </div>

              {/* Content Box */}
              <div className="card" style={{ padding: "24px" }}>
                <h2 style={{ fontSize: "22px", fontWeight: "800", marginBottom: "4px" }}>
                  {config.specializations[viewState.categoryId]?.find(s => s.id === viewState.specializationId)?.label}
                </h2>
                <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
                  Custom instructions for this specialization. These override or extend the base prompt.
                </p>

                <div style={{ marginTop: "20px" }}>
                  <textarea
                    value={config.specializations[viewState.categoryId]?.find(s => s.id === viewState.specializationId)?.prompt || ""}
                    onChange={(e) => {
                      const specIndex = config.specializations[viewState.categoryId].findIndex(s => s.id === viewState.specializationId);
                      if (specIndex === -1) return;
                      const newSpecs = [...config.specializations[viewState.categoryId]];
                      newSpecs[specIndex] = { ...newSpecs[specIndex], prompt: e.target.value };
                      setConfig({
                        ...config,
                        specializations: {
                          ...config.specializations,
                          [viewState.categoryId]: newSpecs,
                        },
                      })
                    }}
                    style={promptEditorStyle}
                    placeholder="Enter custom instructions here..."
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Global Instructions Tab */}
      {activeTab === "global" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px", width: "100%" }}>
          <div className="card" style={{ padding: "24px" }}>
            <h2 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
              <MessageSquare size={20} color="var(--primary)" /> Global Instructions
            </h2>
            <p style={{ color: "var(--text-muted)", marginBottom: "24px", fontSize: "14px" }}>
              System-wide rules applied directly to all backend sessions.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <div>
                <label style={{ fontSize: "14px", fontWeight: "600", marginBottom: "8px", display: "block" }}>
                  Common Instructions
                </label>
                <textarea
                  rows={6}
                  value={config.commonInstructions}
                  onChange={(e) => updateInstruction("commonInstructions", e.target.value)}
                  style={{ ...promptEditorStyle, minHeight: "150px" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "14px", fontWeight: "600", marginBottom: "8px", display: "block" }}>
                  DSA Specific Instructions
                </label>
                <textarea
                  rows={6}
                  value={config.dsaInstructions}
                  onChange={(e) => updateInstruction("dsaInstructions", e.target.value)}
                  style={{ ...promptEditorStyle, minHeight: "150px" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "14px", fontWeight: "600", marginBottom: "8px", display: "block" }}>
                  Critical Instructions (Persona, narrative rules)
                </label>
                <textarea
                  rows={6}
                  value={config.criticalInstructions || ""}
                  onChange={(e) => updateInstruction("criticalInstructions", e.target.value)}
                  style={{ ...promptEditorStyle, minHeight: "150px" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "14px", fontWeight: "600", marginBottom: "8px", display: "block" }}>
                  Screen Snippet Instructions
                </label>
                <textarea
                  rows={6}
                  value={config.snipInstructions || ""}
                  onChange={(e) => updateInstruction("snipInstructions", e.target.value)}
                  style={{ ...promptEditorStyle, minHeight: "150px" }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Offcanvas Drawer */}
      {offcanvas.type !== null && (
        <div className="offcanvas-overlay" onClick={() => setOffcanvas({ type: null })}>
          <div className="offcanvas-panel" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
              <h2 style={{ margin: 0, fontSize: "22px", fontWeight: "700" }}>
                {offcanvas.type === "add-category" && "Add New Category"}
                {offcanvas.type === "edit-category" && "Edit Category"}
                {offcanvas.type === "add-specialization" && "Add New Specialization"}
                {offcanvas.type === "edit-specialization" && "Edit Specialization"}
              </h2>
              <button className="btn btn-outline" style={{ padding: '8px' }} onClick={() => setOffcanvas({ type: null })}>
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (offcanvas.type === "add-category") {
                  handleAddCategorySubmit(formLabel)
                } else if (offcanvas.type === "edit-category") {
                  handleEditCategorySubmit(offcanvas.categoryId, formLabel)
                } else if (offcanvas.type === "add-specialization") {
                  handleAddSpecializationSubmit(offcanvas.categoryId, formLabel)
                } else if (offcanvas.type === "edit-specialization") {
                  handleEditSpecializationSubmit(offcanvas.categoryId, offcanvas.specializationId, formLabel, formPrompt)
                }
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}
            >
              <div className="input-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: "14px", fontWeight: "600" }}>Label</label>
                <input
                  type="text"
                  placeholder={
                    offcanvas.type.includes("category")
                      ? "E.g. Design"
                      : "E.g. Figma"
                  }
                  required
                  value={formLabel}
                  onChange={(e) => setFormLabel(e.target.value)}
                  style={{
                    width: "100%", padding: "10px 12px", borderRadius: "8px",
                    border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text)"
                  }}
                />
              </div>

              {offcanvas.type === "edit-specialization" && (
                <div className="input-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: "14px", fontWeight: "600" }}>Custom Instructions (Prompt)</label>
                  <textarea
                    rows={12}
                    placeholder="Enter custom instructions for this specialization..."
                    value={formPrompt}
                    onChange={(e) => setFormPrompt(e.target.value)}
                    style={{
                      ...promptEditorStyle,
                      minHeight: "250px"
                    }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', marginTop: 'auto', paddingTop: '20px' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid var(--border)", cursor: "pointer" }}
                  onClick={() => setOffcanvas({ type: null })}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1, padding: "10px", borderRadius: "8px", background: "var(--primary)", color: "#fff", cursor: "pointer", fontWeight: "600" }}
                >
                  Save
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
  )
}
