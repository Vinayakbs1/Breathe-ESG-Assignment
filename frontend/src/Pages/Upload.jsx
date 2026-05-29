import { useState } from 'react'
import { useTheme } from '../ThemeContext'
import api from '../api'

function UploadCard({ title, description, endpoint, icon, accepts }) {
  const { t } = useTheme()
  const [file, setFile]         = useState(null)
  const [loading, setLoading]   = useState(false)
  const [result, setResult]     = useState(null)
  const [error, setError]       = useState('')
  const [dragging, setDragging] = useState(false)

  const handleUpload = async () => {
    if (!file) { setError('Please select a file first'); return }
    setLoading(true); setError(''); setResult(null)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await api.post(endpoint, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      setResult(res.data); setFile(null)
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed')
    } finally { setLoading(false) }
  }

  const onDrop = (e) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) { setFile(f); setResult(null); setError('') }
  }

  const inputId = 'file-' + endpoint.replace(/\//g, '')

  return (
    <div style={{
      background: t.surface, borderRadius: 12,
      border: `1px solid ${t.border}`,
      display: 'flex', flexDirection: 'column', overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '18px 22px', borderBottom: `1px solid ${t.border}`,
        display: 'flex', alignItems: 'center', gap: 12
      }}>
        <span style={{ fontSize: 24 }}>{icon}</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: t.text }}>{title}</div>
          <div style={{ fontSize: 11, color: t.textFaint, marginTop: 2 }}>{accepts}</div>
        </div>
      </div>

      <div style={{ padding: 22, flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.6, margin: 0 }}>{description}</p>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => document.getElementById(inputId).click()}
          style={{
            border: `2px dashed ${dragging ? t.text : t.border}`,
            borderRadius: 8, padding: '24px 16px', textAlign: 'center',
            cursor: 'pointer', transition: 'all 0.15s',
            background: dragging ? t.bg : 'transparent'
          }}
        >
          <input id={inputId} type="file" accept=".csv" style={{ display: 'none' }}
            onChange={e => { setFile(e.target.files[0]); setResult(null); setError('') }} />
          {file ? (
            <div>
              <div style={{ fontSize: 22, marginBottom: 6 }}>📄</div>
              <div style={{ fontSize: 13, color: t.text, fontWeight: 500 }}>{file.name}</div>
              <div style={{ fontSize: 11, color: t.textFaint, marginTop: 4 }}>
                {(file.size / 1024).toFixed(1)} KB · click to change
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 24, marginBottom: 8 }}>📂</div>
              <div style={{ fontSize: 13, color: t.textMuted }}>
                Drop CSV here or <span style={{ color: t.text, fontWeight: 600 }}>browse</span>
              </div>
              <div style={{ fontSize: 11, color: t.textFaint, marginTop: 4 }}>Only .csv files</div>
            </div>
          )}
        </div>

        <button onClick={handleUpload} disabled={loading || !file} style={{
          background: loading || !file ? t.border : t.accent,
          color: loading || !file ? t.textFaint : t.accentText,
          border: 'none', padding: '10px 18px', borderRadius: 7,
          fontSize: 13, fontWeight: 600,
          cursor: loading || !file ? 'not-allowed' : 'pointer', width: '100%'
        }}>
          {loading ? '⏳ Uploading…' : '⬆ Upload CSV'}
        </button>

        {error && (
          <div style={{
            padding: '10px 13px', background: t.dangerBg, color: t.danger,
            borderRadius: 7, fontSize: 13, border: `1px solid ${t.danger}33`
          }}>⚠ {error}</div>
        )}

        {result && (
          <div style={{
            padding: '14px', background: t.successBg, borderRadius: 8,
            border: `1px solid ${t.success}44`
          }}>
            <div style={{ fontWeight: 700, color: t.success, marginBottom: 10, fontSize: 13 }}>✓ Upload complete</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: 13 }}>
              <span style={{ color: t.textMuted }}>Total rows</span>
              <span style={{ fontWeight: 600, color: t.text }}>{result.total_rows}</span>
              <span style={{ color: t.textMuted }}>Successful</span>
              <span style={{ fontWeight: 600, color: t.success }}>{result.successful_rows}</span>
              <span style={{ color: t.textMuted }}>Failed</span>
              <span style={{ fontWeight: 600, color: result.failed_rows > 0 ? t.danger : t.textMuted }}>
                {result.failed_rows}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Upload() {
  const { t } = useTheme()
  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: t.text, marginBottom: 4 }}>Upload Data</h2>
        <p style={{ color: t.textMuted, fontSize: 13, margin: 0 }}>
          Upload CSV files from each data source. Records are normalized and flagged automatically.
        </p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
        <UploadCard title="SAP Export" icon="🏭" accepts="MB51 / ME2M flat file"
          description="Handles German column headers, mixed date formats (DD.MM.YYYY), and inconsistent fuel units (L, LTR, GAL). Plant codes preserved as metadata."
          endpoint="/upload/sap/" />
        <UploadCard title="Utility Data" icon="⚡" accepts="Portal CSV export"
          description="Handles non-calendar billing periods, kWh/MWh normalization, duplicate bill detection, and multi-meter data in a single export."
          endpoint="/upload/utility/" />
        <UploadCard title="Corporate Travel" icon="✈️" accepts="Concur / Navan export"
          description="Handles flights, hotels, ground transport. Missing distances estimated from IATA airport codes. All categories map to Scope 3 sub-categories."
          endpoint="/upload/travel/" />
      </div>
    </div>
  )
}