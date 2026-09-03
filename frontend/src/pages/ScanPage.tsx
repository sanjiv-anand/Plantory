import { QrCode } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export function ScanPage() {
  const navigate = useNavigate()
  const [manualUrl, setManualUrl] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const plantId = params.get('plant')
    if (plantId) navigate(`/plants/${plantId}`, { replace: true })
  }, [navigate])

  function openManual() {
    setError(null)
    try {
      const url = manualUrl.trim()
      const match = url.match(/\/plants\/(\d+)/)
      if (match) {
        navigate(`/plants/${match[1]}`)
        return
      }
      if (/^\d+$/.test(url)) {
        navigate(`/plants/${url}`)
        return
      }
      setError('Enter a plant URL or ID from a QR tag.')
    } catch {
      setError('Could not open that plant link.')
    }
  }

  return (
    <main className="space-y-4">
      <section className="px-1">
        <p className="label">Scan</p>
        <h1 className="mt-1 text-[28px] font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
          Open plant tag
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Scan a plant QR code with your camera app, or paste the link below.
        </p>
      </section>

      <section className="card p-8 text-center">
        <div
          className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl"
          style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
        >
          <QrCode className="h-8 w-8" />
        </div>
        <p className="text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
          Point your phone camera at a LILYLOG plant tag. The QR code opens the plant journal automatically.
        </p>
      </section>

      <section className="card p-5">
        <label className="label mb-2 block" htmlFor="scan-url">
          Or paste plant link / ID
        </label>
        <input
          className="input"
          id="scan-url"
          onChange={(event) => setManualUrl(event.target.value)}
          placeholder="https://.../plants/3 or 3"
          value={manualUrl}
        />
        {error && <p className="mt-2 text-sm text-rose-500">{error}</p>}
        <button className="btn-primary mt-3 w-full" onClick={openManual} type="button">
          Open plant
        </button>
      </section>
    </main>
  )
}
