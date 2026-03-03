import { X } from 'lucide-react'

const SHORTCUTS = [
  { key: 'Ctrl + K', desc: 'Open search' },
  { key: 'Ctrl + N', desc: 'New conversation' },
  { key: 'Ctrl + /', desc: 'Show shortcuts' },
  { key: 'Ctrl + B', desc: 'Toggle sidebar' },
  { key: 'Enter', desc: 'Send message' },
  { key: 'Shift + Enter', desc: 'New line in message' },
  { key: 'Esc', desc: 'Close modal / Cancel reply' },
  { key: 'Alt + ↑ / ↓', desc: 'Navigate conversations' },
  { key: '**text**', desc: 'Bold text in message' },
  { key: '_text_', desc: 'Italic text in message' },
  { key: '`code`', desc: 'Inline code' },
  { key: '```code```', desc: 'Code block' },
  { key: '@username', desc: 'Mention someone' },
]

export default function KeyboardShortcutsModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal pop-in" style={{maxWidth:420}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:18}}>
          <h3 style={{margin:0}}>⌨️ Keyboard Shortcuts</h3>
          <button className="icon-btn" onClick={onClose}><X size={15}/></button>
        </div>
        <div className="shortcuts-grid">
          {SHORTCUTS.map(s => (
            <div key={s.key} className="shortcut-row">
              <span className="shortcut-desc">{s.desc}</span>
              <span className="kbd">{s.key}</span>
            </div>
          ))}
        </div>
        <div style={{marginTop:18,fontSize:12,color:'var(--text-muted)',textAlign:'center'}}>
          Leafy by Sematech Developers
        </div>
      </div>
    </div>
  )
}
