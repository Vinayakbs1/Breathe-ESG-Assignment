import { useNavigate } from 'react-router-dom'
import { useTheme } from '../ThemeContext'

export default function Landing() {
  const navigate = useNavigate()
  const { t, dark, toggle } = useTheme()

  const btnPrimary = {
    background: t.accent, color: t.accentText, border: 'none',
    padding: '13px 30px', borderRadius: 8,
    fontSize: 15, fontWeight: 700, cursor: 'pointer'
  }

  const btnSecondary = {
    background: 'transparent', color: t.text,
    border: `1.5px solid ${t.border}`,
    padding: '13px 30px', borderRadius: 8,
    fontSize: 15, fontWeight: 600, cursor: 'pointer'
  }

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', background: t.bg, color: t.text, minHeight: '100vh' }}>

      {/* Navbar */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 48px', height: 60,
        background: t.surface, borderBottom: `1px solid ${t.border}`,
        position: 'sticky', top: 0, zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>🌿</span>
          <span style={{ fontSize: 17, fontWeight: 800, color: t.text }}>Breathe ESG</span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={toggle} style={{
            background: 'none', border: `1px solid ${t.border}`,
            color: t.textMuted, width: 32, height: 32, borderRadius: 6,
            cursor: 'pointer', fontSize: 14
          }}>
            {dark ? '☀' : '◐'}
          </button>
          <button onClick={() => navigate('/login')} style={{ ...btnSecondary, padding: '7px 18px', fontSize: 13 }}>
            Log in
          </button>
          <button onClick={() => navigate('/login')} style={{ ...btnPrimary, padding: '7px 18px', fontSize: 13 }}>
            Get started →
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section style={{
        padding: '100px 48px 80px', textAlign: 'center', maxWidth: 780, margin: '0 auto'
      }}>
        <div style={{
          display: 'inline-block',
          background: t.surface, color: t.textMuted,
          padding: '5px 16px', borderRadius: 20,
          fontSize: 12, fontWeight: 600, letterSpacing: '0.06em',
          textTransform: 'uppercase', border: `1px solid ${t.border}`,
          marginBottom: 28
        }}>
          Enterprise ESG Data Platform
        </div>
        <h1 style={{
          fontSize: 52, fontWeight: 900, color: t.text,
          lineHeight: 1.1, margin: '0 0 24px', letterSpacing: '-1px'
        }}>
          Turn messy emissions data<br />into audit-ready records
        </h1>
        <p style={{
          fontSize: 18, color: t.textMuted, maxWidth: 520,
          margin: '0 auto 40px', lineHeight: 1.7
        }}>
          Ingest from SAP, utility portals, and corporate travel platforms.
          Normalize, validate, and get analyst sign-off — all traceable.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button onClick={() => navigate('/login')} style={btnPrimary}>Open Platform →</button>
          <button onClick={() => navigate('/login')} style={btnSecondary}>View Demo</button>
        </div>
      </section>

      {/* Stats */}
      <section style={{
        borderTop: `1px solid ${t.border}`, borderBottom: `1px solid ${t.border}`,
        display: 'grid', gridTemplateColumns: 'repeat(3,1fr)'
      }}>
        {[
          { number: '3', label: 'Data sources supported' },
          { number: '10k+', label: 'Rows processed per upload' },
          { number: '100%', label: 'Audit traceable' },
        ].map((s, i) => (
          <div key={s.label} style={{
            padding: '40px', textAlign: 'center', background: t.surface,
            borderRight: i < 2 ? `1px solid ${t.border}` : 'none'
          }}>
            <div style={{ fontSize: 38, fontWeight: 900, color: t.text }}>{s.number}</div>
            <div style={{ fontSize: 13, color: t.textMuted, marginTop: 6 }}>{s.label}</div>
          </div>
        ))}
      </section>

      {/* How it works */}
      <section style={{ padding: '80px 48px', maxWidth: 1100, margin: '0 auto' }}>
        <h2 style={{ fontSize: 30, fontWeight: 800, textAlign: 'center', marginBottom: 8, color: t.text }}>
          How it works
        </h2>
        <p style={{ textAlign: 'center', color: t.textMuted, marginBottom: 52, fontSize: 15 }}>
          From raw enterprise exports to approved audit records in 4 steps
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 20 }}>
          {[
            { step: '01', icon: '📁', title: 'Upload', desc: 'Drop in SAP exports, utility CSVs, or Concur travel files.' },
            { step: '02', icon: '⚙️', title: 'Normalize', desc: 'Units converted automatically. Gallons → Liters. MWh → kWh. Miles → KM.' },
            { step: '03', icon: '🔍', title: 'Review', desc: 'Suspicious records highlighted. One click to approve or reject.' },
            { step: '04', icon: '✅', title: 'Audit Trail', desc: 'Every action logged permanently. Full chain of custody for auditors.' },
          ].map(item => (
            <div key={item.step} style={{
              background: t.surface, borderRadius: 12, padding: 24,
              border: `1px solid ${t.border}`, position: 'relative'
            }}>
              <div style={{
                position: 'absolute', top: 18, right: 18,
                fontSize: 11, fontWeight: 800, color: t.textFaint, letterSpacing: '0.05em'
              }}>{item.step}</div>
              <div style={{ fontSize: 28, marginBottom: 14 }}>{item.icon}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 8 }}>{item.title}</div>
              <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.6 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Data Sources */}
      <section style={{ background: t.surface, borderTop: `1px solid ${t.border}`, borderBottom: `1px solid ${t.border}`, padding: '80px 48px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h2 style={{ fontSize: 30, fontWeight: 800, textAlign: 'center', marginBottom: 8, color: t.text }}>
            Supports real enterprise data sources
          </h2>
          <p style={{ textAlign: 'center', color: t.textMuted, marginBottom: 48, fontSize: 15 }}>
            Designed around how these systems actually export data
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
            {[
              {
                icon: '🏭', title: 'SAP Export',
                points: ['German column headers handled', 'Multiple date formats (DD.MM.YYYY)', 'Mixed units (L, LTR, GAL)', 'Plant code + cost centre tracking']
              },
              {
                icon: '⚡', title: 'Utility Portal CSV',
                points: ['Non-calendar billing periods', 'kWh and MWh normalized', 'Duplicate bill detection', 'Multi-meter, multi-facility']
              },
              {
                icon: '✈️', title: 'Corporate Travel (Concur)',
                points: ['Flights, hotels, ground transport', 'Missing distances estimated', 'IATA airport code lookup', 'Scope 3 categorization']
              },
            ].map(src => (
              <div key={src.title} style={{
                background: t.bg, borderRadius: 12, padding: 28,
                border: `1px solid ${t.border}`
              }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>{src.icon}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 16 }}>{src.title}</div>
                {src.points.map(p => (
                  <div key={p} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
                    <span style={{ color: t.text, fontWeight: 800, fontSize: 13, marginTop: 1 }}>✓</span>
                    <span style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.5 }}>{p}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{
        background: t.navBg, padding: '80px 48px', textAlign: 'center'
      }}>
        <h2 style={{ fontSize: 34, fontWeight: 800, color: '#fff', marginBottom: 16 }}>
          Ready to clean up your emissions data?
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, marginBottom: 32 }}>
          Log in and upload your first CSV in minutes.
        </p>
        <button onClick={() => navigate('/login')} style={{
          background: '#fff', color: '#000', border: 'none',
          padding: '14px 36px', borderRadius: 8,
          fontSize: 15, fontWeight: 700, cursor: 'pointer'
        }}>
          Open Platform →
        </button>
      </section>

      {/* Footer */}
      <footer style={{
        background: t.navBg, borderTop: '1px solid #1a1a1a',
        padding: '28px 48px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>🌿</span>
          <span style={{ color: '#fff', fontWeight: 700 }}>Breathe ESG</span>
        </div>
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
          Emissions Data Ingestion & Review Platform
        </span>
      </footer>
    </div>
  )
}