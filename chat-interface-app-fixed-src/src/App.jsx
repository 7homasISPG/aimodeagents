import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MainLayout from './components/MainLayout';
import MainLayout1 from './components/homepage';
import SuperAgentProfile from './components/SuperAgentProfile';
import AgentsList from './components/AgentsList';
import AIAssistancePanel from './components/AIAssistancePanel';  
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<MainLayout1 />} />
          <Route path="/ai-assistance" element={<MainLayout />} />
          <Route path="/" element={<SuperAgentProfile />} />
          <Route path="/agents" element={<AgentsList />} />
          <Route path="/agents/:agentId" element={<AIAssistancePanel />} />
          
        </Routes>
      </div>
    </Router>
  );
}

export default App;


