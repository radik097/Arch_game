import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Pages.css';

export const AboutPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="page-container about-page">
      <header className="page-header">
        <button className="back-btn" onClick={() => navigate('/')}>← BACK_TO_MAP</button>
        <h1>ABOUT_ARCH_TRAINER</h1>
      </header>
      
      <main className="page-content">
        <section className="info-card">
          <h2>THE_SIMULATOR</h2>
          <p>
            Arch Trainer is a high-fidelity terminal simulation designed to teach 
            the logic and workflow of installing Arch Linux. It provides a safe, 
            sandboxed environment where you can practice complex commands 
            without risking your actual hardware.
          </p>
        </section>

        <section className="info-card">
          <h2>VIRTUALIZATION</h2>
          <p>
            Beyond simulation, Arch Trainer includes a WebAssembly-powered 
            virtual machine (V86) that runs the real Arch Linux ISO. This allows 
            for a seamless transition from conceptual learning to actual 
            implementation.
          </p>
        </section>

        <section className="info-card tech-specs">
          <h2>TECH_STACK</h2>
          <ul>
            <li>React + Vite</li>
            <li>XTerm.js for Terminal Emulation</li>
            <li>Custom Game Engine for System Logic</li>
            <li>V86 for x86 Virtualization</li>
          </ul>
        </section>
      </main>
    </div>
  );
};
