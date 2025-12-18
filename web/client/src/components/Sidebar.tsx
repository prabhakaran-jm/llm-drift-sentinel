interface SidebarProps {
  activeView?: string
  onViewChange?: (view: string) => void
  onSettingsClick?: () => void
}

export default function Sidebar({ activeView = 'sessions', onViewChange, onSettingsClick }: SidebarProps) {
  return (
    <aside className="w-16 dark:bg-[#1a1a1a] bg-slate-100 border-r dark:border-[#27272a] border-slate-200 flex flex-col items-center py-6 gap-6 z-30 shrink-0">
      <div className="size-10 bg-[#facc15]/10 rounded-lg flex items-center justify-center text-[#facc15] mb-2 ring-1 ring-[#facc15]/20 shadow-[0_0_15px_rgba(250,204,21,0.15)]">
        <span className="material-symbols-outlined">security</span>
      </div>
      <nav className="flex flex-col gap-4 w-full items-center flex-1">
        <button
          onClick={() => onViewChange?.('dashboard')}
          className={`group relative flex items-center justify-center size-10 rounded-lg ${
            activeView === 'dashboard'
              ? 'text-[#facc15] bg-[#facc15]/10 ring-1 ring-[#facc15]/20 shadow-[0_0_15px_rgba(250,204,21,0.15)]'
              : 'dark:text-slate-400 text-slate-600 hover:text-[#facc15] hover:dark:bg-white/5 hover:bg-slate-200'
          }`}
        >
          <span className="material-symbols-outlined text-[24px]">grid_view</span>
          <div className="absolute left-14 dark:bg-[#1a1a1a] bg-white dark:border-[#27272a] border-slate-200 dark:text-white text-slate-900 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity z-50 shadow-xl">
            Dashboard
          </div>
        </button>
        <button
          onClick={() => onViewChange?.('sessions')}
          className={`group relative flex items-center justify-center size-10 rounded-lg ${
            activeView === 'sessions'
              ? 'text-[#facc15] bg-[#facc15]/10 ring-1 ring-[#facc15]/20 shadow-[0_0_15px_rgba(250,204,21,0.15)]'
              : 'dark:text-slate-400 text-slate-600 hover:text-[#facc15] hover:dark:bg-white/5 hover:bg-slate-200'
          }`}
        >
          <span className="material-symbols-outlined text-[24px]">chat</span>
          {activeView === 'sessions' && (
            <div className="absolute top-0 right-0 -mt-1 -mr-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#facc15] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#facc15]"></span>
            </div>
          )}
          <div className="absolute left-14 dark:bg-[#1a1a1a] bg-white dark:border-[#27272a] border-slate-200 dark:text-white text-slate-900 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity z-50 shadow-xl">
            Sessions (Active)
          </div>
        </button>
        <button
          onClick={() => onViewChange?.('alerts')}
          className={`group relative flex items-center justify-center size-10 rounded-lg dark:text-slate-400 text-slate-600 hover:text-[#ef4444] hover:dark:bg-[#ef4444]/10 hover:bg-red-50 ${
            activeView === 'alerts' ? 'text-[#ef4444] dark:bg-[#ef4444]/10 bg-red-50' : ''
          }`}
        >
          <span className="material-symbols-outlined text-[24px]">notifications_active</span>
          <div className="absolute top-2 right-2 size-1.5 bg-[#ef4444] rounded-full"></div>
          <div className="absolute left-14 dark:bg-[#1a1a1a] bg-white dark:border-[#27272a] border-slate-200 dark:text-white text-slate-900 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity z-50 shadow-xl">
            Alerts
          </div>
        </button>
      </nav>
      <div className="mt-auto pt-4 border-t dark:border-[#27272a] border-slate-200 w-full flex justify-center">
        <button
          onClick={onSettingsClick}
          className="dark:text-slate-400 text-slate-600 hover:text-[#facc15] hover:dark:bg-white/5 hover:bg-slate-200 size-10 rounded-lg flex items-center justify-center"
        >
          <span className="material-symbols-outlined text-[24px]">settings</span>
        </button>
      </div>
    </aside>
  )
}

