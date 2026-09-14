// Themed Bestätigungsdialog als Ersatz für confirm(). Gibt ein Promise<boolean>
// zurück, damit Aufrufer weiter async/await benutzen können.

export function confirmDialog(message, { title = 'Bestätigen', confirmLabel = 'Löschen', cancelLabel = 'Abbrechen' } = {}) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-box" role="alertdialog" aria-modal="true" aria-labelledby="modalTitle">
                <h3 id="modalTitle">${title}</h3>
                <p>${message}</p>
                <div class="modal-actions">
                    <button type="button" class="modal-cancel">${cancelLabel}</button>
                    <button type="button" class="modal-confirm">${confirmLabel}</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const close = (result) => {
            overlay.classList.remove('modal-visible');
            overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
            document.removeEventListener('keydown', onKeydown);
            resolve(result);
        };
        const onKeydown = (e) => {
            if (e.key === 'Escape') close(false);
        };

        overlay.querySelector('.modal-confirm').addEventListener('click', () => close(true));
        overlay.querySelector('.modal-cancel').addEventListener('click', () => close(false));
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
        document.addEventListener('keydown', onKeydown);

        requestAnimationFrame(() => {
            overlay.classList.add('modal-visible');
            overlay.querySelector('.modal-cancel').focus();
        });
    });
}
