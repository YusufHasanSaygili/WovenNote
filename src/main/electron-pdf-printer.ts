import { BrowserWindow, type BrowserWindowConstructorOptions } from 'electron'

import { SECURE_WEB_PREFERENCES } from './window-options'

type PdfWindow = Pick<BrowserWindow, 'destroy' | 'loadURL' | 'webContents'>

export type PdfWindowFactory = (options: BrowserWindowConstructorOptions) => PdfWindow

export async function printHtmlToPdf(
  html: string,
  createWindow: PdfWindowFactory = (options) => new BrowserWindow(options),
): Promise<Buffer> {
  const printWindow = createWindow({
    show: false,
    webPreferences: { ...SECURE_WEB_PREFERENCES },
  })
  printWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  try {
    const dataUrl = `data:text/html;base64,${Buffer.from(html, 'utf8').toString('base64')}`
    await printWindow.loadURL(dataUrl)
    const pdf = await printWindow.webContents.printToPDF({
      pageSize: 'A4',
      preferCSSPageSize: true,
      printBackground: true,
    })
    return pdf
  } finally {
    printWindow.destroy()
  }
}
