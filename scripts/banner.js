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
    banner.style.display = 'flex';
    
    // Trigger animation by adding show class
    setTimeout(() => {
        banner.classList.add('show');
    }, 10);
    
    setTimeout(() => { 
        banner.classList.remove('show');
        setTimeout(() => {
            banner.style.display = 'none';
        }, 300);
    }, 3000);
}

// Standardized delete confirmation - this is the approved standard
function showDeleteConfirmation(message, onConfirm) {
    return showConfirmBanner(message, onConfirm);
}

function showConfirmBanner(message, onConfirm) {
    console.log('showConfirmBanner called with message:', message);
    
    // Remove any existing modal first
    const existingModal = document.getElementById('confirmModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Create modal overlay
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay';
    modalOverlay.id = 'confirmModal';
    modalOverlay.style.zIndex = '10000'; // Ensure it's on top
    
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
    console.log('Modal added to DOM');
    
    // Force modal to be visible
    setTimeout(() => {
        modalOverlay.style.opacity = '1';
        modalOverlay.style.visibility = 'visible';
        modalContent.style.transform = 'translateY(0)';
        console.log('Modal should be visible now');
    }, 10);
    
    // Add event listeners
    const confirmYes = document.getElementById('confirmYes');
    const confirmNo = document.getElementById('confirmNo');
    
    let isClosing = false;
    
    const closeModal = () => {
        if (isClosing) return; // Prevent multiple calls
        isClosing = true;
        
        // Fade out animation
        modalOverlay.style.opacity = '0';
        modalContent.style.transform = 'translateY(-20px)';
        
        setTimeout(() => {
            if (modalOverlay.parentNode) {
                modalOverlay.remove();
            }
        }, 300);
    };
    
    confirmYes.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeModal();
        setTimeout(() => onConfirm(), 300);
    });
    
    confirmNo.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeModal();
    });
    
    // Close on overlay click
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            closeModal();
        }
    });
    
    // Close on Escape key
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            closeModal();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
    
    // Focus the cancel button for accessibility
    setTimeout(() => {
        if (confirmNo) confirmNo.focus();
    }, 100);
    
    // Prevent any other code from removing this modal
    const originalRemoveChild = document.body.removeChild;
    document.body.removeChild = function(child) {
        if (child === modalOverlay && !isClosing) {
            console.warn('Attempted to remove confirmation modal - prevented');
            return;
        }
        return originalRemoveChild.call(this, child);
    };
    
    // Restore original removeChild after modal is closed
    setTimeout(() => {
        document.body.removeChild = originalRemoveChild;
    }, 5000); // Safety timeout
}
