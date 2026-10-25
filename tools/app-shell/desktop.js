// Desktop filtering leaves mobile's curated cards alone when the viewport changes.
export function installDesktopTools({openLibrary}) {
  const buttons = [...document.querySelectorAll('[data-home-category]')]
  const cards = [...document.querySelectorAll('#desktop-tool-grid [data-tool-category]')]
  const count = document.getElementById('desktop-tool-count')
  for(const button of buttons) button.addEventListener('click',()=>{
    const category=button.dataset.homeCategory
    let visible=0
    for(const card of cards){const match=category==='All'||card.dataset.toolCategory===category;card.dataset.desktopHidden=String(!match);if(match)visible++}
    buttons.forEach(item=>item.setAttribute('aria-pressed',String(item===button)))
    if(count)count.textContent=`${visible} ${visible===1?'tool':'tools'}${category==='All'?', ready when you are.':' in this category.'}`
  })
  document.addEventListener('keydown',event=>{
    if(event.key.toLowerCase()!=='k'||!(event.ctrlKey||event.metaKey)||event.altKey||event.repeat||!matchMedia('(min-width:721px)').matches)return
    if(document.querySelector('dialog[open]')||event.target?.closest('input,textarea,select,[contenteditable=true]'))return
    event.preventDefault();openLibrary(false,'All',true)
  })
}
