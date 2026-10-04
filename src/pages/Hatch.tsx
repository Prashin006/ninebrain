import { useState } from 'react'
import { demoData, useStore } from '../store'
import { Logo } from '../ui'
import { PALETTE, uid } from '../lib'

/** First-run onboarding: name, three hearts, then empty or demo ocean. */
export default function Hatch() {
  const { restore, setSettings, set } = useStore.getState()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [hearts, setHearts] = useState(['', '', ''])

  const fresh = () => {
    set({ hearts: hearts.filter((h) => h.trim()).map((title, i) => ({ id: uid(), title, color: PALETTE[i] })) })
    setSettings({ name, hatched: true })
  }
  return (
    <div className="hatch">
      <div className="card">
        <div className="egg"><Logo size={72} /></div>
        {step === 0 && (<>
          <div className="specimen">SPECIMEN № 000 — HATCHING</div>
          <h1>You have one brain.<br />An octopus has nine.</h1>
          <p className="muted">Ninebrain lends you the other eight: one per project, plus a place for every loose thought, hour and habit. Meet Otto.</p>
          <input autoFocus placeholder="What should Otto call you?" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && setStep(1)} />
          <button className="btn big" onClick={() => setStep(1)}>Crack the egg →</button>
        </>)}
        {step === 1 && (<>
          <div className="specimen">FACT: OCTOPUSES HAVE THREE HEARTS</div>
          <h1>Name yours.</h1>
          <p className="muted">Three core goals everything else must serve. Projects that serve none get suspicious looks.</p>
          {hearts.map((h, i) => <input key={i} autoFocus={i === 0} placeholder={['e.g. Build meaningful work', 'e.g. Strong body, calm mind', 'e.g. People I love'][i]} value={h} onChange={(e) => setHearts(hearts.map((x, j) => (j === i ? e.target.value : x)))} />)}
          <div className="row">
            <button className="btn big" onClick={fresh}>Start with empty water</button>
            <button className="btn ghost big" onClick={() => restore(demoData(name))}>Explore a demo ocean</button>
          </div>
        </>)}
      </div>
    </div>
  )
}
