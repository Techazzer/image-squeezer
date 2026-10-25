export const helpClasses = ['pdf-info','calc-info','ic-info','hf-info','dc-info']

export function compactHelpBundle(bundle) {
  for (const name of helpClasses) {
    const from = `p.jsxs("div",{className:"${name}",children:[`
    const count = bundle.split(from).length - 1
    const expected = name === 'pdf-info' ? 5 : name === 'calc-info' ? 4 : 1
    if (count !== expected) throw Error(`Expected ${expected} ${name} help sections; found ${count}`)
    bundle = bundle.replaceAll(from, `p.jsxs("details",{className:"${name} aero-tool-help",open:!matchMedia("(max-width:720px)").matches,children:[p.jsx("summary",{children:"How it works & FAQs"}),`)
  }
  return bundle
}

// Keep all explanatory content in initial HTML, inside a native disclosure.
export function compactHelpHtml(html) {
  for (const name of helpClasses) {
    const opening = `<div class="${name}">`, start = html.indexOf(opening)
    if (start === -1) continue
    const pattern = /<div\b[^>]*>|<\/div>/g
    pattern.lastIndex = start
    let depth = 0, end = -1, match
    while ((match = pattern.exec(html))) {
      depth += match[0] === '</div>' ? -1 : 1
      if (depth === 0) { end = match.index; break }
    }
    if (end === -1) throw Error(`Unclosed ${name} help section`)
    html = html.slice(0,start) + `<details class="${name} aero-tool-help"><summary>How it works &amp; FAQs</summary>` + html.slice(start + opening.length,end) + '</details>' + html.slice(end + 6)
  }
  return html
}
