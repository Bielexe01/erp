const { app, BrowserWindow } = require('electron')
const path = require('path')

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    frame: false,
    autoHideMenuBar: true,
    fullscreen: true,
    backgroundColor: '#0f172a',
    show: false
  })

  win.once('ready-to-show', () => {
    win.show()
  })

  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
}
app.whenReady().then(createWindow)
