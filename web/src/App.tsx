import { BrowserRouter, Route, Routes } from "react-router-dom";
import { MainContent } from "./layout";
import Admin from "./Admin";

const Home = () => (
  <div className="crt-page">
    <MainContent />
  </div>
);

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/admin" element={<Admin />} />
    </Routes>
  </BrowserRouter>
);

export default App;
