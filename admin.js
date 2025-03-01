// IndexedDB database configuration
const DB_NAME = 'CareerBridgeDB';
const DB_VERSION = 1;
const JOB_STORE_NAME = 'JobPostings';

// Wait for DOM to be fully loaded before adding event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Load all job listings from the database
  loadJobListings();
  
  // Add event listener for the filter input
  const filterInput = document.getElementById('filterInput');
  if (filterInput) {
    filterInput.addEventListener('input', () => {
      loadJobListings(filterInput.value);
    });
  }
});

/**
 * Load all job listings from the database and display them
 * @param {string} filterText - Optional text to filter jobs by title or company
 */
function loadJobListings(filterText = '') {
  const jobListingsBody = document.getElementById('jobListingsBody');
  
  // Show loading indicator
  jobListingsBody.innerHTML = '<tr class="loading-row"><td colspan="6">Loading job listings...</td></tr>';
  
  // Open database connection
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  
  request.onerror = (event) => {
    jobListingsBody.innerHTML = `<tr class="loading-row"><td colspan="6" style="color: #e11d48;">
      Error loading database: ${event.target.error}</td></tr>`;
  };
  
  request.onsuccess = (event) => {
    const db = event.target.result;
    
    // Check if the JobPostings store exists
    if (!db.objectStoreNames.contains(JOB_STORE_NAME)) {
      jobListingsBody.innerHTML = `<tr class="loading-row"><td colspan="6">
        No job listings store found. Please add some job listings first.</td></tr>`;
      return;
    }
    
    const transaction = db.transaction([JOB_STORE_NAME], 'readonly');
    const jobStore = transaction.objectStore(JOB_STORE_NAME);
    const getAllRequest = jobStore.getAll();
    
    getAllRequest.onsuccess = () => {
      const jobs = getAllRequest.result;
      
      if (jobs.length === 0) {
        jobListingsBody.innerHTML = `<tr class="loading-row"><td colspan="6">
          No job listings found. Please add some job listings first.</td></tr>`;
        return;
      }
      
      // Filter jobs if filter text is provided
      const filteredJobs = filterText 
        ? jobs.filter(job => 
            job.jobTitle.toLowerCase().includes(filterText.toLowerCase()) || 
            job.company.toLowerCase().includes(filterText.toLowerCase()))
        : jobs;
      
      if (filteredJobs.length === 0) {
        jobListingsBody.innerHTML = `<tr class="loading-row"><td colspan="6">
          No jobs match your search. Try a different filter.</td></tr>`;
        return;
      }
      
      // Sort jobs by status (Pending first) and then by creation date (newest first)
      filteredJobs.sort((a, b) => {
        // Sort by status first (Pending comes first)
        if (a.jobStatus !== b.jobStatus) {
          return a.jobStatus === 'Pending' ? -1 : 1;
        }
        
        // Then sort by creation date (newest first)
        const dateA = new Date(a.dateCreated || 0);
        const dateB = new Date(b.dateCreated || 0);
        return dateB - dateA;
      });
      
      // Clear and rebuild the table
      jobListingsBody.innerHTML = '';
      
      // Add each job to the table
      filteredJobs.forEach(job => {
        const row = createJobRow(job);
        jobListingsBody.appendChild(row);
      });
      
      // Update the pending count
      updatePendingCount(jobs);
    };
    
    getAllRequest.onerror = (event) => {
      jobListingsBody.innerHTML = `<tr class="loading-row"><td colspan="6" style="color: #e11d48;">
        Error fetching jobs: ${event.target.error}</td></tr>`;
    };
  };
}

/**
 * Create a table row for a job listing
 * @param {Object} job - The job data
 * @returns {HTMLTableRowElement} - The created table row
 */
function createJobRow(job) {
  const row = document.createElement('tr');
  row.setAttribute('data-job-id', job.id);
  
  // Format pay range
  let payRange = 'Unpaid';
  if (job.minPay !== null && job.maxPay !== null) {
    payRange = `$${job.minPay.toLocaleString()} - $${job.maxPay.toLocaleString()}`;
  } else if (job.minPay !== null) {
    payRange = `From $${job.minPay.toLocaleString()}`;
  } else if (job.maxPay !== null) {
    payRange = `Up to $${job.maxPay.toLocaleString()}`;
  }
  
  // Get work arrangement text and icon
  const workArrangement = getWorkArrangementInfo(job.workArrangement);
  
  // Create the job info cell
  const jobInfoCell = document.createElement('td');
  jobInfoCell.innerHTML = `
    <h3 class="job-title">${job.jobTitle}</h3>
    <div class="company-name">${job.company}</div>
  `;
  
  // Create the work arrangement cell
  const workArrangementCell = document.createElement('td');
  workArrangementCell.innerHTML = `
    <div class="work-arrangement">
      <span class="material-icons arrangement-icon">${workArrangement.icon}</span>
      <span>${workArrangement.text}</span>
    </div>
  `;
  
  // Create the pay range cell
  const payRangeCell = document.createElement('td');
  payRangeCell.textContent = payRange;
  
  // Create the applications count cell (placeholder)
  const applicationsCell = document.createElement('td');
  applicationsCell.textContent = '0'; // Placeholder value as specified
  
  // Create the status cell
  const statusCell = document.createElement('td');
  
  const statusBadge = document.createElement('span');
  if (job.jobStatus === 'Pending') {
    statusBadge.className = 'status-badge badge-pending';
    statusBadge.textContent = 'Pending';
  } else {
    statusBadge.className = 'status-badge badge-approved';
    statusBadge.textContent = 'Approved';
  }
  
  statusCell.appendChild(statusBadge);
  
  // Create the actions cell
  const actionsCell = document.createElement('td');
  actionsCell.style.textAlign = 'right';
  
  if (job.jobStatus === 'Pending') {
    const approveButton = document.createElement('button');
    approveButton.className = 'approve-button';
    approveButton.innerHTML = `
      <span class="material-icons" style="font-size: 16px;">check</span>
      Approve
    `;
    approveButton.addEventListener('click', () => approveJob(job.id));
    actionsCell.appendChild(approveButton);
  }
  
  // Add all cells to the row
  row.appendChild(jobInfoCell);
  row.appendChild(workArrangementCell);
  row.appendChild(payRangeCell);
  row.appendChild(applicationsCell);
  row.appendChild(statusCell);
  row.appendChild(actionsCell);
  
  return row;
}

/**
 * Get work arrangement display info
 * @param {string} arrangement - The work arrangement value
 * @returns {Object} - Icon and text for the arrangement
 */
function getWorkArrangementInfo(arrangement) {
  switch (arrangement) {
    case 'remote':
      return { icon: 'wifi', text: 'Remote' };
    case 'hybrid':
      return { icon: 'business', text: 'Hybrid' };
    case 'in-person':
      return { icon: 'location_on', text: 'In-Person' };
    default:
      return { icon: 'help_outline', text: 'Unknown' };
  }
}

/**
 * Approve a job listing
 * @param {number} jobId - The ID of the job to approve
 */
function approveJob(jobId) {
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  
  request.onsuccess = (event) => {
    const db = event.target.result;
    const transaction = db.transaction([JOB_STORE_NAME], 'readwrite');
    const jobStore = transaction.objectStore(JOB_STORE_NAME);
    
    // Get the job first to update it
    const getRequest = jobStore.get(jobId);
    
    getRequest.onsuccess = () => {
      const job = getRequest.result;
      if (job) {
        // Update the job status
        job.jobStatus = 'Reviewed';
        
        // Put the updated job back into the store
        const updateRequest = jobStore.put(job);
        
        updateRequest.onsuccess = () => {
          // Show success notification
          showNotification('Job listing approved successfully', 'success');
          
          // Update the row in the UI
          const row = document.querySelector(`tr[data-job-id="${jobId}"]`);
          if (row) {
            // Update the status badge
            const statusCell = row.cells[4]; // The status is in the 5th cell (index 4)
            statusCell.innerHTML = '<span class="status-badge badge-approved">Approved</span>';
            
            // Remove the approve button
            const actionsCell = row.cells[5]; // The actions are in the 6th cell (index 5)
            actionsCell.innerHTML = '';
          }
          
          // Update the pending count - get all jobs to recalculate
          const countTransaction = db.transaction([JOB_STORE_NAME], 'readonly');
          const countStore = countTransaction.objectStore(JOB_STORE_NAME);
          const countRequest = countStore.getAll();
          
          countRequest.onsuccess = () => {
            updatePendingCount(countRequest.result);
          };
        };
        
        updateRequest.onerror = (event) => {
          showNotification(`Error approving job: ${event.target.error}`, 'error');
        };
      } else {
        showNotification(`Job with ID ${jobId} not found`, 'error');
      }
    };
    
    getRequest.onerror = (event) => {
      showNotification(`Error fetching job: ${event.target.error}`, 'error');
    };
  };
  
  request.onerror = (event) => {
    showNotification(`Database error: ${event.target.error}`, 'error');
  };
}

/**
 * Show a notification message
 * @param {string} message - The message to display
 * @param {string} type - The type of notification (success, error)
 */
/**
 * Update the pending count display
 * @param {Array} jobs - All jobs from the database
 */
function updatePendingCount(jobs) {
  const pendingCountElement = document.getElementById('pendingCount');
  if (pendingCountElement) {
    const pendingCount = jobs.filter(job => job.jobStatus === 'Pending').length;
    pendingCountElement.textContent = pendingCount;
  }
}

/**
 * Show a notification message
 * @param {string} message - The message to display
 * @param {string} type - The type of notification (success, error)
 */
function showNotification(message, type = 'success') {
  // Check if notification container exists, create if not
  let notificationContainer = document.getElementById('notificationContainer');
  
  if (!notificationContainer) {
    notificationContainer = document.createElement('div');
    notificationContainer.id = 'notificationContainer';
    notificationContainer.className = 'fixed top-4 right-4 z-50';
    document.body.appendChild(notificationContainer);
  }
  
  // Create notification element
  const notification = document.createElement('div');
  notification.style.backgroundColor = type === 'success' ? '#ecfdf5' : '#fef2f2';
  notification.style.color = type === 'success' ? '#047857' : '#b91c1c';
  notification.style.padding = '16px';
  notification.style.borderRadius = '8px';
  notification.style.marginBottom = '12px';
  notification.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
  notification.style.display = 'flex';
  notification.style.alignItems = 'center';
  
  // Add icon based on type
  const icon = type === 'success' ? 'check_circle' : 'error';
  
  notification.innerHTML = `
    <span class="material-icons" style="margin-right: 8px;">${icon}</span>
    <span>${message}</span>
  `;
  
  // Add to container
  notificationContainer.appendChild(notification);
  
  // Remove after 3 seconds
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.5s ease';
    
    setTimeout(() => {
      if (notification.parentNode === notificationContainer) {
        notificationContainer.removeChild(notification);
      }
    }, 500);
  }, 3000);
}