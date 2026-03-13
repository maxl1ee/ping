'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { MessageCircle, Inbox, User } from 'lucide-react';

const tabs = [
  { href: '/chat', label: 'Chat', icon: MessageCircle },
  { href: '/inbox', label: 'Inbox', icon: Inbox },
  { href: '/profile', label: 'Profile', icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();

  // Hide on auth and onboarding pages
  const hideOn = ['/', '/register', '/onboarding'];
  if (hideOn.includes(pathname)) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-lg border-t border-surface-border">
      <div className="flex items-center justify-around max-w-lg mx-auto px-2 pb-[env(safe-area-inset-bottom)]">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/');
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center gap-0.5 py-2 px-3 min-w-[4rem] transition-colors ${
                isActive
                  ? 'text-accent'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
