export function instrumentLegacyEvents(source) {
  const replace=(from,to,label)=>{if(source.split(from).length!==2)throw Error('Missing analytics integration: '+label);source=source.replace(from,to)}
  const old=source.match(/const fH="https:\/\/aero-analytics\.techazzer\.workers\.dev";function pH\(\)[\s\S]*?function os\(n,e=\{\}\)\{[\s\S]*?catch\{\}\}/)?.[0]
  if(!old)throw Error('Missing legacy analytics transport')
  replace(old,'function os(n,e={}){try{if(n==="page_view")return;const a={"render-text":"render","render-download":"result",start:"copy"};window.aeroTrack?.(n==="tool_use"?"tool_start":n,{tool:e.tool,action:a[e.action]||e.action,file_type:e.file_type,error_code:e.error_code})}catch{}}','shared transport')
  for(const [tool,from,to] of [
    ['pdf-merge','s(100),r("done")}catch(w){console.error(w),r("error")','s(100),r("done"),os("tool_success",{tool:"pdf-merge",action:"merge"})}catch(w){os("tool_error",{tool:"pdf-merge",error_code:"processing_failed"}),console.error(w),r("error")'],
    ['pdf-split','c(100),o("done")}catch(w){console.error(w),o("error")','c(100),o("done"),os("tool_success",{tool:"pdf-split",action:"split"})}catch(w){os("tool_error",{tool:"pdf-split",error_code:"processing_failed"}),console.error(w),o("error")'],
    ['images-to-pdf','c(100),o("done")}catch(C){console.error(C),o("error")','c(100),o("done"),os("tool_success",{tool:"images-to-pdf",action:"convert"})}catch(C){os("tool_error",{tool:"images-to-pdf",error_code:"processing_failed"}),console.error(C),o("error")'],
    ['pdf-to-images','d(100),c("done")}catch(C){console.error(C),c("error")','d(100),c("done"),os("tool_success",{tool:"pdf-to-images",action:"convert"})}catch(C){os("tool_error",{tool:"pdf-to-images",error_code:"processing_failed"}),console.error(C),c("error")'],
    ['pdf-compress','w(100),b("done")}catch(ve){console.error(ve),b("error")','w(100),b("done"),os("tool_success",{tool:"pdf-compress",action:"compress"})}catch(ve){os("tool_error",{tool:"pdf-compress",error_code:"processing_failed"}),console.error(ve),b("error")']
  ])replace(from,to,tool+' outcome')
  replace('Ve=async()=>{if(i){z(!0),J("");try{','Ve=async()=>{if(i){os("tool_start",{tool:"image-compressor",action:"compress"}),z(!0),J("");try{','image start')
  replace('d(Ne.size)}finally{z(!1)}}},Ke=()=>','d(Ne.size),os("tool_success",{tool:"image-compressor",action:"compress"})}catch(aeroError){os("tool_error",{tool:"image-compressor",error_code:"processing_failed"});throw aeroError}finally{z(!1)}}},Ke=()=>','image outcome')
  replace('ne.href=l,ne.download=`compressed.${K}`,ne.click()','ne.href=l,ne.download=`compressed.${K}`,ne.click(),os("download",{tool:"image-compressor",file_type:K})','image download')
  return source
}
