export function ModeCard({ icon, title, text, tag, href, disabled = false }: { icon: string; title: string; text: string; tag: string; href?: string; disabled?: boolean }) {
  const body = <><div className="mode-icon">{icon}</div><div><div className="mode-head"><strong>{title}</strong><span>{tag}</span></div><p>{text}</p></div></>;
  if (href && !disabled) return <a className="mode-card" href={href}>{body}</a>;
  return <button className="mode-card" type="button" disabled={disabled}>{body}</button>;
}
