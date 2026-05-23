import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'

export const metadata: Metadata = {
  title: 'レシピ管理',
  description: '自分だけのレシピを管理するアプリ',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-stone-50">
        <header className="bg-white border-b border-stone-200 shadow-sm">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="text-xl font-bold text-stone-800 hover:text-orange-600 transition-colors">
              🍳 レシピ管理
            </Link>
            <nav className="flex gap-4">
              <Link href="/" className="text-stone-600 hover:text-orange-600 transition-colors text-sm font-medium">
                ホーム
              </Link>
              <Link href="/ingredients" className="text-stone-600 hover:text-orange-600 transition-colors text-sm font-medium">
                食材マスタ
              </Link>
              <Link href="/recipe/new" className="bg-orange-500 text-white px-4 py-1.5 rounded-full text-sm font-medium hover:bg-orange-600 transition-colors">
                + 新規レシピ
              </Link>
            </nav>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  )
}
