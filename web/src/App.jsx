import InfoIcon from './assets/info.svg?react';
import { Footer, MainContent } from './layout'

const App = () => (
  <div className="flex flex-col h-screen justify-between">
    <div className="info-icon"><InfoIcon viewBox="0 0 64 64" width="32" height="32" /></div>
    <MainContent />
    <Footer />
  </div>
)

export default App
