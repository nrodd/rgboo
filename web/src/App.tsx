import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Footer, MainContent } from "./layout";
import InfoButton from "./components/InfoButton";
import Admin from "./Admin";
import Privacy from "./Legal/Privacy";
import Terms from "./Legal/Terms";

const Home = () => (
    <div className="flex flex-col min-h-dvh justify-between">
      <MainContent />
      <Footer />
      <InfoButton />
    </div>
);

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
    </Routes>
  </BrowserRouter>
);

export default App;
