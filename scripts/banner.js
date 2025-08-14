// Banner and confirmation logic for destructive actions
function show_banner(message, type) {
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

// Backward compatibility alias (for camelCase usage)
window.showBanner = show_banner;
// Standardized delete confirmation - this is the approved standard
function show_delete_confirmation(message, on_confirm) {
    return show_confirm_banner(message, on_confirm);
}
function show_confirm_banner(message, on_confirm) {
    // Remove any existing modal first
    const existing_modal = document.getElementById('confirmModal');
    if (existing_modal) {
        existing_modal.remove();
    }
    // Create modal overlay
    const modal_overlay = document.createElement('div');
    modal_overlay.className = 'modal-overlay';
    modal_overlay.id = 'confirmModal';
    modal_overlay.style.zIndex = '10000'; // Ensure it's on top
    // Create modal content
    const modal_content = document.createElement('div');
    modal_content.className = 'modal-content';
    // Create modal header
    const modal_header = document.createElement('div');
    modal_header.className = 'modal-header';
    modal_header.innerHTML = `
        <svg class="modal-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 9V13M12 17H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <h3>Confirm Action</h3>
    `;
    // Create modal body
    const modal_body = document.createElement('div');
    modal_body.className = 'modal-body';
    modal_body.innerHTML = `<p>${message}</p>`;
    // Create modal footer
    const modal_footer = document.createElement('div');
    modal_footer.className = 'modal-footer';
    modal_footer.innerHTML = `
        <button class="btn btn-secondary" id="confirmNo">Cancel</button>
        <button class="btn btn-danger" id="confirmYes">Delete</button>
    `;
    // Assemble modal
    modal_content.appendChild(modal_header);
    modal_content.appendChild(modal_body);
    modal_content.appendChild(modal_footer);
    modal_overlay.appendChild(modal_content);
    // Add to DOM
    document.body.appendChild(modal_overlay);
    // Force modal to be visible
    setTimeout(() => {
        modal_overlay.style.opacity = '1';
        modal_overlay.style.visibility = 'visible';
        modal_content.style.transform = 'translateY(0)';
    }, 10);
    // Add event listeners
    const confirm_yes = document.getElementById('confirmYes');
    const confirm_no = document.getElementById('confirmNo');
    let is_closing = false;
    const close_modal = () => {
        if (is_closing) return; // Prevent multiple calls
        is_closing = true;
        // Fade out animation
        modal_overlay.style.opacity = '0';
        modal_content.style.transform = 'translateY(-20px)';
        setTimeout(() => {
            if (modal_overlay.parentNode) {
                modal_overlay.remove();
            }
        }, 300);
    };
    confirm_yes.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        close_modal();
        setTimeout(() => on_confirm(), 300);
    });
    confirm_no.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        close_modal();
    });
    // Close on overlay click
    modal_overlay.addEventListener('click', (e) => {
        if (e.target === modal_overlay) {
            close_modal();
        }
    });
    // Close on Escape key
    const handle_escape = (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            close_modal();
            document.removeEventListener('keydown', handle_escape);
        }
    };
    document.addEventListener('keydown', handle_escape);
    // Focus the cancel button for accessibility
    setTimeout(() => {
        if (confirm_no) confirm_no.focus();
    }, 100);
    // Prevent any other code from removing this modal
    const original_remove_child = document.body.removeChild;
    document.body.removeChild = function(child) {
        if (child === modal_overlay && !is_closing) {
            return;
        }
        return original_remove_child.call(this, child);
    };
    // Restore original removeChild after modal is closed
    setTimeout(() => {
        document.body.removeChild = original_remove_child;
    }, 5000); // Safety timeout
}
