// Imprime un polycopié HTML en PDF A4. L'en-tête courant et la pagination
// « n / N » sont des boîtes de marge CSS (@page, polycopie.css), absentes de
// la couverture.
//
//   node _outils/polycopies/imprimer.js <source.html> <sortie.pdf>
//
// Sous Windows, Microsoft Edge est utilisé s'il est là (polices Segoe UI,
// Cambria, Cascadia Mono, comme les cours 0 à 3) ; sinon Chromium, avec les
// polices de remplacement de polycopie.css.
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const [source, sortie] = process.argv.slice(2);
  if (!source || !sortie) {
    console.error('Usage : node imprimer.js <source.html> <sortie.pdf>');
    process.exit(1);
  }
  let navigateur;
  if (process.platform === 'win32') {
    try {
      navigateur = await chromium.launch({ channel: 'msedge' });
    } catch (e) {
      navigateur = null;
    }
  }
  if (!navigateur) navigateur = await chromium.launch();
  const page = await navigateur.newPage();
  await page.goto('file://' + path.resolve(source).replace(/\\/g, '/'), { waitUntil: 'load' });
  // Exécuté dans la page, où document existe
  // eslint-disable-next-line no-undef
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({
    path: sortie,
    printBackground: true,
    preferCSSPageSize: true,
    outline: true,
    tagged: true,
  });
  await navigateur.close();
  console.log('PDF écrit :', sortie);
})();
