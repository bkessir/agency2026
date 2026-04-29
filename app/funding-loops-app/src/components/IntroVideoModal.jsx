import React, { useEffect } from "react"

export default function IntroVideoModal({ open, onClose }) {
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handler)
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", handler)
      document.body.style.overflow = ""
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="AIM Pronghorn 404 intro video"
      style={{
        position: "fixed", inset: 0,
        background: "rgba(15, 23, 42, 0.85)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
        animation: "fade-in 0.25s ease forwards",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 960,
          background: "#000",
          borderRadius: 14,
          overflow: "hidden",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
          position: "relative",
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close intro video"
          style={{
            position: "absolute", top: 10, right: 10, zIndex: 2,
            width: 36, height: 36, borderRadius: "50%",
            background: "rgba(0,0,0,0.6)",
            border: "1px solid rgba(255,255,255,0.2)",
            color: "#fff", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, lineHeight: 1, fontWeight: 300,
            transition: "background 0.15s",
          }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.85)"}
          onMouseLeave={e => e.currentTarget.style.background = "rgba(0,0,0,0.6)"}
        >
          ×
        </button>

        {/* 16:9 responsive video container */}
        <div style={{ position: "relative", paddingBottom: "56.25%", height: 0 }}>
          <iframe
            src="https://player.cloudinary.com/embed/?cloud_name=drgja8tls&public_id=Intro_Video_e0d5qa&player[posterOptions][transformation][crop]=fit&player[posterOptions][transformation][background]=black"
            title="AIM Pronghorn 404 — Intro"
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: 0 }}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "center", padding: "14px 16px", background: "#000" }}>
          <button
            onClick={onClose}
            style={{
              padding: "9px 28px", borderRadius: 8,
              background: "linear-gradient(135deg, #C47A2C, #8B5CF6)",
              border: "none", color: "#fff",
              fontWeight: 600, fontSize: 13, letterSpacing: "0.4px",
              cursor: "pointer",
              transition: "transform 0.15s, box-shadow 0.15s",
              boxShadow: "0 2px 10px rgba(196,122,44,0.35)",
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.03)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(139,92,246,0.45)" }}
            onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 2px 10px rgba(196,122,44,0.35)" }}
          >
            Skip intro
          </button>
        </div>
      </div>
    </div>
  )
}
