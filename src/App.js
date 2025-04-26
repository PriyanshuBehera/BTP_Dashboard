import React, { useState, useEffect } from 'react';
import { getDatabase, ref, get } from 'firebase/database';
import { initializeApp } from 'firebase/app';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import GaugeComponent from 'react-gauge-component';
import Sidebar from './components/Sidebar';
import StatCard from './components/StatCard';
import './App.css';
import Home from './components/Home';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD9MJZHVjh7tDUQs2YNuEkbcHD2HXL-rj8",
  authDomain: "latest-dashboard.firebaseapp.com",
  databaseURL: "https://latest-dashboard-default-rtdb.firebaseio.com",
  projectId: "latest-dashboard",
  storageBucket: "latest-dashboard.firebasestorage.app",
  messagingSenderId: "969654334260",
  appId: "1:969654334260:web:89004bdf24cfd16ed5eb61",
  measurementId: "G-M4LNT0RZGV"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

function App() {
  const [readings, setReadings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState(7); // Default: 7 days
  const [selectedParameter, setSelectedParameter] = useState('ch4'); // Default parameter
  const [stats, setStats] = useState({
    current: 0,
    min: 0,
    max: 0,
    avg: 0
  });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [darkMode, setDarkMode] = useState(() => {
    // Check if user has a preference stored in localStorage
    const savedMode = localStorage.getItem('darkMode');
    return savedMode ? JSON.parse(savedMode) : false;
  });
  
  // Parameter ranges and colors
  const parameterConfig = {
    ch4: {
      label: 'Methane (CH₄)',
      min: 0,
      max: 1800,
      colors: ['#5BE12C', '#F5CD19', '#EA4228'],
      ranges: [
        { limit: 600, color: '#5BE12C', showTick: true },
        { limit: 1200, color: '#F5CD19', showTick: true },
        { limit: 1800, color: '#EA4228', showTick: true }
      ]
    },
    mq135: {
      label: 'MQ135 Sensor',
      min: 0,
      max: 1000,
      colors: ['#5BE12C', '#F5CD19', '#EA4228'],
      ranges: [
        { limit: 400, color: '#5BE12C', showTick: true },
        { limit: 700, color: '#F5CD19', showTick: true },
        { limit: 1000, color: '#EA4228', showTick: true }
      ]
    },
    voc: {
      label: 'Volatile Organic Compound(VOC)',
      min: 0,
      max: 50,
      colors: ['#5BE12C', '#F5CD19', '#EA4228'],
      ranges: [
        { limit: 10, color: '#5BE12C', showTick: true },
        { limit: 30, color: '#F5CD19', showTick: true },
        { limit: 50, color: '#EA4228', showTick: true }
      ]
    },
    etoh: {
      label: 'Ethanol',
      min: 0,
      max: 1000,
      colors: ['#5BE12C', '#F5CD19', '#EA4228'],
      ranges: [
        { limit: 300, color: '#5BE12C', showTick: true },
        { limit: 600, color: '#F5CD19', showTick: true },
        { limit: 1000, color: '#EA4228', showTick: true }
      ]
    },
    temperature: {
      label: 'Temperature',
      min: 0,
      max: 50,
      colors: ['#5BE12C', '#F5CD19', '#EA4228'],
      ranges: [
        { limit: 15, color: '#5BE12C', showTick: true },
        { limit: 30, color: '#F5CD19', showTick: true },
        { limit: 50, color: '#EA4228', showTick: true }
      ]
    },
    humidity: {
      label: 'Humidity',
      min: 0,
      max: 100,
      colors: ['#EA4228', '#F5CD19', '#5BE12C'],
      ranges: [
        { limit: 30, color: '#EA4228', showTick: true },
        { limit: 60, color: '#F5CD19', showTick: true },
        { limit: 100, color: '#5BE12C', showTick: true }
      ]
    },
    
  };

  useEffect(() => {
    // Apply dark mode class to body
    if (darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
    // Save preference to localStorage
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  useEffect(() => {
    fetchData();
    const intervalId = setInterval(() => {
      fetchData();
    }, 50000);
    return () => {
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (readings.length > 0) {
      calculateStats();
    }
  }, [readings, selectedParameter, timeRange]);

  // const fetchData = async () => {
  //   try {
  //     setLoading(true);
  //     const readingsRef = ref(database, 'readings');
  //     const snapshot = await get(readingsRef);
  //     if (snapshot.exists()) {
  //       const data = snapshot.val();
  //       // Convert the object to an array and sort by timestamp
  //       const readingsArray = Object.values(data).sort((a, b) => a.timestamp - b.timestamp);
  //       setReadings(readingsArray);
  //     } else {
  //       setReadings([]);
  //     }
  //     setLoading(false);
  //   } catch (err) {
  //     console.error("Error fetching data:", err);
  //     setError("Failed to fetch data. Please try again later.");
  //     setLoading(false);
  //   }
  // };
  function timestampToTime(unixTimestamp) {
    const need = Number(unixTimestamp);

    const date = new Date(need * 1000); // Convert to milliseconds
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
  
    return `${hours}:${minutes}:${seconds}`;
  }
  function getDateFromUnix(unixTimestamp) {
    const need = Number(unixTimestamp);
    const date = new Date(need*1000); // Convert to milliseconds
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Months are 0-indexed
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  const fetchData = async () => {
    setLoading(true);
    try {
      const dbRef = ref(database, 'readings');
      const snapshot = await get(dbRef);
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        const formattedReadings = [];
        
        // Convert the object of readings to an array
        Object.keys(data).forEach(key => {
          const reading = data[key];
          formattedReadings.push({
            timestamp: parseInt(key), // The key is now the Unix timestamp
            // time: reading.timestamp || "", // The formatted time string
            parameters: {
              ch4: reading.ch4 || 0,
              voc: reading.voc || 0, // Assuming etoh is CO based on your data
              mq135: reading.mq135 || 0, // Assuming mq135 is CO2 based on your data
              temperature: reading.temperature || 0,
              humidity: reading.humidity || 0,
              etoh: reading.etoh || 0
            },
            units:{
              ch4:  'ppm',
              voc:  'ppm',
              mq135: 'ppm',
              temperature: '°C',
              humidity: '%',
              etoh: 'ppm'
            },
            time: timestampToTime(key),
            date: getDateFromUnix(key),
            // Add other properties if needed
            // temperature: reading.temperature,
            // humidity: reading.humidity,
            // voc: reading.voc
          });
        });
        
        // Sort by timestamp (newest first)
        formattedReadings.sort((a, b) => a.timestamp - b.timestamp);
        setReadings(formattedReadings);
      } else {
        setReadings([]);
      }
      setLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      setError(error.message);
      setLoading(false);
    }
  };
  
  const filterReadingsByTimeRange = () => {
    if (!readings.length) return [];
    const currentTime = new Date().getTime();
    const timeRangeInMs = timeRange * 24 * 60 * 60 *1000; // Convert days to milliseconds
    return readings.filter(reading => {
      const need = reading.timestamp * 1000;
      return (currentTime - need) <= timeRangeInMs;
    });
  };

  const calculateStats = () => {
    const filteredData = filterReadingsByTimeRange();
    if (filteredData.length === 0) return;
    const values = filteredData.map(reading => reading.parameters[selectedParameter]);
    const current = values[values.length - 1];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    setStats({
      current,
      min,
      max,
      avg: parseFloat(avg.toFixed(2))
    });
  };

  const filteredReadings = filterReadingsByTimeRange();
  
  // Get current values for all parameters
  const getCurrentValues = () => {
    if (!filteredReadings.length) return { ch4: 0, mq135: 0, voc: 0, temperature: 0, humidity: 0, etoh: 0 };
  const latestReading = filteredReadings[0]; // Since readings are sorted newest first
  return latestReading.parameters || { ch4: 0, mq135: 0, voc: 0, temperature: 0, humidity: 0, etoh: 0 };
  };
  
  const currentValues = getCurrentValues();

  // Prepare chart data
  const prepareChartData = () => {
    const labels = filteredReadings.map(reading => `${reading.date} ${reading.time.substring(0, 5)}`);
    console.log("Labels:", filteredReadings.map(reading => `${reading.date} ${reading.time.substring(0, 5)}`));
    const unit = filteredReadings.length > 0 ? filteredReadings[0].units[selectedParameter] : '';
    const datasets = [
      {
        label: `${selectedParameter.toUpperCase()} (${unit})`,
        data: filteredReadings.map(reading => reading.parameters[selectedParameter]),
        borderColor: getParameterColor(selectedParameter),
        backgroundColor: getParameterColor(selectedParameter, 0.2),
        tension: 0.1
      }
    ];
    // console.log("Chart Data:", filteredReadings.map(reading => reading.parameters[selectedParameter]));
    return { labels, datasets };
  };

  const getParameterColor = (param, alpha = 1) => {
    const colors = {
      ch4: `rgba(255, 99, 132, ${alpha})`,
      mq135: `rgba(54, 162, 235, ${alpha})`,
      voc: `rgba(75, 192, 192, ${alpha})`,
      temperature: `rgba(255, 159, 64, ${alpha})`,
      humidity: `rgba(153, 102, 255, ${alpha})`,
      etoh: `rgba(201, 203, 107, ${alpha})`
    };
    return colors[param] || `rgba(128, 128, 128, ${alpha})`;
  };

  // Update the chartOptions in App.js
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: darkMode ? '#e0e0e0' : '#666',
          boxWidth: 12,
          padding: 10
        }
      },
      title: {
        display: true,
        text: `${selectedParameter.toUpperCase()} Readings Over Time`,
        font: {
          size: 16
        },
        padding: {
          top: 10,
          bottom: 10
        },
        color: darkMode ? '#e0e0e0' : '#333'
      },
      tooltip: {
        callbacks: {
          title: function(tooltipItems) {
            return tooltipItems[0].label;
          }
        }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Date & Time',
          color: darkMode ? '#e0e0e0' : '#666'
        },
        ticks: {
          color: darkMode ? '#e0e0e0' : '#666',
          maxRotation: 45,
          minRotation: 0
        },
        grid: {
          color: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
        }
      },
      y: {
        title: {
          display: true,
          text: filteredReadings.length > 0 ? `Value (${filteredReadings[0].units[selectedParameter]})` : 'Value',
          color: darkMode ? '#e0e0e0' : '#666'
        },
        ticks: {
          color: darkMode ? '#e0e0e0' : '#666'
        },
        grid: {
          color: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
        }
      }
    }
  };

  const handleParameterChange = (parameter) => {
    setSelectedParameter(parameter);
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };
  const [currentView, setCurrentView] = useState('home'); // Default view is home
  const handleNavigation = (view) => {
    setCurrentView(view);
  };
  return (
    <div className="dashboard-container">
      <Sidebar 
        isOpen={sidebarOpen} 
        onParameterChange={handleParameterChange}
        selectedParameter={selectedParameter}
        darkMode={darkMode}
        currentView={currentView}
        onNavigate={handleNavigation}
      />
      
      <div className={`main-content ${sidebarOpen ? 'with-sidebar' : 'full-width'}`}>
        <div className="header-controls">
          <button className="toggle-sidebar" onClick={toggleSidebar}>
            {sidebarOpen ? '←' : '→'}
          </button>
          <button className="toggle-dark-mode" onClick={toggleDarkMode}>
            {darkMode ? '☀️' : '🌙'}
          </button>
        </div>
        
        {currentView === 'home' ? (
        <Home 
        currentValues={getCurrentValues()} 
        parameterConfig={parameterConfig} 
        database={database}
        />
      ) : (
        <>
          <header>
            <h1>Gas Monitoring Dashboard</h1>
          </header>
          
          <div className="time-range-selector">
            <label htmlFor="timeRange">Time Range:</label>
            <select 
              id="timeRange" 
              value={timeRange} 
              onChange={(e) => setTimeRange(parseInt(e.target.value))}
            >
              <option value={1}>Last 24 Hours</option>
              <option value={7}>Last 7 Days</option>
              <option value={30}>Last 30 Days</option>
              <option value={90}>Last 90 Days</option>
            </select>
          </div>
          
          <div className="stats-container">
            <StatCard title="Current" value={stats.current} unit={filteredReadings.length > 0 ? filteredReadings[0].units[selectedParameter] : ''} />
            <StatCard title="Minimum" value={stats.min} unit={filteredReadings.length > 0 ? filteredReadings[0].units[selectedParameter] : ''} />
            <StatCard title="Maximum" value={stats.max} unit={filteredReadings.length > 0 ? filteredReadings[0].units[selectedParameter] : ''} />
            <StatCard title="Average" value={stats.avg} unit={filteredReadings.length > 0 ? filteredReadings[0].units[selectedParameter] : ''} />
          </div>
          
          <div className="chart-container">
            {loading ? (
              <div className="loading-message">Loading data...</div>
            ) : error ? (
              <div className="error-message">{error}</div>
            ) : filteredReadings.length === 0 ? (
              <div className="no-data-message">No data available for the selected time range.</div>
            ) : (
              <Line data={prepareChartData()} options={chartOptions} />
            )}
          </div>
        </>
      )}
    </div>
  </div>
);
}

export default App;
