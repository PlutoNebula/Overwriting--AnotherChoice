import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/global.css'

/**
 * IntroHost：监听 window 上的 'overwriting:replay-intro'，
 * 收到就递增 key，让下面的 <App> 整个重新挂载，回到 IntroScene 的 idle 状态。
 * legacy app.js 的 replayIntro() 与 wipe() 会派发这个事件。
 */
function IntroHost() {
  const [key, setKey] = useState(0)
  useEffect(() => {
    const onReplay = () => setKey((k) => k + 1)
    window.addEventListener('overwriting:replay-intro', onReplay)
    return () => window.removeEventListener('overwriting:replay-intro', onReplay)
  }, [])
  return <App key={key} />
}

createRoot(document.getElementById('intro-root')!).render(
  <StrictMode>
    <IntroHost />
  </StrictMode>
)
