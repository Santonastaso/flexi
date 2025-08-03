// Banner and confirmation logic for destructive actions
function showBanner(message, type) {
    let banner = document.getElementById('banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'banner';
        banner.className = 'banner';
        document.body.appendChild(banner);
    }
    banner.textContent = message;
    banner.className = 'banner ' + type;
    banner.style.display = 'block';
    setTimeout(() => { banner.style.display = 'none'; }, 2000);
}

// Standardized delete confirmation - this is the approved standard
function showDeleteConfirmation(message, onConfirm) {
    return showConfirmBanner(message, onConfirm);
}

function showConfirmBanner(message, onConfirm) {
    // Create modal overlay
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay';
    modalOverlay.id = 'confirmModal';
    
    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    
    // Create modal header
    const modalHeader = document.createElement('div');
    modalHeader.className = 'modal-header';
    modalHeader.innerHTML = `
        <svg class="modal-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 9V13M12 17H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <h3>Confirm Action</h3>
    `;
    
    // Create modal body
    const modalBody = document.createElement('div');
    modalBody.className = 'modal-body';
    modalBody.innerHTML = `<p>${message}</p>`;
    
    // Create modal footer
    const modalFooter = document.createElement('div');
    modalFooter.className = 'modal-footer';
    modalFooter.innerHTML = `
        <button class="btn btn-secondary" id="confirmNo">Cancel</button>
        <button class="btn btn-danger" id="confirmYes">Delete</button>
    `;
    
    // Assemble modal
    modalContent.appendChild(modalHeader);
    modalContent.appendChild(modalBody);
    modalContent.appendChild(modalFooter);
    modalOverlay.appendChild(modalContent);
    
    // Add to DOM
    document.body.appendChild(modalOverlay);
    
    // Add event listeners
    const confirmYes = document.getElementById('confirmYes');
    const confirmNo = document.getElementById('confirmNo');
    
    const closeModal = () => {
        document.body.removeChild(modalOverlay);
    };
    
    confirmYes.addEventListener('click', () => {
        closeModal();
        onConfirm();
    });
    
    confirmNo.addEventListener('click', closeModal);
    
    // Close on overlay click
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            closeModal();
        }
    });
    
    // Close on Escape key
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
    
    // Focus the cancel button for accessibility
    confirmNo.focus();
}
