// Fixed scenes for screenshots: ?shot=editor shows the page with photos loaded;
// ?shot=cover shows the cover alone. The query picks the layout, grade, size,
// title, subtitle and the sample in each photo slot:
//   ?shot=cover&layout=triptych&grade=neon&size=wide&title=Neon%20Bay
//   &subtitle=Midnight%20Boulevard&photoA=neon&photoB=boulevard&photoC=pier
// window.__shotReady is set once the scene has painted, so the capture script
// knows when to take the shot.
export async function runShot(query, state, helpers) {
  const { loadSample, applySize, redraw, ensureFont } = helpers;
  if (query.get('shot') === 'cover') document.body.classList.add('shot-cover');

  const click = (selector) => {
    const el = document.querySelector(selector);
    if (el) el.click();
  };
  const layout = query.get('layout');
  if (layout) click(`.layout-btn[data-layout="${layout}"]`);
  const grade = query.get('grade');
  if (grade) click(`.grade-btn[data-grade="${grade}"]`);
  const size = query.get('size');
  if (size) click(`.size-btn[data-size="${size}"]`);

  const title = document.getElementById('title');
  const subtitle = document.getElementById('subtitle');
  if (query.get('title') !== null) {
    title.value = query.get('title');
    title.dispatchEvent(new Event('input'));
  }
  if (query.get('subtitle') !== null) {
    subtitle.value = query.get('subtitle');
    subtitle.dispatchEvent(new Event('input'));
  }
  const fill = query.get('fillAll');
  if (fill !== null && fill !== '-1') click(`[data-fill="${fill}"]`);

  const photos = [
    query.get('photoA') ?? 'boulevard',
    query.get('photoB') ?? 'neon',
    query.get('photoC') ?? 'pier',
  ];
  await Promise.all(photos.map((name, i) => loadSample(i, name).catch(() => {})));
  await ensureFont();
  applySize();
  redraw();
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.__shotReady = true;
}
