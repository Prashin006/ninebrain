import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import type { Arm, Task } from './types'
import { MAX_ARMS, daysSince } from './lib'

export function Header({ no, tag, title, sub, children }: { no: string; tag: string; title: string; sub: string; children?: ReactNode }) {
  return (
    <header className="ph">
      <div>
        <div className="specimen">№ {no} — {tag}</div>
        <h1>{title}</h1>
        <p className="muted">{sub}</p>
      </div>
      {children && <div className="row">{children}</div>}
    </header>
  )
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  if (!open) return null
  return (
    <div className="scrim" onMouseDown={onClose}>
      <div className="modal card" role="dialog" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  )
}

export const Logo = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
    <ellipse cx="16" cy="12" rx="9" ry="9" fill="var(--coral)" />
    {[4, 8, 12, 16, 20, 24, 28].map((x, i) => (
      <path key={x} d={`M${16 + (x - 16) * 0.35} 18 q ${(x - 16) * 0.3} 6 ${(x - 16) * 0.6} ${10 - Math.abs(i - 3)}`} stroke="var(--coral)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
    ))}
    <rect x="10.5" y="10" width="4" height="2" rx="1" fill="#02060d" />
    <rect x="17.5" y="10" width="4" height="2" rx="1" fill="#02060d" />
  </svg>
)

/* ---------- The Octopus map: 8 arms = active projects, suckers = tasks ---------- */
type P = [number, number]
const C: P = [500, 470]

/** Sample a cubic bezier and build a tapered, filled tentacle outline. */
function tentacle(a: P, b: P, c: P, d: P, w0: number, w1: number) {
  const pts: P[] = [], nor: P[] = []
  const N = 28
  for (let i = 0; i <= N; i++) {
    const t = i / N, u = 1 - t
    const x = u ** 3 * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t ** 3 * d[0]
    const y = u ** 3 * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t ** 3 * d[1]
    const dx = 3 * u * u * (b[0] - a[0]) + 6 * u * t * (c[0] - b[0]) + 3 * t * t * (d[0] - c[0])
    const dy = 3 * u * u * (b[1] - a[1]) + 6 * u * t * (c[1] - b[1]) + 3 * t * t * (d[1] - c[1])
    const l = Math.hypot(dx, dy) || 1
    pts.push([x, y]); nor.push([-dy / l, dx / l])
  }
  const w = (i: number) => w0 + (w1 - w0) * (i / N)
  const left = pts.map((p, i) => `${p[0] + nor[i][0] * w(i)},${p[1] + nor[i][1] * w(i)}`)
  const right = pts.map((p, i) => `${p[0] - nor[i][0] * w(i)},${p[1] - nor[i][1] * w(i)}`).reverse()
  return { d: `M${left.join(' L')} L${right.join(' L')} Z`, pts, nor, w }
}

export function Octopus({ arms, tasks, skin, onFree }: { arms: Arm[]; tasks: Task[]; skin: string; onFree: () => void }) {
  const nav = useNavigate()
  const svg = useRef<SVGSVGElement>(null)
  const [look, setLook] = useState<P>([0, 0])
  const [t, setT] = useState(0)
  const [hover, setHover] = useState(-1)
  const reach = useRef<number[]>(Array(MAX_ARMS).fill(1))

  // ~30fps undulation clock; frozen for reduced-motion users
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setT(10); return }
    let raf = 0, last = 0
    const t0 = performance.now()
    const loop = (now: number) => {
      if (now - last > 33) { last = now; setT((now - t0) / 1000) }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    let raf = 0
    const move = (e: PointerEvent) => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const r = svg.current?.getBoundingClientRect()
        if (!r) return
        const x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height * 0.43)
        const l = Math.hypot(x, y) || 1
        setLook([(x / l) * 5, (y / l) * 4])
      })
    }
    window.addEventListener('pointermove', move)
    return () => window.removeEventListener('pointermove', move)
  }, [])

  const slots = Array.from({ length: MAX_ARMS }, (_, i) => arms[i])
  const unfurl = 1 - (1 - Math.min(1, t / 1.4)) ** 3
  const bob = Math.sin(t * 0.9) * 8
  return (
    <div className="octo">
      <svg ref={svg} viewBox="0 0 1000 1000" role="img" aria-label="Octopus map of your active projects">
        <defs>
          <radialGradient id="glow"><stop offset="0" stopColor={skin} stopOpacity=".45" /><stop offset="1" stopColor={skin} stopOpacity="0" /></radialGradient>
          <radialGradient id="sheen" cx=".35" cy=".3"><stop offset="0" stopColor="#fff" stopOpacity=".35" /><stop offset=".6" stopColor="#fff" stopOpacity="0" /></radialGradient>
        </defs>
        <circle cx={C[0]} cy={C[1]} r={330 + Math.sin(t * 1.3) * 18} fill="url(#glow)" />
        <g transform={`translate(0 ${bob})`}>
        {slots.map((arm, i) => {
          const limp = !!arm && daysSince(arm.touchedAt) >= 10
          reach.current[i] += ((hover === i ? 1.08 : 1) - reach.current[i]) * 0.2
          const L = unfurl * reach.current[i]
          const speed = limp ? 0.35 : 0.9, amp = limp ? 0.25 : 1
          const ph = t * speed + i * 0.8
          const ang = (i / MAX_ARMS) * Math.PI * 2 + Math.PI / 8 + Math.sin(ph * 0.7) * 0.04 * amp
          const dir: P = [Math.cos(ang), Math.sin(ang)], perp: P = [-dir[1], dir[0]]
          const s = i % 2 ? 1 : -1
          const at = (r: number, off: number): P => [C[0] + dir[0] * r + perp[0] * off, C[1] + dir[1] * r + perp[1] * off]
          const w1 = Math.sin(ph) * 45 * amp, w2 = Math.sin(ph + 1.4) * 60 * amp, w3 = Math.sin(ph + 2.6) * 50 * amp
          const g = tentacle(at(70, 0), at(70 + 130 * L, (70 + w1) * s), at(70 + 230 * L, (-80 + w2) * s), at(70 + 320 * L, (30 + w3) * s), 30, 3)
          const my = arm ? tasks.filter((x) => x.armId === arm.id) : []
          const suckers = my.slice(0, 12)
          const tip = at(95 + 320 * L, (30 + w3 * 0.8) * s)
          return (
            <g key={i} className={`arm ${arm ? '' : 'free'} ${limp ? 'limp' : ''}`} style={{ color: arm?.color }}
              onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(-1)}
              onClick={() => (arm ? nav(`/arms/${arm.id}`) : onFree())}>
              <path d={g.d} fill={arm ? arm.color : 'none'} stroke={arm ? 'none' : 'var(--line-strong)'} strokeDasharray="6 8" opacity={arm ? 0.92 : 1} />
              {suckers.map((x, j) => {
                const k = 3 + j * 2, p = g.pts[k], n = g.nor[k], w = g.w(k) * 0.55
                return <circle key={x.id} cx={p[0] + n[0] * w * s} cy={p[1] + n[1] * w * s} r={Math.max(2, g.w(k) * 0.28)}
                  className={x.done ? 'sucker done' : 'sucker'} />
              })}
              <foreignObject x={tip[0] - 110} y={tip[1] - 45} width="220" height="90" opacity={unfurl}>
                <div className={`pod ${arm ? '' : 'pod-free'}`}>
                  {arm ? (<>
                    <b>{arm.title}</b>
                    <small>{my.filter((t) => t.done).length}/{my.length} {limp ? '· limp' : ''}</small>
                  </>) : <small>+ free arm</small>}
                </div>
              </foreignObject>
            </g>
          )
        })}
        <g className="mantle">
          <path d="M500 250 C 600 250 640 350 625 430 C 610 510 560 540 500 540 C 440 540 390 510 375 430 C 360 350 400 250 500 250 Z" fill={skin} />
          <path d="M500 250 C 600 250 640 350 625 430 C 610 510 560 540 500 540 C 440 540 390 510 375 430 C 360 350 400 250 500 250 Z" fill="url(#sheen)" />
          {[[455, 320, 9], [540, 300, 6], [585, 360, 7], [420, 370, 5]].map(([x, y, r], k) => (
            <circle key={k} cx={x} cy={y} r={r} fill="#fff" opacity={0.12 + 0.1 * Math.sin(t * 2 + k)} />
          ))}
          {[445, 555].map((x) => (
            <g key={x}>
              <ellipse cx={x} cy="440" rx="30" ry="26" fill="#f4ecd8" />
              <rect x={x - 15 + look[0]} y={434 + look[1]} width="30" height="11" rx="5" fill="#02060d" />
              <rect className="lid" x={x - 32} y="412" width="64" height="56" fill={skin} />
            </g>
          ))}
        </g>
        </g>
      </svg>
    </div>
  )
}

/** Celebrate a win with a bubble burst on the effects canvas. */
export function burst(from?: Element | null, color = '#3df5d3') {
  const r = from?.getBoundingClientRect()
  const x = r ? r.left + r.width / 2 : innerWidth / 2, y = r ? r.top + r.height / 2 : innerHeight / 2
  dispatchEvent(new CustomEvent('nb:burst', { detail: { x, y, color } }))
}

export function CountUp({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [v, setV] = useState(0)
  useEffect(() => {
    let raf = 0
    const t0 = performance.now()
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 900)
      setV(value * (1 - (1 - k) ** 3))
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return <>{v.toFixed(decimals)}</>
}

/* ---------- Marine snow, rising bubbles, bursts + bioluminescent trail (dinoflagellates glow when disturbed) ---------- */
type Particle = { x: number; y: number; vx: number; vy: number; r: number; life: number; color: string }
export function MarineSnow() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current!, ctx = cv.getContext('2d')!
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let w = 0, h = 0, raf = 0
    const dpr = Math.min(2, devicePixelRatio || 1)
    const fit = () => { w = innerWidth; h = innerHeight; cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0) }
    fit()
    const snow = Array.from({ length: 110 }, () => ({ x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.6 + 0.3, v: Math.random() * 0.25 + 0.05 }))
    const fx: Particle[] = []
    const move = (e: PointerEvent) => {
      for (let k = 0; k < 2; k++) fx.push({ x: e.clientX + (Math.random() - 0.5) * 16, y: e.clientY + (Math.random() - 0.5) * 16, vx: 0, vy: -0.2, r: 2.2, life: 1, color: '61,245,211' })
    }
    const hex = (c: string) => { const n = parseInt(c.slice(1), 16); return `${n >> 16},${(n >> 8) & 255},${n & 255}` }
    const onBurst = (e: Event) => {
      const { x, y, color } = (e as CustomEvent<{ x: number; y: number; color: string }>).detail
      for (let k = 0; k < 36; k++) {
        const a = Math.random() * Math.PI * 2, sp = Math.random() * 5 + 1.5
        fx.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2, r: Math.random() * 5 + 2, life: 1, color: color.startsWith('#') ? hex(color) : '61,245,211' })
      }
    }
    const tick = () => {
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = 'rgba(200,230,255,.35)'
      for (const s of snow) {
        s.y += s.v; s.x += Math.sin(s.y / 60) * 0.15
        if (s.y > h) { s.y = -4; s.x = Math.random() * w }
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill()
      }
      if (Math.random() < 0.03) fx.push({ x: Math.random() * w, y: h + 10, vx: 0, vy: -(Math.random() * 0.8 + 0.4), r: Math.random() * 6 + 2, life: 3, color: 'bubble' })
      for (let i = fx.length - 1; i >= 0; i--) {
        const p = fx[i]
        if (p.color === 'bubble') {
          p.y += p.vy; p.x += Math.sin(p.y / 30) * 0.5
          if (p.y < -20) { fx.splice(i, 1); continue }
          ctx.strokeStyle = 'rgba(170,220,255,.35)'; ctx.lineWidth = 1
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.stroke()
          continue
        }
        p.life -= 0.02; p.x += p.vx; p.y += p.vy; p.vx *= 0.95; p.vy = p.vy * 0.95 - 0.03
        if (p.life <= 0) { fx.splice(i, 1); continue }
        ctx.fillStyle = `rgba(${p.color},${p.life * 0.7})`
        ctx.shadowBlur = 12; ctx.shadowColor = `rgba(${p.color},1)`
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * p.life + 0.5, 0, 7); ctx.fill()
        ctx.shadowBlur = 0
      }
      raf = requestAnimationFrame(tick)
    }
    tick()
    addEventListener('resize', fit); addEventListener('pointermove', move); addEventListener('nb:burst', onBurst)
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', fit); removeEventListener('pointermove', move); removeEventListener('nb:burst', onBurst) }
  }, [])
  return <><div className="rays" aria-hidden /><canvas ref={ref} className="snow" aria-hidden /></>
}

/** Minimal, XSS-safe markdown → React (no innerHTML). Supports #, -, **b**, *i*, `code`, [[links]]. */
export function Markdown({ text, onLink }: { text: string; onLink: (title: string) => void }) {
  const inline = (s: string) =>
    s.split(/(\[\[[^\]]+\]\]|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|https?:\/\/\S+)/g).map((p, i) => {
      if (p.startsWith('[[')) { const t = p.slice(2, -2); return <a key={i} className="wiki" onClick={() => onLink(t)}>{t}</a> }
      if (p.startsWith('**')) return <b key={i}>{p.slice(2, -2)}</b>
      if (p.startsWith('`')) return <code key={i}>{p.slice(1, -1)}</code>
      if (p.startsWith('*') && p.length > 2) return <i key={i}>{p.slice(1, -1)}</i>
      if (/^https?:\/\//.test(p)) return <a key={i} href={p} target="_blank" rel="noopener noreferrer">{p}</a>
      return p
    })
  return (
    <div className="md">
      {text.split('\n').map((l, i) => {
        const h = l.match(/^(#{1,3})\s+(.*)/)
        if (h) { const H = `h${h[1].length + 1}` as 'h2'; return <H key={i}>{inline(h[2])}</H> }
        if (/^[-*]\s/.test(l)) return <li key={i}>{inline(l.slice(2))}</li>
        if (!l.trim()) return <br key={i} />
        return <p key={i}>{inline(l)}</p>
      })}
    </div>
  )
}
