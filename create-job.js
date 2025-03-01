// IndexedDB database configuration
const DB_NAME = 'CareerBridgeDB';
const DB_VERSION = 1;
const JOB_STORE_NAME = 'JobPostings';

// At the top of your file, add a debug flag
const DEBUG_MODE = false; // Set to true to enable database viewer

document.addEventListener('DOMContentLoaded', () => {
  // Regular setup code...
  
  // Only show the database viewer in debug mode
  if (DEBUG_MODE) {
    addDatabaseViewerButton();
  }
});

// Wait for DOM to be fully loaded before adding event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Initialize the database
  initDatabase();
  
  // Add event listener to the form submit button
  const jobListingForm = document.getElementById('jobListingForm');
  jobListingForm.addEventListener('submit', handleFormSubmit);
  
  // Add event listener to cancel button
  const cancelButton = document.querySelector('.btn-cancel');
  cancelButton.addEventListener('click', () => {
    jobListingForm.reset();
    clearErrorMessage();
  });
  
  // Add fake location suggestions functionality for demo purposes
  setupLocationSuggestions();
  
  // Create error message container if it doesn't exist
  createErrorContainer();
});

/**
 * Create error message container at the top of the form
 */
function createErrorContainer() {
  // Check if error container already exists
  if (!document.getElementById('errorContainer')) {
    const formContent = document.querySelector('.form-content');
    const form = document.getElementById('jobListingForm');
    
    // Create error container
    const errorContainer = document.createElement('div');
    errorContainer.id = 'errorContainer';
    errorContainer.className = 'error-container';
    errorContainer.style.display = 'none';
    errorContainer.style.backgroundColor = '#ffecec';
    errorContainer.style.color = '#d8000c';
    errorContainer.style.padding = '10px';
    errorContainer.style.borderRadius = '4px';
    errorContainer.style.marginBottom = '20px';
    errorContainer.style.fontSize = '14px';
    errorContainer.style.fontWeight = 'bold';
    
    // Insert at the top of the form
    formContent.insertBefore(errorContainer, form);
  }
}

/**
 * Initialize the IndexedDB database with proper schema
 */
function initDatabase() {
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  
  // Handle database upgrade (called when DB is created or version changes)
  request.onupgradeneeded = (event) => {
    const db = event.target.result;
    
    // Create JobPostings object store if it doesn't exist
    if (!db.objectStoreNames.contains(JOB_STORE_NAME)) {
      // Create the store with auto-increment key
      const jobStore = db.createObjectStore(JOB_STORE_NAME, { 
        keyPath: 'id', 
        autoIncrement: true 
      });
      
      // Define indexes for searching
      jobStore.createIndex('jobTitle', 'jobTitle', { unique: false });
      jobStore.createIndex('company', 'company', { unique: false });
      jobStore.createIndex('jobType', 'jobType', { unique: false });
      jobStore.createIndex('location', 'location', { unique: false });
      jobStore.createIndex('workArrangement', 'workArrangement', { unique: false });
      jobStore.createIndex('jobStatus', 'jobStatus', { unique: false });
      
      console.log('Database schema created successfully');
    }
  };
  
  // Handle database open success
  request.onsuccess = (event) => {
    console.log('Database initialized successfully');
  };
  
  // Handle database open error
  request.onerror = (event) => {
    console.error('Error opening database:', event.target.error);
    showError('Database error: ' + event.target.error);
  };
}

/**
 * Handle form submission
 * @param {Event} event - The form submit event
 */
function handleFormSubmit(event) {
  event.preventDefault();
  
  // Clear any existing error messages
  clearErrorMessage();
  
  // Collect form data
  const jobData = {
    jobTitle: document.getElementById('jobTitle').value.trim(),
    company: document.getElementById('company').value.trim(),
    jobType: document.getElementById('jobType').value,
    location: document.getElementById('location').value.trim(),
    workArrangement: document.getElementById('workArrangement').value,
    minPay: document.getElementById('minPay').value ? parseFloat(document.getElementById('minPay').value) : null,
    maxPay: document.getElementById('maxPay').value ? parseFloat(document.getElementById('maxPay').value) : null,
    showPayInListing: document.getElementById('showPayInListing').checked,
    jobDescription: document.getElementById('jobDescription').value.trim(),
    requirements: document.getElementById('requirements').value.trim(),
    applicationDeadline: document.getElementById('applicationDeadline').value || null,
    dateCreated: new Date().toISOString(),
    jobStatus: 'Pending' // Default status for all new job postings
  };
  
  // Validate job data
  const validationResult = validateJobData(jobData);
  if (!validationResult.isValid) {
    showError(validationResult.message);
    focusInvalidField(validationResult.field);
    return;
  }
  
  // Save to IndexedDB
  saveToDatabase(jobData);
}

/**
 * Validate job data before saving
 * @param {Object} jobData - The job data to validate
 * @returns {Object} - Validation result with isValid flag, error message, and field name
 */
function validateJobData(jobData) {
  // Field display names (for nicer error messages)
  const fieldLabels = {
    jobTitle: 'Job Title',
    company: 'Company',
    jobType: 'Job Type',
    workArrangement: 'Work Arrangement',
    jobDescription: 'Job Description'
  };
  
  // Required fields validation
  const requiredFields = ['jobTitle', 'company', 'jobType', 'workArrangement', 'jobDescription'];
  for (const field of requiredFields) {
    if (!jobData[field]) {
      return {
        isValid: false,
        message: `${fieldLabels[field]} is required. Please make a selection.`,
        field: field
      };
    }
  }
  
  // Minimum length validations
  if (jobData.jobTitle.length < 3) {
    return {
      isValid: false,
      message: 'Job Title must be at least 3 characters long.',
      field: 'jobTitle'
    };
  }
  
  if (jobData.company.length < 2) {
    return {
      isValid: false,
      message: 'Company name must be at least 2 characters long.',
      field: 'company'
    };
  }
  
  if (jobData.jobDescription.length < 20) {
    return {
      isValid: false,
      message: 'Job Description must be at least 20 characters long.',
      field: 'jobDescription'
    };
  }
  
  // Pay rate validation (if provided)
  if (jobData.minPay !== null && jobData.maxPay !== null) {
    if (jobData.minPay > jobData.maxPay) {
      return {
        isValid: false,
        message: 'Minimum pay cannot be greater than maximum pay.',
        field: 'minPay'
      };
    }
    
    if (jobData.minPay < 0 || jobData.maxPay < 0) {
      return {
        isValid: false,
        message: 'Pay rates cannot be negative.',
        field: 'minPay'
      };
    }
  } else if ((jobData.minPay !== null && jobData.maxPay === null) || 
             (jobData.minPay === null && jobData.maxPay !== null)) {
    // If one pay field is provided, both should be provided
    return {
      isValid: false,
      message: 'Please provide both minimum and maximum pay rates, or leave both blank for unpaid positions.',
      field: jobData.minPay === null ? 'minPay' : 'maxPay'
    };
  }
  
  // Application deadline validation
  if (jobData.applicationDeadline) {
    const deadlineDate = new Date(jobData.applicationDeadline);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time part for accurate date comparison
    
    if (deadlineDate < today) {
      return {
        isValid: false,
        message: 'Application deadline cannot be in the past.',
        field: 'applicationDeadline'
      };
    }
  }
  
  return { isValid: true };
}

/**
 * Save job data to IndexedDB
 * @param {Object} jobData - The job data to save
 */
function saveToDatabase(jobData) {
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  
  request.onsuccess = (event) => {
    const db = event.target.result;
    const transaction = db.transaction([JOB_STORE_NAME], 'readwrite');
    const jobStore = transaction.objectStore(JOB_STORE_NAME);
    
    const addRequest = jobStore.add(jobData);
    
    addRequest.onsuccess = () => {
      showSuccess('Job listing created successfully!');
      document.getElementById('jobListingForm').reset();
    };
    
    addRequest.onerror = (event) => {
      showError('Error saving job listing: ' + event.target.error);
    };
    
    transaction.oncomplete = () => {
      console.log('Transaction completed');
    };
    
    transaction.onerror = (event) => {
      console.error('Transaction error:', event.target.error);
      showError('Transaction error: ' + event.target.error);
    };
  };
  
  request.onerror = (event) => {
    showError('Database error: ' + event.target.error);
  };
}

/**
 * Show error message in the error container
 * @param {string} message - The error message
 */
function showError(message) {
  const errorContainer = document.getElementById('errorContainer');
  errorContainer.textContent = '⚠️ ' + message;
  errorContainer.style.display = 'block';
  
  // Scroll to the top of the form to make the error visible
  errorContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Clear the error message
 */
function clearErrorMessage() {
  const errorContainer = document.getElementById('errorContainer');
  errorContainer.textContent = '';
  errorContainer.style.display = 'none';
}

/**
 * Show success message
 * @param {string} message - The success message
 */
function showSuccess(message) {
  // Create a success notification
  const successNotification = document.createElement('div');
  successNotification.className = 'success-notification';
  successNotification.textContent = '✓ ' + message;
  successNotification.style.position = 'fixed';
  successNotification.style.top = '20px';
  successNotification.style.right = '20px';
  successNotification.style.backgroundColor = '#dff2bf';
  successNotification.style.color = '#4f8a10';
  successNotification.style.padding = '12px 20px';
  successNotification.style.borderRadius = '4px';
  successNotification.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
  successNotification.style.zIndex = '1000';
  
  document.body.appendChild(successNotification);
  
  // Remove the notification after 3 seconds
  setTimeout(() => {
    successNotification.style.opacity = '0';
    successNotification.style.transition = 'opacity 0.5s';
    setTimeout(() => {
      document.body.removeChild(successNotification);
    }, 500);
  }, 3000);
}

/**
 * Focus on the invalid field
 * @param {string} fieldId - The ID of the field to focus
 */
function focusInvalidField(fieldId) {
  const field = document.getElementById(fieldId);
  if (field) {
    field.focus();
    
    // Highlight the field
    field.style.borderColor = '#d8000c';
    field.style.backgroundColor = '#ffefef';
    
    // Remove highlight after 3 seconds
    setTimeout(() => {
      field.style.borderColor = '';
      field.style.backgroundColor = '';
    }, 3000);
  }
}

/**
 * Setup basic location suggestions functionality
 * This is a simplified demo implementation
 */
function setupLocationSuggestions() {
  const locationInput = document.getElementById('location');
  const suggestionsList = document.getElementById('locationSuggestions');
  
  // Sample locations for demo
  const sampleLocations = [
    'New York, NY', 'San Francisco, CA', 'Chicago, IL', 'Austin, TX',
    'Seattle, WA', 'Boston, MA', 'Los Angeles, CA', 'Denver, CO',
    'Atlanta, GA', 'Dallas, TX', 'Miami, FL', 'Washington, DC'
  ];
  
  locationInput.addEventListener('input', () => {
    const value = locationInput.value.toLowerCase();
    suggestionsList.innerHTML = '';
    
    if (value.length < 2) {
      suggestionsList.style.display = 'none';
      return;
    }
    
    const matches = sampleLocations.filter(location => 
      location.toLowerCase().includes(value)
    );
    
    if (matches.length > 0) {
      suggestionsList.style.display = 'block';
      matches.forEach(location => {
        const suggestion = document.createElement('div');
        suggestion.className = 'location-suggestion';
        suggestion.textContent = location;
        suggestion.addEventListener('click', () => {
          locationInput.value = location;
          suggestionsList.style.display = 'none';
        });
        suggestionsList.appendChild(suggestion);
      });
    } else {
      suggestionsList.style.display = 'none';
    }
  });
  
  // Hide suggestions when clicking outside
  document.addEventListener('click', (event) => {
    if (event.target !== locationInput && !suggestionsList.contains(event.target)) {
      suggestionsList.style.display = 'none';
    }
  });  
}

// Add this function to your create-job.js file
function addDatabaseViewerButton() {
  // Create a button to view database contents
  const viewerButton = document.createElement('button');
  viewerButton.textContent = 'View Database Contents';
  viewerButton.className = 'btn';
  viewerButton.style.marginTop = '20px';
  viewerButton.style.backgroundColor = '#4CAF50';
  viewerButton.style.color = 'white';
  viewerButton.style.border = 'none';
  viewerButton.style.padding = '10px 15px';
  viewerButton.style.cursor = 'pointer';
  viewerButton.style.borderRadius = '4px';
  
  // Add viewer button to the page
  const formCard = document.querySelector('.form-card');
  formCard.parentNode.insertBefore(viewerButton, formCard.nextSibling);
  
  // Create a container for database contents
  const dbContainer = document.createElement('div');
  dbContainer.id = 'dbViewerContainer';
  dbContainer.style.marginTop = '20px';
  dbContainer.style.display = 'none';
  dbContainer.style.padding = '15px';
  dbContainer.style.backgroundColor = '#f9f9f9';
  dbContainer.style.borderRadius = '4px';
  dbContainer.style.border = '1px solid #ddd';
  
  viewerButton.parentNode.insertBefore(dbContainer, viewerButton.nextSibling);
  
  // Add event listener
  viewerButton.addEventListener('click', function() {
    displayDatabaseContents();
  });
}

// Function to display database contents
function displayDatabaseContents() {
  const container = document.getElementById('dbViewerContainer');
  container.style.display = 'block';
  container.innerHTML = '<h3>Loading Database Contents...</h3>';
  
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  
  request.onerror = function(event) {
    container.innerHTML = '<h3>Error opening database</h3><p>' + event.target.error + '</p>';
  };
  
  request.onsuccess = function(event) {
    const db = event.target.result;
    
    // Show database info
    let html = `
      <h3>Database: ${DB_NAME}</h3>
      <p>Version: ${db.version}</p>
      <p>Object Stores: ${Array.from(db.objectStoreNames).join(', ')}</p>
    `;
    
    // Get all records from JobPostings store
    if (db.objectStoreNames.contains(JOB_STORE_NAME)) {
      const transaction = db.transaction([JOB_STORE_NAME], 'readonly');
      const store = transaction.objectStore(JOB_STORE_NAME);
      const request = store.getAll();
      
      request.onsuccess = function() {
        const records = request.result;
        
        if (records.length === 0) {
          html += '<p>No records found in the database.</p>';
        } else {
          html += `<h4>Records (${records.length}):</h4>`;
          html += '<table style="width:100%; border-collapse: collapse;">';
          html += '<tr style="background-color: #f2f2f2;">';
          html += '<th style="border: 1px solid #ddd; padding: 8px; text-align: left;">ID</th>';
          html += '<th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Job Title</th>';
          html += '<th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Company</th>';
          html += '<th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Job Type</th>';
          html += '<th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Status</th>';
          html += '<th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Details</th>';
          html += '</tr>';
          
          records.forEach(function(record) {
            html += '<tr>';
            html += `<td style="border: 1px solid #ddd; padding: 8px;">${record.id}</td>`;
            html += `<td style="border: 1px solid #ddd; padding: 8px;">${record.jobTitle}</td>`;
            html += `<td style="border: 1px solid #ddd; padding: 8px;">${record.company}</td>`;
            html += `<td style="border: 1px solid #ddd; padding: 8px;">${record.jobType}</td>`;
            html += `<td style="border: 1px solid #ddd; padding: 8px;">${record.jobStatus}</td>`;
            html += `<td style="border: 1px solid #ddd; padding: 8px;">
                      <button onclick="showRecordDetails(${record.id})" 
                              style="background-color: #008CBA; color: white; 
                                     border: none; padding: 5px 10px; 
                                     cursor: pointer; border-radius: 3px;">
                        View Details
                      </button>
                    </td>`;
            html += '</tr>';
          });
          
          html += '</table>';
        }
        
        container.innerHTML = html;
      };
      
      request.onerror = function(event) {
        container.innerHTML += '<p>Error fetching records: ' + event.target.error + '</p>';
      };
    } else {
      html += '<p>JobPostings store not found.</p>';
      container.innerHTML = html;
    }
  };
}

// Function to show details of a specific record
function showRecordDetails(id) {
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  
  request.onsuccess = function(event) {
    const db = event.target.result;
    const transaction = db.transaction([JOB_STORE_NAME], 'readonly');
    const store = transaction.objectStore(JOB_STORE_NAME);
    const getRequest = store.get(id);
    
    getRequest.onsuccess = function() {
      const record = getRequest.result;
      
      // Create modal to display record details
      const modal = document.createElement('div');
      modal.style.position = 'fixed';
      modal.style.left = '0';
      modal.style.top = '0';
      modal.style.width = '100%';
      modal.style.height = '100%';
      modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
      modal.style.display = 'flex';
      modal.style.justifyContent = 'center';
      modal.style.alignItems = 'center';
      modal.style.zIndex = '1000';
      
      const modalContent = document.createElement('div');
      modalContent.style.backgroundColor = 'white';
      modalContent.style.padding = '20px';
      modalContent.style.borderRadius = '5px';
      modalContent.style.maxWidth = '80%';
      modalContent.style.maxHeight = '80%';
      modalContent.style.overflow = 'auto';
      
      let html = `<h3>Record Details - ID: ${record.id}</h3>`;
      html += '<table style="width:100%; border-collapse: collapse;">';
      
      // Display all properties
      for (const key in record) {
        html += '<tr>';
        html += `<th style="border: 1px solid #ddd; padding: 8px; text-align: left; width: 30%;">${key}</th>`;
        html += `<td style="border: 1px solid #ddd; padding: 8px;">${
          typeof record[key] === 'object' ? JSON.stringify(record[key]) : record[key]
        }</td>`;
        html += '</tr>';
      }
      
      html += '</table>';
      html += '<div style="text-align: right; margin-top: 15px;">';
      html += '<button id="closeModalBtn" style="background-color: #f44336; color: white; border: none; padding: 8px 15px; cursor: pointer; border-radius: 3px;">Close</button>';
      html += '</div>';
      
      modalContent.innerHTML = html;
      modal.appendChild(modalContent);
      document.body.appendChild(modal);
      
      // Close modal when close button is clicked
      document.getElementById('closeModalBtn').addEventListener('click', function() {
        document.body.removeChild(modal);
      });
      
      // Close modal when clicking outside
      modal.addEventListener('click', function(event) {
        if (event.target === modal) {
          document.body.removeChild(modal);
        }
      });
    };
  };
}

// Call this function within your DOMContentLoaded event handler
document.addEventListener('DOMContentLoaded', () => {
  // Initialize the database
  initDatabase();
  
  // Add event listener to the form submit button
  const jobListingForm = document.getElementById('jobListingForm');
  jobListingForm.addEventListener('submit', handleFormSubmit);
  
  // Add event listener to cancel button
  const cancelButton = document.querySelector('.btn-cancel');
  cancelButton.addEventListener('click', () => {
    jobListingForm.reset();
    clearErrorMessage();
  });
  
  // Add fake location suggestions functionality for demo purposes
  setupLocationSuggestions();
  
  // Create error container if it doesn't exist
  createErrorContainer();
  
  // Only add database viewer button in debug mode
  if (DEBUG_MODE) {
    addDatabaseViewerButton();
  }
});
