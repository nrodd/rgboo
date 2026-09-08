import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Footer, MainContent } from "./layout";
import InfoButton from "./components/InfoButton";
import Admin from "./Admin";
import Stats from "./Stats";

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
      {/* Reachable, but deliberately not linked from the home page yet --
          the plan is to collect a month of data first, then publish it by
          adding the footer link. */}
      <Route path="/stats" element={<Stats />} />
    </Routes>
  </BrowserRouter>
);

export default App;
