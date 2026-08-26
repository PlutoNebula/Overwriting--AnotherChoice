import { IntroScene } from './intro/IntroScene'

declare global {
  interface Window {
    OW?: { App?: { afterIntro?: () => void } }
  }
}

/**
 * 动画完成后交回 web 主体：先给 #intro-root 打 data-done 让它淡出并放开点击，
 * 再调 window.OW.App.afterIntro()——由 legacy app.js 决定去 signin 还是 library。
 */
export default function App() {
  const handleComplete = () => {
    document.getElementById('intro-root')?.setAttribute('data-done', '1')
    window.OW?.App?.afterIntro?.()
  }

  return <IntroScene onComplete={handleComplete} />
}
