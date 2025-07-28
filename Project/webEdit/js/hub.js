class UpdateHub {
    constructor() {
        this.updates = [];
    }

    addUpdate(category, update) {
        this.updates.push({ category, ...update });
    }

    renderUpdates() {
        const updatesContainer = document.getElementById('updates-container');
        updatesContainer.innerHTML = '';

        this.updates.forEach(update => {
            const updateElement = document.createElement('div');
            updateElement.classList.add('update-item');
            updateElement.innerHTML = `
                <h3>${update.category}</h3>
                <p><strong>Version:</strong> ${update.version}</p>
                <p><strong>Date:</strong> ${update.date}</p>
                <p>${update.description}</p>
            `;
            updatesContainer.appendChild(updateElement);
        });
    }
}