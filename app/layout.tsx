import type { Metadata } from 'next'
import { Archivo, IBM_Plex_Mono, Inter } from 'next/font/google'
import './globals.css'

const archivo = Archivo({
  variable: '--font-archivo',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  display: 'swap',
})

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
})

const plexMono = IBM_Plex_Mono({
  variable: '--font-plex-mono',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Inter-Office Memo Management',
  description:
    'Route internal memos through an ordered approval workflow, with a permanent record of every action.',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${archivo.variable} ${inter.variable} ${plexMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  )
}
