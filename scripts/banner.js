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

function showConfirmBanner(message, onConfirm) {
    let confirmBanner = document.getElementById('confirmBanner');
    if (!confirmBanner) {
        confirmBanner = document.createElement('div');
        confirmBanner.id = 'confirmBanner';
        confirmBanner.className = 'confirm-banner';
        document.body.appendChild(confirmBanner);
    }
    confirmBanner.innerHTML = `<span>${message}</span><button id="confirmYes">Yes</button><button id="confirmNo">No</button>`;
    confirmBanner.style.display = 'block';
    document.getElementById('confirmYes').onclick = () => {
        confirmBanner.style.display = 'none';
        onConfirm();
    };
    document.getElementById('confirmNo').onclick = () => {
        confirmBanner.style.display = 'none';
    };
}
