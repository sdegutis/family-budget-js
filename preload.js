const electron = require('electron');

/**
 * @param {string} channel
 * @param {any}    data
 */
function send(channel, data) {
  electron.ipcRenderer.send(channel, data);
}

/** @type {*} */(global).sendToBackend = send;

electron.ipcRenderer.on('AddExpense', () => addExpense());
electron.ipcRenderer.on('AddSpace', () => addSpace());
electron.ipcRenderer.on('Undo', () => undo());
electron.ipcRenderer.on('Redo', () => redo());
electron.ipcRenderer.on('NewFile', () => newFile());
