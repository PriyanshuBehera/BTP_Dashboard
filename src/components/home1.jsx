// components/Home.jsx
import React, { useState, useEffect } from 'react';
import GaugeComponent from 'react-gauge-component';
import { ref, get } from 'firebase/database';
import './Home.css';

const Home = ({ currentValues: initialValues, parameterConfig, database }) => {
  const [currentValues, setCurrentValues] = useState(initialValues || {});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Function to fetch the latest data
  const fetchData = async () => {
    try {
      setLoading(true);
      const readingsRef = ref(database, 'readings');
      const snapshot = await get(readingsRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        // Convert the object to an array and sort by timestamp
        const readingsArray = Object.values(data).sort((a, b) => a.timestamp - b.timestamp);
        
        // Get the latest reading
        const latestReading = readingsArray[readingsArray.length - 1];
        
        // Update the current values with the latest parameters
        if (latestReading && latestReading.parameters) {
          setCurrentValues(latestReading.parameters);
        }
      }
      setLoading(false);
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Failed to fetch data. Please try again later.");
      setLoading(false);
    }
  };

  // Set up auto-refresh interval
  useEffect(() => {
    // Fetch data immediately when component mounts
    fetchData();
    
    // Set up interval to fetch data every 15 seconds
    const intervalId = setInterval(fetchData, 15000);
    
    // Clean up interval when component unmounts
    return () => clearInterval(intervalId);
  }, [database]); // Add database as a dependency

  // Handle the case where parameterConfig might be undefined or null
  if (!parameterConfig) {
    return <div className="loading-message">Loading configuration...</div>;
  }

  return (
    <div className="home-page">
      <h1>Dashboard Overview</h1>
      {error && <div className="error-message">{error}</div>}
      {loading && <div className="loading-message">Updating data...</div>}
      <div className="gauges-container">
        {Object.keys(parameterConfig).map((param) => (
          <div key={param} className="gauge-wrapper">
            <h3>{parameterConfig[param].label}</h3>
            <GaugeComponent
              id={`gauge-${param}`}
              type="radial"
              arc={{
                width: 0.2,
                padding: 0.02,
                subArcs: parameterConfig[param].ranges
              }}
              pointer={{
                elastic: true,
                animationDelay: 0
              }}
              labels={{
                valueLabel: {
                  formatTextValue: value => `${value} ${param}`,
                  style: { textShadow: 'none' }
                }
              }}
              value={currentValues[param] || 0}
              minValue={parameterConfig[param].min}
              maxValue={parameterConfig[param].max}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default Home;
