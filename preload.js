const electron = require('electron');

/**
 * @param {string} channel
 * @param {any}    data
 */
function send(channel, data) {
  electron.ipcRenderer.send(channel, data);
}

/** @type {*} */(global).sendToBackend = send;

electron.ipcRenderer.on('AddExpense', (event) => addExpense());
electron.ipcRenderer.on('AddSpace', (event) => addSpace());
electron.ipcRenderer.on('Undo', (event) => undo());
electron.ipcRenderer.on('Redo', (event) => redo());
electron.ipcRenderer.on('NewFile', (event) => newFile());
electron.ipcRenderer.on('OpenFile', (event, data) => openFile(data));
