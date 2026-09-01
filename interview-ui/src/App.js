import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Landing from "./pages/Landing";
import Interview from "./pages/Interview";
import Analysis from "./pages/Analysis";
import Dashboard from "./pages/Dashboard";
import TopicSelection from "./pages/TopicSelection";
import { SessionProvider } from "./context/SessionContext";
import { ThemeProvider } from "./theme/ThemeContext";

const App = () => {
  return (
    <ThemeProvider>
      <SessionProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/topics" element={<TopicSelection />} />
            <Route path="/interview/:problemId" element={<Interview />} />
            <Route path="/analysis" element={<Analysis />} />
            <Route path="/dashboard" element={<Dashboard />} />
          </Routes>
        </Router>
      </SessionProvider>
    </ThemeProvider>
  );
};

export default App;
