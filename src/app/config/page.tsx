"use client"

import { useEffect, useState } from "react"
import {
  Settings,
  Save,
  RefreshCw,
  Plus,
  Trash2,
  Code,
  MessageSquare,
  BookOpen,
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

export default function ConfigPage() {
  const { isAdmin } = useAuth()
  const { showToast } = useToast()
  const [config, setConfig] = useState<ConfigData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

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
      const response = await fetch(LOCAL_API_URL, { headers })
      const data = await response.json()
      setConfig(data)
      if (data.categories?.length > 0) {
        setActiveCategory(data.categories[0].id)
      }
    } catch (error) {
      console.error("Error fetching config:", error)
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
      console.error("Error saving config:", error)
      showToast("Error saving configuration", "error")
    } finally {
      setSaving(false)
    }
  }

  const updatePrompt = (id: string, value: string) => {
    if (!config) return
    setConfig({
      ...config,
      prompts: { ...config.prompts, [id]: value },
    })
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

  const addCategory = () => {
    if (!config) return
    const label = prompt("Enter category label (e.g. Design):")
    if (!label) return
    const id = label.toLowerCase().replace(/\s+/g, "-")

    if (config.categories.some((c) => c.id === id)) {
      showToast("Category already exists!", "error")
      return
    }

    const newCategories = [...config.categories, { id, label }]
    const newSpecializations = { ...config.specializations, [id]: [] }
    const newPrompts = { ...config.prompts, [id]: "" }

    setConfig({
      ...config,
      categories: newCategories,
      specializations: newSpecializations,
      prompts: newPrompts,
    })
    setActiveCategory(id)
  }

  const removeCategory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!config) return
    if (
      !confirm(
        `Are you sure you want to remove the category "${config.categories.find((c) => c.id === id)?.label}" and all its specializations?`,
      )
    )
      return

    const newCategories = config.categories.filter((c) => c.id !== id)
    const { [id]: _, ...newSpecializations } = config.specializations
    const { [id]: __, ...newPrompts } = config.prompts

    setConfig({
      ...config,
      categories: newCategories,
      specializations: newSpecializations,
      prompts: newPrompts,
    })
    if (activeCategory === id) {
      setActiveCategory(newCategories.length > 0 ? newCategories[0].id : null)
    }
  }

  const addSpecialization = () => {
    if (!config || !activeCategory) return
    const label = prompt("Enter specialization label (e.g. Figma):")
    if (!label) return
    const id = label.toLowerCase().replace(/\s+/g, "-")

    const currentSpecs = config.specializations[activeCategory] || []
    if (currentSpecs.some((s) => s.id === id)) {
      showToast("Specialization already exists!", "error")
      return
    }

    const newSpecs = [...currentSpecs, { id, label, prompt: "" }]
    setConfig({
      ...config,
      specializations: {
        ...config.specializations,
        [activeCategory]: newSpecs,
      },
    })
  }

  const removeSpecialization = (id: string) => {
    if (!config || !activeCategory) return
    const newSpecs = config.specializations[activeCategory].filter(
      (s) => s.id !== id,
    )
    setConfig({
      ...config,
      specializations: {
        ...config.specializations,
        [activeCategory]: newSpecs,
      },
    })
  }

  if (loading)
    return (
      <div
        style={{ display: "flex", justifyContent: "center", padding: "100px" }}
      >
        <div className="loader"></div>
      </div>
    )

  if (!config)
    return (
      <div className="card" style={{ textAlign: "center", margin: "40px" }}>
        <p>Failed to load configuration data. Please try again later.</p>
        <button
          className="btn btn-primary"
          style={{ marginTop: "16px" }}
          onClick={fetchConfig}
        >
          Retry
        </button>
      </div>
    )

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
      <div
        className="title-section"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
        }}
      >
        <div>
          <h1>Backend Configuration</h1>
          <p>Manage categories, specializations, and system instructions</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <RefreshCw className="spin" size={20} />
          ) : (
            <Save size={20} />
          )}
          {saving ? "Saving..." : "Save Configuration"}
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "300px 1fr",
          gap: "32px",
        }}
      >
        {/* Sidebar: Categories & Global Settings */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div className="card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
              }}
            >
              <h3 style={{ fontSize: "16px", fontWeight: "700" }}>
                Categories
              </h3>
              <button
                style={{
                  color: "var(--primary)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
                onClick={addCategory}
              >
                <Plus size={18} />
              </button>
            </div>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              {config?.categories?.map((cat) => (
                <div
                  key={cat.id}
                  style={{ display: "flex", gap: "8px", alignItems: "center" }}
                >
                  <button
                    className={`nav-item ${activeCategory === cat.id ? "active" : ""}`}
                    style={{
                      flex: 1,
                      justifyContent: "flex-start",
                      border: "none",
                      textAlign: "left",
                    }}
                    onClick={() => setActiveCategory(cat.id)}
                  >
                    {cat.label}
                  </button>
                  <button
                    onClick={(e) => removeCategory(cat.id, e)}
                    style={{
                      color: "#ef4444",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "8px",
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h3
              style={{
                fontSize: "16px",
                fontWeight: "700",
                marginBottom: "16px",
              }}
            >
              Global Settings
            </h3>
            <p
              style={{
                fontSize: "12px",
                color: "#9ca3af",
                marginBottom: "12px",
              }}
            >
              These apply across all categories.
            </p>
            <div className="badge badge-success">v2.1 API Active</div>
          </div>
        </div>

        {/* Main Content Area */}
        <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
          {/* Global Instructions Section */}
          {isAdmin && (
            <div className="card">
              <h3
                style={{
                  fontSize: "18px",
                  fontWeight: "700",
                  marginBottom: "20px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <MessageSquare size={20} /> Global Instructions
              </h3>
              <div className="input-group">
                <label>Common Instructions (All Chats)</label>
                <textarea
                  rows={5}
                  value={config.commonInstructions}
                  onChange={(e) =>
                    updateInstruction("commonInstructions", e.target.value)
                  }
                  style={{ fontSize: "13px", lineHeight: "1.6" }}
                />
              </div>
              <div className="input-group">
                <label>DSA Specific Instructions</label>
                <textarea
                  rows={5}
                  value={config.dsaInstructions}
                  onChange={(e) =>
                    updateInstruction("dsaInstructions", e.target.value)
                  }
                  style={{ fontSize: "13px", lineHeight: "1.6" }}
                />
              </div>
              <div className="input-group">
                <label>Critical Instructions (Resume usage rules, persona, first-person narrative)</label>
                <textarea
                  rows={5}
                  value={config.criticalInstructions || ""}
                  onChange={(e) =>
                    updateInstruction("criticalInstructions", e.target.value)
                  }
                  style={{ fontSize: "13px", lineHeight: "1.6" }}
                />
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label>Screen Snippet Instructions (rules for extracted screen text queries)</label>
                <textarea
                  rows={5}
                  value={config.snipInstructions || ""}
                  onChange={(e) =>
                    updateInstruction("snipInstructions", e.target.value)
                  }
                  style={{ fontSize: "13px", lineHeight: "1.6" }}
                />
              </div>
            </div>
          )}

          {/* Active Category Specifics */}
          {activeCategory && (
            <>
              {/* Specializations */}
              <div className="card">
                <h3
                  style={{
                    fontSize: "18px",
                    fontWeight: "700",
                    marginBottom: "20px",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <BookOpen size={20} />{" "}
                  {
                    config.categories.find((c) => c.id === activeCategory)
                      ?.label
                  }{" "}
                  Specializations
                </h3>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px",
                  }}
                >
                  {config.specializations[activeCategory]?.map((spec, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: "20px",
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid var(--border)",
                        borderRadius: "12px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span style={{ fontSize: "15px", fontWeight: "600" }}>{spec.label}</span>
                        <button
                          style={{
                            color: "#ef4444",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: "4px",
                          }}
                          onClick={() => removeSpecialization(spec.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="input-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: "12px", color: "#9ca3af", marginBottom: "4px" }}>
                          Custom Prompt for {spec.label} (Optional)
                        </label>
                        <textarea
                          rows={3}
                          value={spec.prompt || ""}
                          placeholder={`Enter custom rules/prompt for ${spec.label}...`}
                          onChange={(e) => {
                            const newSpecs = [...config.specializations[activeCategory]]
                            newSpecs[idx] = { ...spec, prompt: e.target.value }
                            setConfig({
                              ...config,
                              specializations: {
                                ...config.specializations,
                                [activeCategory]: newSpecs,
                              },
                            })
                          }}
                          style={{
                            fontSize: "13px",
                            lineHeight: "1.6",
                            marginTop: "4px",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                  <button
                    className="btn btn-outline"
                    style={{ borderStyle: "dashed", fontSize: "14px", alignSelf: "flex-start" }}
                    onClick={addSpecialization}
                  >
                    <Plus size={16} /> Add Specialization
                  </button>
                </div>
              </div>

              {/* Category Prompt */}
              {isAdmin && (
                <div className="card">
                  <h3
                    style={{
                      fontSize: "18px",
                      fontWeight: "700",
                      marginBottom: "20px",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <Code size={20} /> System Prompt:{" "}
                    {
                      config.categories.find((c) => c.id === activeCategory)
                        ?.label
                    }
                  </h3>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <textarea
                      rows={8}
                      value={config.prompts[activeCategory] || ""}
                      onChange={(e) =>
                        updatePrompt(activeCategory, e.target.value)
                      }
                      style={{
                        fontSize: "13px",
                        lineHeight: "1.6",
                        fontFamily: "monospace",
                      }}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
