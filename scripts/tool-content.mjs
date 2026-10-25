export const categories = [
  {id:'Work',label:'Work & time',icon:'clock',description:'Plan your week and calculate working hours.'},
  {id:'Finance',label:'Money',icon:'calculator',description:'Estimate payments, taxes, salary and savings.'},
  {id:'PDF',label:'PDFs',icon:'file',description:'Combine, split, convert and reduce documents.'},
  {id:'Image',label:'Images',icon:'image',description:'Resize, compress and prepare photos.'},
  {id:'Create',label:'Creative',icon:'pen',description:'Turn your handwriting into something reusable.'},
  {id:'Files',label:'Files & folders',icon:'folder',description:'Organize and copy files across accounts.'},
]

// Editorial descriptions, not usage rankings. Keep claims tied to shipped tools.
export const coreTools = {
  '/work-hours-calculator/': {title:'Work Hours & Timesheet',category:'Work',description:'Add shifts and breaks. Get hours, overtime and estimated pay.',keywords:'time sheet timecard work hours clock overtime weekly wages hours worked'},
  '/handwriting-font/': {title:'Handwriting Font Generator',category:'Create',description:'Turn your own handwriting into a downloadable font.',keywords:'hand writing personal custom font letters ttf create text'},
  '/emi-calculator/': {title:'EMI Calculator',category:'Finance',description:'Estimate monthly loan payments and total interest.',keywords:'loan monthly payment mortgage interest repayment money'},
  '/gst-calculator/': {title:'GST Calculator',category:'Finance',description:'Add or remove GST and see the tax breakdown.',keywords:'tax goods services amount percentage invoice inclusive exclusive money'},
  '/sip-calculator/': {title:'SIP Calculator',category:'Finance',description:'Explore estimates for regular monthly investments.',keywords:'investment savings mutual fund compound return money'},
  '/salary-calculator/': {title:'Salary Calculator',category:'Finance',description:'Estimate take-home pay from your salary package.',keywords:'ctc salary monthly yearly income pay money'},
  '/image-compressor/': {title:'Image Compressor',category:'Image',description:'Make photos smaller for uploads, forms and sharing.',keywords:'photo picture file smaller reduce size resize compress jpg png kb mb'},
  '/pdf-compress/': {title:'PDF Compressor',category:'PDF',description:'Reduce PDF size for email and upload limits.',keywords:'document file smaller shrink reduce size email attachment'},
  '/pdf-merge/': {title:'Merge PDFs',category:'PDF',description:'Combine multiple documents into a single PDF.',keywords:'join combine documents files together merge'},
  '/pdf-split/': {title:'Split PDF',category:'PDF',description:'Extract the pages you need into a separate PDF.',keywords:'extract separate pages remove split document'},
  '/pdf-to-images/': {title:'PDF to Images',category:'PDF',description:'Save document pages as JPG or PNG images.',keywords:'convert pdf jpg png pictures pages'},
  '/images-to-pdf/': {title:'Images to PDF',category:'PDF',description:'Put photos and scans together in one PDF.',keywords:'jpg png photos pictures document scan convert'},
  '/drive-folder-copy/': {title:'Google Drive Folder Copy',category:'Files',description:'Copy Drive folders between connected Google accounts.',keywords:'copy transfer google drive files folders account backup'},
}

export const featuredPaths = ['/work-hours-calculator/','/handwriting-font/','/pdf-merge/','/image-compressor/','/emi-calculator/','/gst-calculator/']
