import { Footer, MainContent } from './layout';
import InfoButton from './components/InfoButton';

const App = () => (
  <div className="flex flex-col min-h-dvh justify-between">
    <MainContent />
    <Footer />
    <InfoButton />
  </div>
)

export default App
