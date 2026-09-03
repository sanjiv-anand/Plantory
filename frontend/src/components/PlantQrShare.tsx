import QRCode from 'qrcode'
import { QrCode, Share2 } from 'lucide-react'
import { useEffect, useState } from 'react'

type Props = {
  plantId: number
  plantName: string
}

export function PlantQrShare({ plantId, plantName }: Props) {
  const [dataUrl, setDataUrl] = useState<string>()
  const url = `${window.location.origin}/plants/${plantId}`

  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: 180, color: { dark: '#0f172a', light: '#ffffff' } })
      .then(setDataUrl)
      .catch(() => setDataUrl(undefined))
  }, [url])

  async function shareLink() {
    if (navigator.share) {
      await navigator.share({ title: plantName, text: `Open ${plantName} in LILYLOG`, url })
      return
    }
    await navigator.clipboard.writeText(url)
  }

  return (
    <section className="card p-5">
      <div className="mb-4 flex items-center gap-2">
        <QrCode className="h-5 w-5" style={{ color: 'var(--accent)' }} />
        <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          Plant tag
        </h3>
      </div>
      <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
        Print or save this QR code on a plant tag. Scan it to jump straight to this journal.
      </p>
      {dataUrl && (
        <div className="mx-auto mb-4 w-fit rounded-2xl bg-white p-3">
          <img alt={`QR code for ${plantName}`} className="h-44 w-44" src={dataUrl} />
        </div>
      )}
      <button className="btn-secondary w-full" onClick={() => void shareLink()} type="button">
        <Share2 className="mr-2 h-4 w-4" />
        Share link
      </button>
    </section>
  )
}
