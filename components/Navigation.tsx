'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Navigation({ selectedUserId }: { selectedUserId: string }) {
  const pathname = usePathname()

  const navItems = [
    { href: '/', label: 'Dashboard' },
    { href: '/budget', label: 'Monthly Budget' },
    { href: '/transactions', label: 'Transactions' },
    { href: '/reports', label: 'Reports' },
    { href: '/assistant', label: 'LLM Assistant' },
  ]

  return (
    <nav className="border-b border-black bg-white">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm font-medium transition-colors ${
                  pathname === item.href
                    ? 'text-black border-b-2 border-black'
                    : 'text-black hover:opacity-70'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  )
}

