import { IntroScene } from './intro/IntroScene'

/**
 * 独立演示入口，只挂载开场动画，不包含书库、阅读器或数据库。
 * 正式项目可直接把 onComplete 换成自己的页面切换函数。
 */
export default function App() {
  const handleComplete = () => {
    window.dispatchEvent(new CustomEvent('overwriting:intro-complete'))
  }

  return <IntroScene onComplete={handleComplete} />
}

