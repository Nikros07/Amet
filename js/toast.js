// Kleines Toast-System als Ersatz für alert(). Erstellt seinen Container bei
// Bedarf selbst, damit dieses Modul ohne zusätzliches HTML-Markup funktioniert.

let container = null;

function getContainer() {
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        container.setAttribute('role', 'status');
        container.setAttribute('aria-live', 'polite');
        document.body.appendChild(container);
    }
    return container;
}

export function showToast(message, { type = 'info', duration = 4000 } = {}) {
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = message;
    getContainer().appendChild(el);

    requestAnimationFrame(() => el.classList.add('toast-visible'));

    const remove = () => {
        el.classList.remove('toast-visible');
        el.addEventListener('transitionend', () => el.remove(), { once: true });
    };
    el.addEventListener('click', remove);
    setTimeout(remove, duration);
}
