export default function Avatar({ profile, size = 'md', showStatus = false, className = '' }) {
  const sizeClass = size === 'sm' ? 'avatar-sm' : size === 'lg' ? 'avatar-lg' : ''
  const initials = profile?.display_name
    ? profile.display_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : profile?.username?.[0]?.toUpperCase() || '?'

  const statusClass = profile?.online_status || 'offline'

  return (
    <div className={`conv-avatar ${className}`}>
      {profile?.avatar_url ? (
        <img src={profile.avatar_url} alt={initials} className={`avatar ${sizeClass}`} />
      ) : (
        <div className={`avatar ${sizeClass}`} style={{ userSelect: 'none' }}>{initials}</div>
      )}
      {showStatus && <span className={`online-dot ${statusClass}`} />}
    </div>
  )
}
