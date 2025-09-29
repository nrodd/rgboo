import { Footer, MainContent } from './layout';
import InfoButton from './components/InfoButton';

const App = () => (
  <div className="flex flex-col h-screen justify-between">
    <InfoButton />
    <MainContent />
    <Footer />
  </div>
)

export default App
