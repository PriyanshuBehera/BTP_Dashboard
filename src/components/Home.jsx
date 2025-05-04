// components/Home.jsx
import React, { useState, useEffect, useRef } from 'react';
import GaugeComponent from 'react-gauge-component';
import emailjs from '@emailjs/browser';
import { ref, get } from 'firebase/database';

import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './Home.css';

// Define threshold values based on safety standards
const THRESHOLDS = {
  ch4: { warning: 1200, danger: 1700 }, // Methane thresholds in ppm
  mq135: { warning: 240, danger: 100 }, // CO2 thresholds in ppm
  voc: { warning: 1000, danger: 1100 }, // CO thresholds in ppm
  etoh: { warning: 400, danger: 600 },
  temperature: { warning: 50, danger: 50 }, // Temperature thresholds in Celsius
  humidity: { warning: 110, danger: 110 }, // Humidity thresholds in %
   // Ethanol thresholds in ppm
};
// Add these constants at the top of your file, after the THRESHOLDS
const FRUIT_CLASSIFICATION = {
  // These weights should be replaced with your actual learned weights
  weights: {
    ch4: 0.0141,      // Methane has strong positive correlation with rottenness
    mq135: -0.0353,    // CO2 has moderate positive correlation
    voc: -0.0228,      // VOCs have strong positive correlation
    temperature: 0,  // Temperature has some positive correlation
    humidity: 0,     // Humidity has moderate positive correlation
    etoh: 0.0281    // Ethanol has strong positive correlation with rottenness
  },
  // Threshold for classification (adjust based on your model)
  threshold: 0,
  // Bias term (adjust based on your model)
  bias: -0.0001
};

// Add this function inside your Home component
const classifyFruit = (parameters) => {
  if (!parameters) return { isRotten: false, score: 0 };
  
  // Calculate weighted sum
  let weightedSum = FRUIT_CLASSIFICATION.bias; // Start with bias
  
  Object.keys(FRUIT_CLASSIFICATION.weights).forEach(param => {
    if (parameters[param] !== undefined) {
      weightedSum += parameters[param] * FRUIT_CLASSIFICATION.weights[param];
    }
  });
  // Classify based on threshold
  console.log(weightedSum>FRUIT_CLASSIFICATION.threshold);
  return {
    isRotten: weightedSum > FRUIT_CLASSIFICATION.threshold,
    score: weightedSum,
    confidence: Math.min(100, Math.abs(weightedSum - FRUIT_CLASSIFICATION.threshold) / 10)
  };
};

// Add these helper functions at the top of your component
const getProcessedAlerts = () => {
  try {
    const stored = localStorage.getItem('processedAlerts');
    return stored ? JSON.parse(stored) : {};
  } catch (e) {
    console.error('Error retrieving processed alerts:', e);
    return {};
  }
};

const saveProcessedAlert = (key, value) => {
  try {
    const current = getProcessedAlerts();
    current[key] = value;
    localStorage.setItem('processedAlerts', JSON.stringify(current));
  } catch (e) {
    console.error('Error saving processed alert:', e);
  }
};

const Home = ({ currentValues: initialValues, parameterConfig, database }) => {
  const [values, setValues] = useState(initialValues || {});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Use ref to store the current state of all parameters
  const currentParameterState = useRef({});
  // Track when the last email was sent
  const lastEmailSentTimestamp = useRef(0);
  // Track if any parameter has changed since last email
  const parametersChangedSinceLastEmail = useRef(false);
  // Store alerts that need to be sent
  const pendingAlerts = useRef({});
  
  // NEW: Track the last processed reading timestamp
  const lastProcessedReadingTimestamp = useRef(null);
  // NEW: Store alerts that have been shown for specific readings
  const processedAlerts = useRef({});

  // Initialize EmailJS
  useEffect(() => {
    emailjs.init({
      publicKey: "Bwjq5xlve-RdAY9qI", // Replace with your EmailJS public key
    });
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const readingsRef = ref(database, 'readings');
      const snapshot = await get(readingsRef);
      const formattedReadings = [];
  
      if (snapshot.exists()) {
        const data = snapshot.val();
        // Convert the object to an array and sort by timestamp
        Object.keys(data).forEach(key => {
          const reading = data[key];
          formattedReadings.push({
            timestamp: parseInt(key), // The key is now the Unix timestamp
            parameters: {
              ch4: reading.ch4 || 0,
              mq135: reading.mq135 || 0,
              voc: reading.voc || 0,
              temperature: reading.temperature || 0,
              humidity: reading.humidity || 0,
              etoh: reading.etoh || 0
            }
          });
        });
        
        formattedReadings.sort((a, b) => a.timestamp - b.timestamp);
  
        const latestReading = formattedReadings[formattedReadings.length - 1];
      
        if (latestReading && latestReading.parameters) {
          setValues(latestReading.parameters);
          
          // Check if we've already processed this reading timestamp
          const processedAlerts = getProcessedAlerts();
          if (!processedAlerts[`reading_${latestReading.timestamp}`]) {
            checkThresholds(latestReading.parameters, latestReading.timestamp);
          }
        }
      }
      setLoading(false);
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Failed to fetch data. Please try again later.");
      setLoading(false);
    }
  };
  
  
  // Modified to accept timestamp parameter
  const checkThresholds = (newValues, timestamp) => {
    if (!newValues || !timestamp) return;
    
    let hasChanges = false;
    const currentAlerts = {};
    const processedAlerts = getProcessedAlerts();
    const fruitStatus = classifyFruit(newValues);
  
    // Create a unique key for fruit classification alert
    const fruitAlertKey = `fruit_classification_${timestamp}`;
    
    // Show fruit classification result if not already processed
    if (!processedAlerts[fruitAlertKey]) {
      const message = fruitStatus.isRotten 
        ? `ALERT: Fruit is likely ROTTEN`
        : `INFO: Fruit appears to be FRESH`;
      
      showToastAlert(message, fruitStatus.isRotten ? 'error' : 'success', fruitAlertKey);
      saveProcessedAlert(fruitAlertKey, true);
      console.log(fruitStatus.isRotten);
      // Add fruit status to alerts if rotten
      if (fruitStatus.isRotten) {
        currentAlerts.fruitStatus = {
          value: 'ROTTEN',
          severity: 'danger',
          score: fruitStatus.score,
          confidence: fruitStatus.confidence
        };
        hasChanges = true;
      }
    }
    Object.keys(newValues).forEach(param => {
      const value = newValues[param];
      const threshold = THRESHOLDS[param];
      
      if (!threshold) return;
      
      // Check if value exceeds danger threshold
      if(param === 'mq135'){
        if (value <= threshold.warning) {
          currentAlerts[param] = {
            value,
            severity: 'warning',
            threshold: threshold.warning,
            label: parameterConfig[param]?.label || param.toUpperCase()
          };
          
          // Create a unique key for this alert
          const alertKey = `${param}_warning_${timestamp}`;
          
          // Only show toast if we haven't processed this alert before
          if (!processedAlerts[alertKey]) {
            hasChanges = true;
            
            // Show toast for this parameter
            const message = `WARNING: ${parameterConfig[param].label} level is at ${value}, which exceeds the warning threshold of ${threshold.warning}`;
            showToastAlert(message, 'warning', alertKey);
            
            // Mark this alert as processed
            saveProcessedAlert(alertKey, true);
          }
        }
      else if (value <= threshold.danger) {
        currentAlerts[param] = {
          value,
          severity: 'danger',
          threshold: threshold.danger,
          label: parameterConfig[param]?.label || param.toUpperCase()
        };
        
        // Create a unique key for this alert
        const alertKey = `${param}_danger_${timestamp}`;
        
        // Only show toast if we haven't processed this alert before
        if (!processedAlerts[alertKey]) {
          hasChanges = true;
          
          // Show toast for this parameter
          const message = `DANGER: ${parameterConfig[param].label} level is at ${value}, which exceeds the danger threshold of ${threshold.danger}`;
          showToastAlert(message, 'error', alertKey);
          
          // Mark this alert as processed
          saveProcessedAlert(alertKey, true);
        }
      }
      // Check if value exceeds warning threshold
      
    }
    else{
      if (value >= threshold.danger) {
        currentAlerts[param] = {
          value,
          severity: 'danger',
          threshold: threshold.danger,
          label: parameterConfig[param]?.label || param.toUpperCase()
        };
        
        // Create a unique key for this alert
        const alertKey = `${param}_danger_${timestamp}`;
        
        // Only show toast if we haven't processed this alert before
        if (!processedAlerts[alertKey]) {
          hasChanges = true;
          
          // Show toast for this parameter
          const message = `DANGER: ${parameterConfig[param].label} level is at ${value}, which exceeds the danger threshold of ${threshold.danger}`;
          showToastAlert(message, 'error', alertKey);
          
          // Mark this alert as processed
          saveProcessedAlert(alertKey, true);
        }
      }
      // Check if value exceeds warning threshold
      else if (value >= threshold.warning) {
        currentAlerts[param] = {
          value,
          severity: 'warning',
          threshold: threshold.warning,
          label: parameterConfig[param]?.label || param.toUpperCase()
        };
        
        // Create a unique key for this alert
        const alertKey = `${param}_warning_${timestamp}`;
        
        // Only show toast if we haven't processed this alert before
        if (!processedAlerts[alertKey]) {
          hasChanges = true;
          
          // Show toast for this parameter
          const message = `WARNING: ${parameterConfig[param].label} level is at ${value}, which exceeds the warning threshold of ${threshold.warning}`;
          showToastAlert(message, 'warning', alertKey);
          
          // Mark this alert as processed
          saveProcessedAlert(alertKey, true);
        }
      }
    }
    });
    
    // Update our current state reference
    currentParameterState.current = currentAlerts;
    
    // If we have changes, mark that parameters have changed since last email
    if (hasChanges) {
      parametersChangedSinceLastEmail.current = true;
      pendingAlerts.current = currentAlerts;
    }
    
    // Create a unique key for this email alert
    const emailAlertKey = `email_${timestamp}`;
    
    // Check if we've already sent an email for this timestamp
    const now = Date.now();
    if(fruitStatus.isRotten){
    if (Object.keys(currentAlerts).length > 0 && 
        !processedAlerts[emailAlertKey] &&
        now - lastEmailSentTimestamp.current > 60000) { // Still keep rate limiting
      
      sendConsolidatedEmailAlert(currentAlerts, timestamp);
      lastEmailSentTimestamp.current = now;
      parametersChangedSinceLastEmail.current = false;
      
      // Mark this email as sent
      saveProcessedAlert(emailAlertKey, true);
    }
  }
    // Mark this reading as processed
    saveProcessedAlert(`reading_${timestamp}`, true);
  };
  
  // Modified to accept alertKey parameter
  const showToastAlert = (message, type, alertKey) => {
    switch(type) {
      case 'error':
        toast.error(message, {
          toastId: alertKey, // Use the alertKey as the toast ID to prevent duplicates
          position: "top-right",
          autoClose: 10000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
        break;
      case 'warning':
        toast.warning(message, {
          toastId: alertKey, // Use the alertKey as the toast ID to prevent duplicates
          position: "top-right",
          autoClose: 10000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
        break;
      default:
        toast.info(message, {
          toastId: alertKey, // Use the alertKey as the toast ID to prevent duplicates
          position: "top-right",
          autoClose: 10000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
    }
  };
  

  // Modified to accept timestamp parameter
  const sendConsolidatedEmailAlert = async (alerts, timestamp) => {
    try {
      // Determine the highest severity for the subject line
      const hasDanger = Object.values(alerts).some(alert => alert.severity === 'danger');
      const severity = hasDanger ? 'DANGER' : 'WARNING';
      
      // Create a formatted message with all alerts
      let alertMessage = `Environmental Monitoring Alert - ${new Date(timestamp).toLocaleString()}\n\n`;
      alertMessage += "The following parameters have exceeded their thresholds:\n\n";
      
      Object.keys(alerts).forEach(param => {
        const alert = alerts[param];
        alertMessage += `${alert.label}: ${alert.value} (${alert.severity.toUpperCase()} - Threshold: ${alert.threshold})\n`;
      });
      
      const templateParams = {
        subject: `Fruit rotten`,
        message: alertMessage,
        timestamp: new Date(timestamp).toLocaleString(),
        // Create individual fields for each parameter for template flexibility
        ch4_value: alerts.ch4 ? alerts.ch4.value : 'Normal',
        ch4_status: alerts.ch4 ? alerts.ch4.severity.toUpperCase() : 'Normal',
        mq135_value: alerts.mq135 ? alerts.mq135.value : 'Normal',
        mq135_status: alerts.mq135 ? alerts.mq135.severity.toUpperCase() : 'Normal',
        voc_value: alerts.voc ? alerts.voc.value : 'Normal',
        voc_status: alerts.voc ? alerts.voc.severity.toUpperCase() : 'Normal',
        temperature_value: alerts.temperature ? alerts.temperature.value : 'Normal',
        temperature_status: alerts.temperature ? alerts.temperature.severity.toUpperCase() : 'Normal',
        humidity_value: alerts.humidity ? alerts.humidity.value : 'Normal',
        humidity_status: alerts.humidity ? alerts.humidity.severity.toUpperCase() : 'Normal',
        etoh_value: alerts.etoh ? alerts.etoh.value : 'Normal',
        etoh_status: alerts.etoh ? alerts.etoh.severity.toUpperCase() : 'Normal'
      };
      
      const response = await emailjs.send(
        'service_479nahw', // Replace with your EmailJS service ID
        'template_uws417s', // Replace with your EmailJS template ID
        templateParams
      );
      
      if (response.status === 200) {
        console.log(`Consolidated email alert sent with ${Object.keys(alerts).length} parameters for timestamp ${timestamp}`);
        showToastAlert(`Email Sent`, '', `email_error_${timestamp}`);

      }
    } catch (error) {
      console.error('Error sending consolidated email alert:', error);
      showToastAlert(`Failed to send email alert: ${error.message}`, 'error', `email_error_${timestamp}`);
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
      {loading && <div className="loading-indicator">Updating data...</div>}
      
      {/* React Toastify Container */}
      <ToastContainer 
        position="top-right"
        autoClose={10000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
  <div className={`fruit-status-container ${classifyFruit(values).isRotten ? 'rotten' : 'fresh'}`}>
  <h2>Fruit Status</h2>
  <div className="status-indicator">
    {classifyFruit(values).isRotten ? 
      <span className="status rotten">ROTTEN</span> : 
      <span className="status fresh">FRESH</span>
    }
  </div>
  {/* <div className="confidence">
    Confidence: {classifyFruit(values).confidence.toFixed(1)}%
  </div> */}
  <div className="score">
    Score: {classifyFruit(values).score.toFixed(2)}
  </div>
</div>

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
                  formatTextValue: value => `${value} ${param === 'temperature' ? '' : param === 'humidity' ? '' : ''}`,
                  style: { textShadow: 'none' }
                }
              }}
              value={values[param] || 0}
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
