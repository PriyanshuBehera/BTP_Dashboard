// components/StatCard.jsx
import React from 'react';
import './StatCard.css';

const StatCard = ({ title, value, unit, darkMode }) => {
  return (
    <div className={`stat-card ${darkMode ? 'dark' : ''}`}>
      <div className="stat-title">{title}</div>
      <div className="stat-value">
        {value} <span className="stat-unit">{unit}</span>
      </div>
    </div>
  );
};

export default StatCard;
