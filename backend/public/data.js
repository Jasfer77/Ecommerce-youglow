window.YG_PRODUCTS=[];

window.YG_getProducts=function(){
  try{const request=new XMLHttpRequest();request.open('GET','/api/products?catalog=20261103',false);request.setRequestHeader('Cache-Control','no-cache');request.send();if(request.status===200)return JSON.parse(request.responseText);}catch(_){}
  return [];
};
window.YG_saveProducts=function(products){
  try{const request=new XMLHttpRequest();request.open('PUT','/api/products',false);request.setRequestHeader('Content-Type','application/json');request.send(JSON.stringify(products));return request.status===200;}catch(_){return false;}
};
let csrfTokenRequest;
async function csrfToken(refresh=false){
  if(refresh)csrfTokenRequest=null;
  csrfTokenRequest??=fetch('/csrf-token',{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}}).then(response=>{if(!response.ok)throw new Error('Unable to start a secure session.');return response.json();}).then(data=>data.token).catch(error=>{csrfTokenRequest=null;throw error;});
  try{return await csrfTokenRequest;}catch(error){if(refresh)throw error;await new Promise(resolve=>setTimeout(resolve,400));return csrfToken(true);}
}
async function api(path,options={}){
  const {retryNetwork=false,...requestOptions}=options;
  const method=(options.method||'GET').toUpperCase();
  const mutating=!['GET','HEAD','OPTIONS'].includes(method);
  const send=async refresh=>fetch(path,{credentials:'same-origin',cache:mutating?'default':'no-store',...requestOptions,headers:{'X-YG-Portal':window.YG_PORTAL||'customer',Accept:'application/json',...(mutating?{}:{'Cache-Control':'no-cache'}),...(requestOptions.body instanceof FormData?{}:{'Content-Type':'application/json'}),...(mutating?{'X-CSRF-TOKEN':await csrfToken(refresh)}:{}),...(requestOptions.headers||{})}});
  let response;
  try{response=await send(false);}catch(error){
    if(retryNetwork){await new Promise(resolve=>setTimeout(resolve,600));try{response=await send(true);}catch(_){throw new Error(navigator.onLine?'We could not connect to the server. Please try signing in again.':'You appear to be offline. Check your internet connection and try again.');}}
    else throw new Error(navigator.onLine?'We could not connect to the server. Please try again.':'You appear to be offline. Check your internet connection and try again.');
  }
  if(response.status===419&&mutating){try{response=await send(true);}catch(_){throw new Error(navigator.onLine?'Your secure session could not be renewed. Please try signing in again.':'You appear to be offline. Check your internet connection and try again.');}}
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.message||Object.values(data.errors||{}).flat()[0]||'Request failed');
  return data;
}
window.YG_api=api;
const YG_MESSAGE_IMAGE_TYPES=['image/jpeg','image/png','image/webp'];
function YG_messageImageError(file){
  if(!YG_MESSAGE_IMAGE_TYPES.includes(file.type))return 'Only JPG, PNG, or WebP image files are allowed.';
  if(file.size>5*1024*1024)return 'The image must be 5 MB or smaller.';
  return '';
}
function YG_removeMessagePreview(form){
  const preview=form?.querySelector('.message-paste-preview');
  if(preview?.dataset.objectUrl)URL.revokeObjectURL(preview.dataset.objectUrl);
  preview?.remove();
  form?.classList.remove('has-message-preview');
}
function YG_showMessagePreview(input,file){
  const form=input.form;
  if(!form)return;
  YG_removeMessagePreview(form);
  const objectUrl=URL.createObjectURL(file);
  const preview=document.createElement('div');
  preview.className='message-paste-preview';
  preview.dataset.objectUrl=objectUrl;
  preview.innerHTML='<img alt=""><span><b></b><small>Ready to send</small></span><button type="button" aria-label="Remove attached image">×</button>';
  preview.querySelector('img').src=objectUrl;
  preview.querySelector('img').alt=file.name||'Attached image preview';
  preview.querySelector('b').textContent=file.name||'Pasted screenshot';
  preview.querySelector('button').onclick=()=>{input.value='';input.dispatchEvent(new Event('change',{bubbles:true}));};
  form.classList.add('has-message-preview');
  form.prepend(preview);
}
document.addEventListener('change',event=>{
  const input=event.target.closest('input[type="file"]');
  const file=input?.files?.[0];
  if(!input)return;
  const attachmentControl=input.closest('.message-attachment-control');
  const attachmentToggle=attachmentControl?.querySelector('.message-attachment-toggle');
  if(!file){attachmentControl?.classList.remove('has-photo','open');YG_removeMessagePreview(input.form);if(attachmentToggle){attachmentToggle.setAttribute('aria-expanded','false');attachmentToggle.setAttribute('aria-label','Add attachment');attachmentToggle.removeAttribute('title');}return;}
  const message=YG_messageImageError(file);
  input.setCustomValidity(message);
  if(message){input.reportValidity();input.value='';attachmentControl?.classList.remove('has-photo','open');YG_removeMessagePreview(input.form);return;}
  if(attachmentControl)YG_showMessagePreview(input,file);
  attachmentControl?.classList.add('has-photo');
  attachmentControl?.classList.remove('open');
  if(attachmentToggle){attachmentToggle.setAttribute('aria-expanded','false');attachmentToggle.setAttribute('aria-label',`Photo selected: ${file.name}`);attachmentToggle.title=file.name;}
},true);
document.addEventListener('paste',event=>{
  const textarea=event.target.closest('textarea');
  const form=textarea?.form;
  const input=form?.querySelector('.message-attachment-control input[type="file"]');
  if(!input)return;
  const clipboardFile=Array.from(event.clipboardData?.items||[]).find(item=>item.kind==='file'&&item.type.startsWith('image/'))?.getAsFile();
  if(!clipboardFile)return;
  const extension=clipboardFile.type==='image/png'?'png':clipboardFile.type==='image/webp'?'webp':'jpg';
  const file=new File([clipboardFile],`pasted-screenshot-${new Date().toISOString().replace(/[:.]/g,'-')}.${extension}`,{type:clipboardFile.type||'image/png',lastModified:Date.now()});
  const message=YG_messageImageError(file);
  if(message){input.setCustomValidity(message);input.reportValidity();return;}
  try{
    const transfer=new DataTransfer();
    transfer.items.add(file);
    input.files=transfer.files;
    input.dispatchEvent(new Event('change',{bubbles:true}));
    event.preventDefault();
  }catch(_){
    input.setCustomValidity('This browser cannot paste this image. Please use the gallery button instead.');
    input.reportValidity();
  }
});
document.addEventListener('click',event=>{
  const toggle=event.target.closest('.message-attachment-toggle');
  if(toggle){
    const control=toggle.closest('.message-attachment-control');
    const opening=!control.classList.contains('open');
    document.querySelectorAll('.message-attachment-control.open').forEach(item=>{item.classList.remove('open');item.querySelector('.message-attachment-toggle')?.setAttribute('aria-expanded','false');});
    control.classList.toggle('open',opening);
    toggle.setAttribute('aria-expanded',String(opening));
    return;
  }
  if(!event.target.closest('.message-attachment-control'))document.querySelectorAll('.message-attachment-control.open').forEach(item=>{item.classList.remove('open');item.querySelector('.message-attachment-toggle')?.setAttribute('aria-expanded','false');});
});
window.YG_resetMessageAttachment=function(form){const control=form.querySelector('.message-attachment-control'),toggle=control?.querySelector('.message-attachment-toggle');YG_removeMessagePreview(form);control?.classList.remove('open','has-photo');if(toggle){toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Add attachment');toggle.removeAttribute('title');}};
window.YG_confirm=function({title='Please confirm',message='',confirmText='Confirm',tone='danger'}={}){
  return new Promise(resolve=>{
    document.querySelector('.yg-confirm-backdrop')?.remove();
    const backdrop=document.createElement('div');
    backdrop.className='yg-confirm-backdrop';
    backdrop.innerHTML='<section class="yg-confirm-card" role="alertdialog" aria-modal="true"><span class="yg-confirm-label">Confirmation required</span><h2></h2><p></p><div><button type="button" data-confirm-cancel>Cancel</button><button type="button" data-confirm-accept></button></div></section>';
    const card=backdrop.querySelector('.yg-confirm-card');
    card.dataset.tone=tone;
    card.querySelector('h2').textContent=title;
    card.querySelector('p').textContent=message;
    card.querySelector('[data-confirm-accept]').textContent=confirmText;
    const finish=value=>{document.removeEventListener('keydown',onKey);backdrop.classList.remove('open');window.setTimeout(()=>backdrop.remove(),180);resolve(value);};
    const onKey=event=>{if(event.key==='Escape')finish(false);};
    backdrop.querySelector('[data-confirm-cancel]').onclick=()=>finish(false);
    backdrop.querySelector('[data-confirm-accept]').onclick=()=>finish(true);
    backdrop.onclick=event=>{if(event.target===backdrop)finish(false);};
    document.addEventListener('keydown',onKey);
    document.body.append(backdrop);
    window.requestAnimationFrame(()=>{backdrop.classList.add('open');backdrop.querySelector('[data-confirm-cancel]').focus();});
  });
};
window.YG_createOrder=function(order,receipt){const body=new FormData();Object.entries(order).forEach(([key,value])=>{if(key==='items')value.forEach((item,index)=>{body.append(`items[${index}][id]`,item.id);body.append(`items[${index}][quantity]`,item.quantity);});else body.append(key,value??'');});if(receipt)body.append('receipt',receipt);return api('/api/orders',{method:'POST',body});};
window.YG_ORDERS=[];
