import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'osu! Realtime Dashboard',
  description: 'Real-time osu! statistics dashboard with live estimation and tracking',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body className="gradient-bg min-h-screen">
        {children}
      </body>
    </html>
  )
}