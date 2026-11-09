window.YG_PRODUCTS=[];

window.YG_getProducts=function(){
  try{const request=new XMLHttpRequest();request.open('GET','/api/products',false);request.send();if(request.status===200)return JSON.parse(request.responseText);}catch(_){}
  return [];
};
window.YG_saveProducts=function(products){
  try{const request=new XMLHttpRequest();request.open('PUT','/api/products',false);request.setRequestHeader('Content-Type','application/json');request.send(JSON.stringify(products));return request.status===200;}catch(_){return false;}
};
async function api(path,options={}){
  const response=await fetch(path,{credentials:'same-origin',...options,headers:{'X-YG-Portal':window.YG_PORTAL||'customer',...(options.body instanceof FormData?{}:{'Content-Type':'application/json'}),...(options.headers||{})}});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.message||Object.values(data.errors||{}).flat()[0]||'Request failed');
  return data;
}
window.YG_api=api;
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
