export async function printHtml(html: string) {
  let printer: any = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('react-native-print');
    printer = mod.default || mod;
  } catch {
    printer = null;
  }
  if (!printer || typeof printer.print !== 'function') {
    throw new Error('Printing is not available in this build. Use Share or Download, then print the file.');
  }
  await printer.print({ html });
}
