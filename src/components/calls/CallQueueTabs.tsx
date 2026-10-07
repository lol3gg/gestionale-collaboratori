import { CALL_TABS, type CallTab } from '../../lib/calls'

type CallQueueTabsProps = {
  tab: CallTab
  counts: Record<CallTab, number>
  onChange: (tab: CallTab) => void
}

export function CallQueueTabs({ tab, counts, onChange }: CallQueueTabsProps) {
  return (
    <div className="mb-5 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {CALL_TABS.map((item) => {
        const selected = tab === item.id
        return (
          <button
            key={item.id}
            type="button"
            className={`min-h-11 shrink-0 rounded-full px-4 py-2 text-[15px] font-medium transition-all duration-200 ${
              selected
                ? 'btn-primary-glow shadow-sm'
                : 'bg-surface text-ink ring-1 ring-line hover:bg-canvas hover:ring-primary-200'
            }`}
            onClick={() => onChange(item.id)}
          >
            {item.label}
            <span className={`ml-2 tabular-nums ${selected ? 'text-white/80' : 'text-muted'}`}>{counts[item.id]}</span>
          </button>
        )
      })}
    </div>
  )
}
