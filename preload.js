const electron = require('electron');

/** @type {*} */(global).sendToBackend = electron.ipcRenderer.send;

electron.ipcRenderer.on('AddExpense', (event) => addExpense());
electron.ipcRenderer.on('AddSpace', (event) => addSpace());
electron.ipcRenderer.on('Undo', (event) => currentBudget.undoStack.undo());
electron.ipcRenderer.on('Redo', (event) => currentBudget.undoStack.redo());
electron.ipcRenderer.on('NewFile', (event) => newFile());
electron.ipcRenderer.on('Saved', (event) => savedFile());
electron.ipcRenderer.on('OpenFile', (event, data) => openFile(data));
electron.ipcRenderer.on('DeleteItem', (event, data) => currentBudget.deleteItem(data));
electron.ipcRenderer.on('NothingToSave', (event, data) => nothingToSave());
electron.ipcRenderer.on('UseData', (event, data) => useData(data));
