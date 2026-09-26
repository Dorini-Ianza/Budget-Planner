const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("budget", {
  get: (month) => ipcRenderer.invoke("get", month),
  act: (action, payload, month) =>
    ipcRenderer.invoke("act", action, payload, month),
  file: (action) => ipcRenderer.invoke("file", action),
  system: (action) => ipcRenderer.invoke("system", action),
  onNavigate: (callback) => {
    const listener = (_, page) => callback(page);
    ipcRenderer.on("navigate", listener);
    return () => ipcRenderer.removeListener("navigate", listener);
  },
});
