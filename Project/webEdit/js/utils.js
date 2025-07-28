// filepath: c:\Users\PC_User\Desktop\GItMatrix\PEXWeb\Project\webEdit\js\utils.js

function formatDate(dateString) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}

function createElement(tag, attributes) {
    const element = document.createElement(tag);
    for (const key in attributes) {
        element.setAttribute(key, attributes[key]);
    }
    return element;
}