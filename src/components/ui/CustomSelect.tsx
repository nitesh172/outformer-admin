import { useState, useRef, useEffect } from "react"
import { ChevronDown } from "lucide-react"

interface Option {
  value: string
  label: string
}

interface CustomSelectProps {
  value: string
  onChange: (value: any) => void
  options: Option[]
  disabled?: boolean
}

export function CustomSelect({ value, onChange, options, disabled }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find((opt) => opt.value === value)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: "100%",
          padding: "10px 14px",
          backgroundColor: "var(--background)",
          border: "1px solid var(--border)",
          borderRadius: "0",
          color: "var(--foreground)",
          fontFamily: "inherit",
          fontSize: "14px",
          textAlign: "left",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.6 : 1,
          transition: "all 0.2s ease-in-out",
        }}
        className="select-trigger"
      >
        <span>{selectedOption ? selectedOption.label : "Select..."}</span>
        <ChevronDown size={16} style={{ color: "var(--text-muted)", transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
      </button>

      {isOpen && (
        <ul
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            width: "100%",
            backgroundColor: "var(--card-bg)",
            border: "1px solid var(--border)",
            borderRadius: "0",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.2)",
            zIndex: 9999,
            padding: "4px 0",
            margin: 0,
            listStyle: "none",
            maxHeight: "200px",
            overflowY: "auto",
          }}
          className="select-options-list"
        >
          {options.map((opt) => (
            <li
              key={opt.value}
              onClick={() => {
                onChange(opt.value)
                setIsOpen(false)
              }}
              style={{
                padding: "8px 14px",
                fontSize: "14px",
                color: opt.value === value ? "var(--primary)" : "var(--foreground)",
                backgroundColor: opt.value === value ? "var(--bg-secondary)" : "transparent",
                cursor: "pointer",
                transition: "all 0.15s",
                fontWeight: opt.value === value ? "600" : "400",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--bg-secondary)"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = opt.value === value ? "var(--bg-secondary)" : "transparent"
              }}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
