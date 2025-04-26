import React from 'react';
import './DarkModeToggle.css';

const DarkModeToggle = ({ isDarkMode, toggleDarkMode }) => {
  return (
    <div className="dark-mode-toggle">
      <input
        type="checkbox"
        id="dark-mode-switch"
        checked={isDarkMode}
        onChange={toggleDarkMode}
      />
      <label htmlFor="dark-mode-switch">
        <span className="toggle-icon">
          {isDarkMode ? '🌙' : '☀️'}
        </span>
      </label>
    </div>
  );
};

export default DarkModeToggle;
