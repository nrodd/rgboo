import { BrowserRouter, Route, Routes } from "react-router-dom";
import { MainContent } from "./layout";
import Admin from "./Admin";

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<MainContent />} />
      <Route path="/admin" element={<Admin />} />
    </Routes>
  </BrowserRouter>
);

export default App;
