import React from 'react';
import './Sidebar.css';

const Sidebar = ({ onParameterChange, selectedParameter, isOpen, onNavigate, currentView }) => {
  const parameters = [
    { id: 'home', name: 'Home', icon: '🏠' },
    { id: 'temperature', name: 'Temperature (°C)', icon: '🌡️' },
    { id: 'humidity', name: 'Humidity (%)', icon: '💧' },
    { id: 'ch4', name: 'Methane (CH4)', icon: '🔥' },
    { id: 'etoh', name: 'Ethanol (EtOH)', icon: '🍸' },
    { id: 'mq135', name: 'MQ135 Sensor', icon: '🔍' },
    {id: 'voc', name: 'Volatile Organic Compounds (VOC)', icon: '🧪'},
    ];

  const handleItemClick = (id) => {
    if (id === 'home') {
      onNavigate('home');
    } else {
      onParameterChange(id);
      onNavigate('chart');
    }
  };

  return (
    <div className={`sidebar ${isOpen ? 'open' : 'closed'}`}>
      <div className="sidebar-header">
        <h2>Gas Monitor</h2>
      </div>
      <div className="sidebar-menu">
        {parameters.map(param => (
          <div
            key={param.id}
            className={`sidebar-item ${
              (param.id === 'home' && currentView === 'home') || 
              (param.id === selectedParameter && currentView === 'chart') ? 'active' : ''
            }`}
            onClick={() => handleItemClick(param.id)}
          >
            <span className="sidebar-icon">{param.icon}</span>
            <span className="sidebar-text">{param.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Sidebar;
