// Initialize Socket.io
const socket = io();

// API base URL - change this if your server is on a different host/port
const API_URL = window.location.origin;

// DOM Elements
const dbStatus = document.getElementById('db-status');
const userDetails = document.getElementById('user-details');
const userDetailsCard = document.getElementById('user-details-card');
const liveFeed = document.getElementById('live-feed');
const transactionTableBody = document.getElementById('transaction-table-body');
const totalUsersElement = document.getElementById('total-users');
const activeUsersElement = document.getElementById('active-users');
const totalRevenueElement = document.getElementById('total-revenue');
const loaderContainer = document.querySelector('.loader-container');
const toastContainer = document.querySelector('.toast-container');
const scanBtn = document.getElementById('scan-btn');
const scanModal = document.getElementById('scan-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const cancelBtn = document.getElementById('cancel-btn');
const scanSubmitBtn = document.getElementById('scan-submit-btn');
const uuidInput = document.getElementById('uuid-input');
const presetUsersContainer = document.getElementById('preset-users');
const refreshBtn = document.getElementById('refresh-btn');

// Application State
let activeUsers = 0;
let totalRevenue = 0;
let transactions = [];
let feedItems = [];
let presetUsers = [
  { uuid: 'user123', name: 'John Doe' },
  { uuid: 'user456', name: 'Jane Smith' },
  { uuid: 'user789', name: 'Bob Johnson' }
];

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  showLoader();
  checkDatabaseConnection();
  setupEventListeners();
  fetchInitialData();
  populatePresetUsers();
});

// Set up event listeners
function setupEventListeners() {
  // Refresh button
  refreshBtn.addEventListener('click', () => {
    refreshData();
  });
  
  // Scan button
  scanBtn.addEventListener('click', () => {
    openScanModal();
  });
  
  // Close modal button
  closeModalBtn.addEventListener('click', () => {
    closeScanModal();
  });
  
  // Cancel button
  cancelBtn.addEventListener('click', () => {
    closeScanModal();
  });
  
  // Scan submit button
  scanSubmitBtn.addEventListener('click', () => {
    const uuid = uuidInput.value.trim();
    
    if (!uuid) {
      showToast('error', 'Error', 'Please enter a UUID');
      return;
    }
    
    simulateScan(uuid);
  });
  
  // Enter key in UUID input
  uuidInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      scanSubmitBtn.click();
    }
  });
  
  // Close modal when clicking outside
  scanModal.addEventListener('click', (e) => {
    if (e.target === scanModal) {
      closeScanModal();
    }
  });
}

// Check database connection
function checkDatabaseConnection() {
  fetch(`${API_URL}/check-db-connection`)
    .then(response => response.json())
    .then(data => {
      updateConnectionStatus(data.status);
    })
    .catch(error => {
      console.error('Error checking database connection:', error);
      updateConnectionStatus('Disconnected');
      showToast('error', 'Connection Error', 'Could not connect to the database');
    });
}

// Fetch initial data
function fetchInitialData() {
  // Fetch users count
  fetch(`${API_URL}/api/users/count`)
    .then(response => response.json())
    .then(data => {
      totalUsersElement.textContent = data.count;
    })
    .catch(error => {
      console.error('Error fetching users count:', error);
      totalUsersElement.textContent = 'Error';
    });

  // Fetch active users count
  fetch(`${API_URL}/api/users/active`)
    .then(response => response.json())
    .then(data => {
      activeUsersElement.textContent = data.count;
      activeUsers = data.count;
    })
    .catch(error => {
      console.error('Error fetching active users:', error);
      activeUsersElement.textContent = 'Error';
    });

  // Fetch total revenue
  fetch(`${API_URL}/api/transactions/revenue`)
    .then(response => response.json())
    .then(data => {
      totalRevenue = data.revenue;
      totalRevenueElement.textContent = formatCurrency(totalRevenue);
    })
    .catch(error => {
      console.error('Error fetching revenue:', error);
      totalRevenueElement.textContent = 'Error';
    });

  // Fetch recent transactions
  fetch(`${API_URL}/api/transactions/recent`)
    .then(response => response.json())
    .then(data => {
      transactions = data.transactions;
      updateTransactionsTable(transactions);
      hideLoader();
    })
    .catch(error => {
      console.error('Error fetching transactions:', error);
      hideLoader();
    });
}

// Update connection status
function updateConnectionStatus(status) {
  if (status === 'Connected') {
    dbStatus.innerHTML = `
      <i class="fas fa-database"></i>
      <span>Database: Connected</span>
    `;
    dbStatus.classList.add('connected');
    dbStatus.classList.remove('disconnected');
  } else {
    dbStatus.innerHTML = `
      <i class="fas fa-database"></i>
      <span>Database: Disconnected</span>
    `;
    dbStatus.classList.add('disconnected');
    dbStatus.classList.remove('connected');
  }
}

// Socket.io events
socket.on('connect', () => {
  showToast('success', 'Connected', 'Real-time updates are now active');
});

socket.on('disconnect', () => {
  showToast('error', 'Disconnected', 'Real-time updates are currently unavailable');
});

socket.on('userUpdate', (user) => {
  handleUserUpdate(user);
});

// Handle user update from socket
function handleUserUpdate(user) {
  // Determine if this is a login or logout event
  const isLogin = user.lastLogin && (!user.lastLogout || new Date(user.lastLogin) > new Date(user.lastLogout));
  
  // Update active users count
  if (isLogin) {
    activeUsers++;
  } else {
    activeUsers = Math.max(0, activeUsers - 1);
    
    // Calculate revenue from this session
    if (user.lastLogin && user.lastLogout) {
      const durationMs = new Date(user.lastLogout).getTime() - new Date(user.lastLogin).getTime();
      const durationMinutes = durationMs / (1000 * 60);
      const charge = Math.round(durationMinutes * 10) / 100;
      totalRevenue += charge;
    }
  }
  
  // Update the stats in the UI
  activeUsersElement.textContent = activeUsers;
  totalRevenueElement.textContent = formatCurrency(totalRevenue);
  
  // Highlight the updated stat values
  animateElement(activeUsersElement);
  animateElement(totalRevenueElement);
  
  // Update user details
  updateUserDetails(user);
  
  // Add to live feed
  addToLiveFeed(user, isLogin);
  
  // Refresh transactions for logout events (new transaction is created)
  if (!isLogin) {
    refreshTransactions();
  }
}

// Update user details display
function updateUserDetails(user) {
  // Show the user details card
  userDetailsCard.classList.add('visible');
  
  // Determine if the user is active
  const isActive = user.lastLogin && (!user.lastLogout || new Date(user.lastLogin) > new Date(user.lastLogout));
  
  // Format the account balance
  const formattedBalance = formatCurrency(user.accountBalance);
  
  // Determine balance class for styling
  const balanceClass = user.accountBalance >= 0 ? 'balance' : 'negative-balance';
  
  // Update user details HTML
  userDetails.innerHTML = `
    <div class="user-profile">
      <div class="user-avatar">
        <i class="fas fa-user"></i>
      </div>
      <div class="user-info-details">
        <h3>${user.name}</h3>
        <p class="user-email">${user.email || 'No email provided'}</p>
        <div class="user-badges">
          ${isActive ? '<span class="badge active">Active</span>' : ''}
          <span class="badge uuid">${user.uuid}</span>
        </div>
      </div>
    </div>
    
    <div class="user-data-grid">
      <div class="data-item">
        <p class="data-label">Account Balance</p>
        <p class="data-value ${balanceClass}">${formattedBalance}</p>
      </div>
      
      <div class="data-item">
        <p class="data-label">Phone Number</p>
        <p class="data-value">${user.phone || 'Not provided'}</p>
      </div>
      
      <div class="data-item">
        <p class="data-label">Last Login</p>
        <p class="data-value">${formatDateTime(user.lastLogin)}</p>
      </div>
      
      <div class="data-item">
        <p class="data-label">Last Logout</p>
        <p class="data-value">${formatDateTime(user.lastLogout)}</p>
      </div>
    </div>
  `;
}

// Add item to live feed
function addToLiveFeed(user, isLogin) {
  // Calculate balance change for logout events
  let balanceChange = 0;
  if (!isLogin && user.lastLogin && user.lastLogout) {
    const durationMs = new Date(user.lastLogout).getTime() - new Date(user.lastLogin).getTime();
    const durationMinutes = durationMs / (1000 * 60);
    balanceChange = Math.round(durationMinutes * 10) / 100;
  }
  
  // Remove empty state if it exists
  const emptyState = liveFeed.querySelector('.empty-state');
  if (emptyState) {
    liveFeed.removeChild(emptyState);
  }
  
  // Create feed item
  const feedItem = document.createElement('div');
  feedItem.className = `feed-item ${isLogin ? 'login' : 'logout'}`;
  
  feedItem.innerHTML = `
    <div class="feed-icon">
      <i class="fas ${isLogin ? 'fa-sign-in-alt' : 'fa-sign-out-alt'}"></i>
    </div>
    <div class="feed-content">
      <h4>${user.name} ${isLogin ? 'scanned in' : 'scanned out'}</h4>
      <p class="feed-time">${formatDateTime(isLogin ? user.lastLogin : user.lastLogout)}</p>
    </div>
    ${!isLogin ? `
      <div class="feed-balance">
        <div>Fee: ${formatCurrency(balanceChange)}</div>
        <div>Balance: ${formatCurrency(user.accountBalance)}</div>
      </div>
    ` : ''}
  `;
  
  // Add to the top of the feed
  liveFeed.insertBefore(feedItem, liveFeed.firstChild);
  
  // Limit the number of feed items (keep last 10)
  const feedItems = liveFeed.querySelectorAll('.feed-item');
  if (feedItems.length > 10) {
    liveFeed.removeChild(feedItems[feedItems.length - 1]);
  }
  
  // Store in state
  feedItems.unshift({
    user,
    isLogin,
    time: isLogin ? user.lastLogin : user.lastLogout
  });
  if (feedItems.length > 10) {
    feedItems.pop();
  }
}

// Update transactions table
function updateTransactionsTable(transactions) {
  // Clear the table first
  transactionTableBody.innerHTML = '';
  
  if (transactions.length === 0) {
    transactionTableBody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="empty-state">
            <i class="far fa-list-alt"></i>
            <p>No transactions recorded yet</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }
  
  // Add transactions to the table
  transactions.forEach(transaction => {
    const row = document.createElement('tr');
    
    const isLogin = transaction.action === 'login';
    const balanceChangeText = isLogin ? '--' : formatCurrency(Math.abs(transaction.balanceChange));
    
    row.innerHTML = `
      <td>${truncateText(transaction.uuid, 8)}</td>
      <td>${transaction.name}</td>
      <td class="action-cell ${transaction.action}">${isLogin ? 'Scan In' : 'Scan Out'}</td>
      <td>${formatDateTime(transaction.time)}</td>
      <td class="${!isLogin ? 'balance-negative' : ''}">${isLogin ? '--' : `-${balanceChangeText}`}</td>
      <td>${formatCurrency(transaction.newBalance)}</td>
    `;
    
    transactionTableBody.appendChild(row);
  });
}

// Refresh transactions data
function refreshTransactions() {
  fetch(`${API_URL}/api/transactions/recent`)
    .then(response => response.json())
    .then(data => {
      transactions = data.transactions;
      updateTransactionsTable(transactions);
    })
    .catch(error => {
      console.error('Error refreshing transactions:', error);
      showToast('error', 'Error', 'Failed to refresh transactions');
    });
}

// Refresh all data
function refreshData() {
  showLoader();
  
  // Animate the refresh button
  refreshBtn.querySelector('i').classList.add('fa-spin');
  
  Promise.all([
    fetch(`${API_URL}/api/users/count`).then(res => res.json()),
    fetch(`${API_URL}/api/users/active`).then(res => res.json()),
    fetch(`${API_URL}/api/transactions/revenue`).then(res => res.json()),
    fetch(`${API_URL}/api/transactions/recent`).then(res => res.json())
  ])
  .then(([usersData, activeData, revenueData, transactionsData]) => {
    totalUsersElement.textContent = usersData.count;
    activeUsersElement.textContent = activeData.count;
    activeUsers = activeData.count;
    totalRevenue = revenueData.revenue;
    totalRevenueElement.textContent = formatCurrency(totalRevenue);
    transactions = transactionsData.transactions;
    updateTransactionsTable(transactions);
    
    showToast('success', 'Data Refreshed', 'Dashboard data has been updated');
  })
  .catch(error => {
    console.error('Error refreshing data:', error);
    showToast('error', 'Error', 'Failed to refresh dashboard data');
  })
  .finally(() => {
    hideLoader();
    refreshBtn.querySelector('i').classList.remove('fa-spin');
  });
}

// Open scan modal
function openScanModal() {
  scanModal.classList.add('active');
  uuidInput.value = '';
  uuidInput.focus();
}

// Close scan modal
function closeScanModal() {
  scanModal.classList.remove('active');
}

// Simulate RFID scan
function simulateScan(uuid) {
  showLoader();
  
  fetch(`${API_URL}/api/users/scan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ uuid })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      closeScanModal();
      showToast('success', 'Scan Successful', `User ${data.data.user.name} ${data.data.action === 'login' ? 'scanned in' : 'scanned out'}`);
    } else {
      showToast('error', 'Scan Failed', data.error || 'User not found');
    }
  })
  .catch(error => {
    console.error('Error simulating scan:', error);
    showToast('error', 'Scan Failed', 'Failed to process RFID scan');
  })
  .finally(() => {
    hideLoader();
  });
}

// Populate preset users buttons
function populatePresetUsers() {
  const presetButtons = document.querySelector('.preset-buttons');
  presetButtons.innerHTML = '';
  
  presetUsers.forEach(user => {
    const button = document.createElement('button');
    button.className = 'preset-user-btn';
    button.textContent = `${user.name} (${user.uuid})`;
    button.addEventListener('click', () => {
      uuidInput.value = user.uuid;
    });
    
    presetButtons.appendChild(button);
  });
}

// Show the loader overlay
function showLoader() {
  loaderContainer.classList.add('show');
}

// Hide the loader overlay
function hideLoader() {
  loaderContainer.classList.remove('show');
}

// Show a toast notification
function showToast(type, title, message) {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let iconClass;
  switch (type) {
    case 'success':
      iconClass = 'fa-check-circle';
      break;
    case 'warning':
      iconClass = 'fa-exclamation-triangle';
      break;
    case 'error':
      iconClass = 'fa-times-circle';
      break;
    default:
      iconClass = 'fa-info-circle';
  }
  
  toast.innerHTML = `
    <div class="toast-icon">
      <i class="fas ${iconClass}"></i>
    </div>
    <div class="toast-content">
      <h4>${title}</h4>
      <p>${message}</p>
    </div>
  `;
  
  toastContainer.appendChild(toast);
  
  // Auto-remove toast after 5 seconds
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(30px)';
    setTimeout(() => {
      if (toastContainer.contains(toast)) {
        toastContainer.removeChild(toast);
      }
    }, 300);
  }, 5000);
}

// Animate element update
function animateElement(element) {
  element.classList.add('highlight');
  setTimeout(() => {
    element.classList.remove('highlight');
  }, 1000);
}

// Format currency value
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

// Format date/time
function formatDateTime(dateString) {
  if (!dateString) return 'N/A';
  
  const date = new Date(dateString);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

// Truncate text with ellipsis
function truncateText(text, maxLength) {
  if (!text || text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)}...`;
}

// Add CSS class for animation
document.head.insertAdjacentHTML('beforeend', `
  <style>
    .highlight {
      animation: highlight 1s ease;
    }
    @keyframes highlight {
      0% { background-color: rgba(114, 137, 218, 0.2); }
      100% { background-color: transparent; }
    }
  </style>
`);