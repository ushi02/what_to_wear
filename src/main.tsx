import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/outfit'
// 只给标题布标用；按 unicode-range 分片，只会下载用到的那几个字
import '@fontsource/zcool-kuaile'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
