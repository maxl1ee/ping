'use client';

import { AuthProvider } from '@/contexts/AuthContext';
import BottomNav from '@/components/layout/BottomNav';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="pb-16">
        {children}
      </div>
      <BottomNav />
    </AuthProvider>
  );
}
